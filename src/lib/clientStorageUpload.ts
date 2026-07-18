import { deleteObject, getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
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

const SHARED_SCOPES = new Set(["paper_structure", "past_paper", "owner_syllabus", "shared_lesson", "official"]);

export {
  effectiveMimeType,
  safeFileName,
  validateFileSignature,
  validatePersonalAssistantFile,
} from "./uploadValidation";
import {
  effectiveMimeType,
  isPersonalImageType,
  safeFileName,
  validateFileSignature,
  validatePersonalAssistantFile,
  validateSharedResourceFile,
} from "./uploadValidation";

async function uploadValidatedFile(params: {
  file: File;
  storagePath: string;
  metadata: Record<string, string>;
  contentType: string;
  onProgress?: (snapshot: UploadProgressSnapshot) => void;
  onTask?: (controls: UploadTaskControls) => void;
}) {
  const { file, storagePath, metadata, contentType, onProgress, onTask } = params;
  const storageRef = ref(storage, storagePath);
  await new Promise<void>((resolve, reject) => {
    const task = uploadBytesResumable(storageRef, file, { contentType, customMetadata: metadata });
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
}

export async function uploadPdfWithClientStorage({
  file,
  subject,
  lesson,
  resourceType,
  year,
  sourceScope = "chat_upload",
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
  if (!user || user.isAnonymous) throw new Error("Please sign in before uploading files.");

  const validation = SHARED_SCOPES.has(sourceScope)
    ? validateSharedResourceFile(file)
    : validatePersonalAssistantFile(file);
  await validateFileSignature(file, validation.mimeType);

  const uid = user.uid;
  const sourceId = crypto.randomUUID();
  const fileName = safeFileName(file.name);
  const yearPart = year || "general";
  const lessonPart = lesson || "general";
  const typePart = resourceType || (validation.kind === "pdf" ? "uploaded_pdf" : "image");
  const subjectPart = subject ? subject.toUpperCase() : "GENERAL";

  let storagePath = `rag_uploads/${uid}/${sourceId}/${fileName}`;
  if (sourceScope === "owner_syllabus") {
    storagePath = `users/${uid}/syllabus/${subjectPart}/${typePart}/${yearPart}/${sourceId}/${fileName}`;
  } else if (sourceScope === "past_paper") {
    storagePath = `users/${uid}/past_papers/${subjectPart}/${typePart}/${yearPart}/${sourceId}/${fileName}`;
  } else if (["paper_structure", "shared_lesson", "official"].includes(sourceScope)) {
    storagePath = `users/${uid}/paper_structure/${subjectPart}/${lessonPart}/${sourceId}/${fileName}`;
  } else if (sourceScope === "owner_knowledge") {
    storagePath = `users/${uid}/knowledge/${sourceType || "other"}/${yearPart}/${sourceId}/${fileName}`;
  }

  await uploadValidatedFile({
    file,
    storagePath,
    contentType: validation.mimeType,
    metadata: {
      ownerUid: uid,
      sourceId,
      subject: subjectPart,
      lesson: lessonPart,
      resourceType: typePart,
      sourceType: sourceType || typePart,
      sourceScope,
    },
    onProgress,
    onTask,
  });
  return { sourceId, storagePath, mimeType: validation.mimeType, attachmentType: validation.kind };
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
  validatePersonalAssistantFile(file);
  if (!isPersonalImageType(effectiveMimeType(file))) throw new Error("Only PNG, JPEG, and WebP images are allowed.");
  await validateFileSignature(file, effectiveMimeType(file));
  const user = auth.currentUser;
  if (!user || user.isAnonymous) throw new Error("Please sign in before uploading images.");
  const sourceId = crypto.randomUUID();
  const subjectPart = subject ? subject.toUpperCase() : "GENERAL";
  const storagePath = `users/${user.uid}/images/${subjectPart}/${sourceId}/${safeFileName(file.name)}`;
  await uploadValidatedFile({
    file,
    storagePath,
    contentType: effectiveMimeType(file),
    metadata: { ownerUid: user.uid, sourceId, subject: subjectPart, sourceScope: "images" },
    onProgress,
    onTask,
  });
  return { sourceId, storagePath };
}

export async function uploadAttachmentWithClientStorage(args: Parameters<typeof uploadPdfWithClientStorage>[0]) {
  // Kept for compatibility. This path deliberately applies the same strict
  // personal-attachment policy and can no longer upload arbitrary media.
  return uploadPdfWithClientStorage({ ...args, sourceScope: "chat_upload" });
}

export async function openPrivateStoragePdf(storagePath: string) {
  try {
    const url = await getDownloadURL(ref(storage, storagePath));
    window.open(url, "_blank", "noopener,noreferrer");
  } catch (error) {
    console.warn("Failed to get a download URL for", storagePath, error);
  }
}

export async function deletePrivateStorageObject(storagePath: string) {
  const user = auth.currentUser;
  if (!user || user.isAnonymous) throw new Error("Please sign in to delete files.");
  if (!storagePath.startsWith(`users/${user.uid}/`) && !storagePath.startsWith(`rag_uploads/${user.uid}/`)) {
    throw new Error("UNAUTHORIZED_STORAGE_PATH");
  }
  try {
    await deleteObject(ref(storage, storagePath));
    return { ok: true };
  } catch (error: any) {
    if (error.code === "storage/object-not-found") return { ok: true };
    throw error;
  }
}
