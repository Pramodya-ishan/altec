import { apiFetch } from "./api";
import type { UploadProgressSnapshot, UploadTaskControls } from "./clientStorageUpload";

const DEFAULT_CHUNK_SIZE = 64 * 1024 * 1024;
const MAX_UPLOAD_ATTEMPTS = 5;

function chooseChunkSize(fileSize: number) {
  if (fileSize >= 1024 * 1024 * 1024) return 256 * 1024 * 1024;
  if (fileSize >= 256 * 1024 * 1024) return 128 * 1024 * 1024;
  return DEFAULT_CHUNK_SIZE;
}

function wait(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

function isRetryableUploadStatus(status: number) {
  return status === 0 || status === 408 || status === 429 || status >= 500;
}

function nextOffsetFromRange(value: string | null) {
  const end = Number(value?.match(/bytes=\d+-(\d+)/i)?.[1] || NaN);
  return Number.isFinite(end) ? end + 1 : null;
}

/** Ask GCS how many bytes survived a dropped connection. */
async function queryCommittedOffset(uploadUrl: string, totalBytes: number) {
  return await new Promise<number | null>((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl, true);
    xhr.setRequestHeader("Content-Range", `bytes */${totalBytes}`);
    xhr.onload = () => {
      if (xhr.status === 200 || xhr.status === 201) return resolve(totalBytes);
      if (xhr.status === 308) return resolve(nextOffsetFromRange(xhr.getResponseHeader("Range")) || 0);
      resolve(null);
    };
    xhr.onerror = () => resolve(null);
    xhr.send();
  });
}

type VideoMetadata = {
  title: string;
  description?: string;
  subject?: string;
  lesson?: string;
  concept?: string;
  visibility?: "private" | "class" | "institution" | "public";
};

type VideoCreateResponse = {
  ok: true;
  videoId: string;
  sourceId: string;
  version: number;
};

type UploadPlanResponse = {
  ok: true;
  uploadUrl: string;
  storagePath: string;
  expiresAt: string;
};

function parseJsonOrThrow<T>(response: Response): Promise<T> {
  return response.json().then((payload) => {
    if (!response.ok || !payload?.ok) {
      throw new Error(payload?.message || payload?.error || `Request failed (${response.status})`);
    }
    return payload as T;
  });
}

async function readVideoFileMetadata(file: File) {
  return new Promise<{ width?: number; height?: number; durationMs?: number }>((resolve) => {
    const element = document.createElement("video");
    const objectUrl = URL.createObjectURL(file);
    const finish = (value: { width?: number; height?: number; durationMs?: number }) => {
      URL.revokeObjectURL(objectUrl);
      element.removeAttribute("src");
      resolve(value);
    };
    element.preload = "metadata";
    element.onloadedmetadata = () => finish({
      width: element.videoWidth || undefined,
      height: element.videoHeight || undefined,
      durationMs: Number.isFinite(element.duration) ? Math.round(element.duration * 1000) : undefined,
    });
    element.onerror = () => finish({});
    element.src = objectUrl;
  });
}

/** Upload a file through a server-created GCS resumable session in bounded chunks. */
async function uploadResumableFile(params: {
  file: File;
  uploadUrl: string;
  onProgress?: (snapshot: UploadProgressSnapshot) => void;
  onTask?: (controls: UploadTaskControls) => void;
  chunkSize?: number;
}) {
  const { file, uploadUrl, onProgress, onTask } = params;
  const chunkSize = params.chunkSize || chooseChunkSize(file.size);
  let offset = 0;
  let paused = false;
  let canceled = false;
  let activeRequest: XMLHttpRequest | null = null;
  let resumeWaiter: (() => void) | null = null;

  const controls: UploadTaskControls = {
    pause: () => {
      if (canceled || paused) return false;
      paused = true;
      onProgress?.({
        bytesTransferred: offset,
        totalBytes: file.size,
        progress: file.size ? offset / file.size : 0,
        state: "paused",
      });
      return true;
    },
    resume: () => {
      if (canceled || !paused) return false;
      paused = false;
      resumeWaiter?.();
      resumeWaiter = null;
      return true;
    },
    cancel: () => {
      if (canceled) return false;
      canceled = true;
      activeRequest?.abort();
      resumeWaiter?.();
      resumeWaiter = null;
      return true;
    },
  };

  onTask?.(controls);

  while (offset < file.size) {
    if (canceled) {
      onProgress?.({
        bytesTransferred: offset,
        totalBytes: file.size,
        progress: file.size ? offset / file.size : 0,
        state: "canceled",
      });
      throw new DOMException("Upload canceled", "AbortError");
    }

    if (paused) {
      await new Promise<void>((resolve) => {
        resumeWaiter = resolve;
      });
      continue;
    }

    const endExclusive = Math.min(offset + chunkSize, file.size);
    const chunk = file.slice(offset, endExclusive);
    const startOffset = offset;

    let uploaded = false;
    let attempt = 0;
    while (!uploaded) {
      attempt += 1;
      try {
        const committedOffset = await new Promise<number>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          activeRequest = xhr;
          xhr.open("PUT", uploadUrl, true);
          xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
          xhr.setRequestHeader(
            "Content-Range",
            `bytes ${startOffset}-${endExclusive - 1}/${file.size}`,
          );

          xhr.upload.onprogress = (event) => {
            const transferred = Math.min(file.size, startOffset + event.loaded);
            onProgress?.({
              bytesTransferred: transferred,
              totalBytes: file.size,
              progress: file.size ? transferred / file.size : 0,
              state: paused ? "paused" : "running",
            });
          };
          xhr.onerror = () => reject(Object.assign(new Error("Video upload network error"), { status: 0 }));
          xhr.onabort = () => {
            if (canceled) reject(new DOMException("Upload canceled", "AbortError"));
            else reject(Object.assign(new Error("Video upload interrupted"), { status: 0 }));
          };
          xhr.onload = () => {
            if (xhr.status === 200 || xhr.status === 201) resolve(file.size);
            else if (xhr.status === 308) resolve(nextOffsetFromRange(xhr.getResponseHeader("Range")) || endExclusive);
            else reject(Object.assign(new Error(`Video upload failed (${xhr.status})`), { status: xhr.status }));
          };
          xhr.send(chunk);
        });
        offset = Math.max(offset, Math.min(file.size, committedOffset));
        uploaded = true;
      } catch (error: any) {
        if (canceled || error?.name === "AbortError") throw error;
        if (attempt >= MAX_UPLOAD_ATTEMPTS || !isRetryableUploadStatus(Number(error?.status || 0))) throw error;
        const committedOffset = await queryCommittedOffset(uploadUrl, file.size);
        if (committedOffset !== null && committedOffset > offset) {
          offset = Math.min(file.size, committedOffset);
          uploaded = true;
          break;
        }
        await wait(Math.min(8_000, 500 * (2 ** (attempt - 1))) + Math.round(Math.random() * 250));
      }
    }

    activeRequest = null;
    // A successful 308 response tells us the exact server-committed byte.
    // Never blindly resend or skip bytes after a partial network failure.
    onProgress?.({
      bytesTransferred: offset,
      totalBytes: file.size,
      progress: file.size ? offset / file.size : 0,
      state: "running",
    });
  }

  onProgress?.({
    bytesTransferred: file.size,
    totalBytes: file.size,
    progress: 1,
    state: "success",
  });
}

export async function createAndUploadSecureVideo(params: {
  file: File;
  metadata: VideoMetadata;
  onProgress?: (snapshot: UploadProgressSnapshot) => void;
  onTask?: (controls: UploadTaskControls) => void;
}) {
  const { file, metadata, onProgress, onTask } = params;
  const fileMetadata = await readVideoFileMetadata(file);

  const created = await parseJsonOrThrow<VideoCreateResponse>(
    await apiFetch("/api/admin/videos", {
      method: "POST",
      body: JSON.stringify({
        ...metadata,
        originalFileName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        ...fileMetadata,
      }),
    }),
  );

  const plan = await parseJsonOrThrow<UploadPlanResponse>(
    await apiFetch(`/api/admin/videos/${created.videoId}/create-upload`, {
      method: "POST",
      body: JSON.stringify({
        fileName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
      }),
    }),
  );

  await uploadResumableFile({ file, uploadUrl: plan.uploadUrl, onProgress, onTask });

  const finalized = await parseJsonOrThrow<any>(
    await apiFetch(`/api/admin/videos/${created.videoId}/upload-complete`, {
      method: "POST",
      body: JSON.stringify({
        sizeBytes: file.size,
        mimeType: file.type,
        storagePath: plan.storagePath,
      }),
    }),
  );

  return {
    ...created,
    ...finalized,
    storagePath: plan.storagePath,
  };
}
