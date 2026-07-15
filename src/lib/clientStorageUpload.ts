import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";
import { auth, storage } from "./firebase";

export type UploadProgressSnapshot = {
  bytesTransferred: number;
  totalBytes: number;
  progress: number;
  state: "running" | "paused" | "success" | "canceled" | "error";
};

export type UploadTaskControls = {
  pause: () => boolean;
  resume: () => boolean;
  cancel: () => boolean;
};

export function safeFileName(name: string) {
  return name
    .replace(/[^\w.\-]+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 120);
}

export async function uploadPdfWithClientStorage({
  file,
  subject,
  lesson,
  resourceType,
  year,
  sourceScope,
  sourceType,
  onProgress,
  onTask,
}: {
  file: File;
  subject?: string;
  lesson?: string;
  resourceType?: string;
  year?: string;
  sourceScope?: string;
  sourceType?: string;
  onProgress?: (snapshot: UploadProgressSnapshot) => void;
  onTask?: (controls: UploadTaskControls) => void;
}) {
  const user = auth.currentUser;
  if (!user || user.isAnonymous) {
    throw new Error("Please sign in before uploading PDFs.");
  }
  const uid = user.uid;
  const sourceId = crypto.randomUUID();
  const fileName = safeFileName(file.name);
  const yearPart = year || "general";
  const lessonPart = lesson || "general";
  const typePart = resourceType || "other";
  const subjPart = subject ? subject.toUpperCase() : "GENERAL";

  let storagePath = `rag_uploads/${uid}/${sourceId}/${fileName}`;

  if (sourceScope === "owner_syllabus") {
    storagePath = `users/${uid}/syllabus/${subjPart}/${typePart}/${yearPart}/${sourceId}/${fileName}`;
  } else if (sourceScope === "past_paper") {
    storagePath = `users/${uid}/past_papers/${subjPart}/${typePart}/${yearPart}/${sourceId}/${fileName}`;
  } else if (sourceScope === "paper_structure") {
    storagePath = `users/${uid}/paper_structure/${subjPart}/${lessonPart}/${sourceId}/${fileName}`;
  } else if (sourceScope === "owner_knowledge") {
    storagePath = `users/${uid}/knowledge/${sourceType || "other"}/${yearPart}/${sourceId}/${fileName}`;
  }

  if (import.meta.env.DEV) {
    console.info("[clientStorageUpload] Preparing upload", { storagePath, size: file.size });
  }

  const storageRef = ref(storage, storagePath);
  await new Promise<void>((resolve, reject) => {
    const task = uploadBytesResumable(storageRef, file, {
      contentType: file.type || "application/pdf",
      customMetadata: {
        ownerUid: uid,
        sourceId,
        subject: subjPart,
        lesson: lessonPart,
        resourceType: typePart,
        sourceScope: sourceScope || "chat_upload",
      },
    });
    onTask?.({ pause: () => task.pause(), resume: () => task.resume(), cancel: () => task.cancel() });
    task.on(
      "state_changed",
      (snapshot) => onProgress?.({
        bytesTransferred: snapshot.bytesTransferred,
        totalBytes: snapshot.totalBytes,
        progress: snapshot.totalBytes > 0 ? snapshot.bytesTransferred / snapshot.totalBytes : 0,
        state: snapshot.state === "paused" ? "paused" : "running",
      }),
      (error: any) => {
        onProgress?.({ bytesTransferred: 0, totalBytes: file.size, progress: 0, state: error?.code === "storage/canceled" ? "canceled" : "error" });
        reject(error);
      },
      () => {
        onProgress?.({ bytesTransferred: file.size, totalBytes: file.size, progress: 1, state: "success" });
        resolve();
      },
    );
  });
  // Persist the Firebase token URL alongside metadata. The backend validates
  // that it resolves to this exact object before using it, then falls back to
  // Admin Storage. This avoids repeat failures when the Vercel service account
  // can read Firestore but temporarily lacks Storage object IAM.
  let downloadUrl = "";
  try {
    downloadUrl = await getDownloadURL(storageRef);
  } catch (error) {
    // The upload itself is already complete. Some Storage rule sets allow the
    // write but do not expose a token URL to the client. Keep the upload valid;
    // the backend can still use Admin Storage as a secondary path.
    if (import.meta.env.DEV) console.warn("[clientStorageUpload] Download URL unavailable", error);
  }
  return { sourceId, storagePath, downloadUrl };
}

export async function uploadFileWithClientStorage(args: Parameters<typeof uploadPdfWithClientStorage>[0]) {
  return uploadPdfWithClientStorage(args);
}

export async function uploadImageWithClientStorage({
  file,
  subject,
  onProgress,
  onTask,
}: {
  file: File;
  subject?: string;
  onProgress?: (snapshot: UploadProgressSnapshot) => void;
  onTask?: (controls: UploadTaskControls) => void;
}) {
  const user = auth.currentUser;
  if (!user || user.isAnonymous) {
    throw new Error("Please sign in before uploading images.");
  }
  const uid = user.uid;
  const sourceId = crypto.randomUUID();
  const fileName = safeFileName(file.name);
  const subjPart = subject ? subject.toUpperCase() : "GENERAL";

  const storagePath = `users/${uid}/images/${subjPart}/${sourceId}/${fileName}`;

  if (import.meta.env.DEV) {
    console.info("[clientStorageUpload] Preparing image upload", { storagePath, size: file.size });
  }

  const storageRef = ref(storage, storagePath);
  await new Promise<void>((resolve, reject) => {
    const task = uploadBytesResumable(storageRef, file, {
      contentType: file.type || "image/png",
      customMetadata: {
        ownerUid: uid,
        sourceId,
        subject: subjPart,
        sourceScope: "images",
      },
    });
    onTask?.({ pause: () => task.pause(), resume: () => task.resume(), cancel: () => task.cancel() });
    task.on(
      "state_changed",
      (snapshot) => onProgress?.({
        bytesTransferred: snapshot.bytesTransferred,
        totalBytes: snapshot.totalBytes,
        progress: snapshot.totalBytes > 0 ? snapshot.bytesTransferred / snapshot.totalBytes : 0,
        state: snapshot.state === "paused" ? "paused" : "running",
      }),
      (error: any) => {
        onProgress?.({ bytesTransferred: 0, totalBytes: file.size, progress: 0, state: error?.code === "storage/canceled" ? "canceled" : "error" });
        reject(error);
      },
      () => {
        onProgress?.({ bytesTransferred: file.size, totalBytes: file.size, progress: 1, state: "success" });
        resolve();
      },
    );
  });
  return { sourceId, storagePath };
}

export async function openPrivateStoragePdf(storagePath: string) {
  try {
    const url = await getDownloadURL(ref(storage, storagePath));
    window.open(url, "_blank", "noopener,noreferrer");
  } catch (e) {
    console.warn("Failed to get download URL for", storagePath, e);
  }
}

export async function deletePrivateStorageObject(storagePath: string) {
  const user = auth.currentUser;
  if (!user || user.isAnonymous) {
    throw new Error("Please sign in to delete files.");
  }
  const uid = user.uid;

  if (!storagePath.startsWith(`users/${uid}/`) && !storagePath.startsWith(`rag_uploads/${uid}/`)) {
    throw new Error("UNAUTHORIZED_STORAGE_PATH");
  }

  try {
    await deleteObject(ref(storage, storagePath));
    return { ok: true };
  } catch (e: any) {
    if (e.code === 'storage/object-not-found') {
      return { ok: true };
    }
    throw e;
  }
}
export async function uploadAttachmentWithClientStorage({
  file,
  subject,
  sourceScope,
  onProgress,
  onTask,
}: {
  file: File;
  subject?: string;
  sourceScope?: string;
  onProgress?: (snapshot: UploadProgressSnapshot) => void;
  onTask?: (controls: UploadTaskControls) => void;
}) {
  const user = auth.currentUser;
  if (!user || user.isAnonymous) {
    throw new Error("Please sign in before uploading files.");
  }
  const uid = user.uid;
  const sourceId = crypto.randomUUID();
  const fileName = safeFileName(file.name);
  const subjPart = subject ? subject.toUpperCase() : "GENERAL";

  let attachmentType = "other";
  if (file.type.startsWith("video/")) attachmentType = "video";
  else if (file.type.startsWith("audio/")) attachmentType = "audio";
  else if (file.type.startsWith("image/")) attachmentType = "image";
  else if (file.type.startsWith("text/")) attachmentType = "text";
  else if (file.type === "application/pdf") attachmentType = "pdf";

  let storagePath = `users/${uid}/attachments/${subjPart}/${attachmentType}/${sourceId}/${fileName}`;

  const storageRef = ref(storage, storagePath);
  await new Promise<void>((resolve, reject) => {
    const task = uploadBytesResumable(storageRef, file, {
      contentType: file.type || "application/octet-stream",
      customMetadata: {
        ownerUid: uid,
        sourceId,
        subject: subjPart,
        attachmentType,
        sourceScope: sourceScope || "chat_upload",
      },
    });
    onTask?.({ pause: () => task.pause(), resume: () => task.resume(), cancel: () => task.cancel() });
    task.on(
      "state_changed",
      (snapshot) => onProgress?.({
        bytesTransferred: snapshot.bytesTransferred,
        totalBytes: snapshot.totalBytes,
        progress: snapshot.totalBytes > 0 ? snapshot.bytesTransferred / snapshot.totalBytes : 0,
        state: snapshot.state === "paused" ? "paused" : "running",
      }),
      (error: any) => {
        onProgress?.({
          bytesTransferred: 0,
          totalBytes: file.size,
          progress: 0,
          state: error?.code === "storage/canceled" ? "canceled" : "error",
        });
        reject(error);
      },
      () => {
        onProgress?.({ bytesTransferred: file.size, totalBytes: file.size, progress: 1, state: "success" });
        resolve();
      },
    );
  });
  return { sourceId, storagePath, attachmentType, mimeType: file.type };
}
