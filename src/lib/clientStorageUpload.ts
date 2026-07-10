import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";
import { auth, storage } from "./firebase";

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
}: {
  file: File;
  subject?: string;
  lesson?: string;
  resourceType?: string;
  year?: string;
  sourceScope?: string;
  sourceType?: string;
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

  // Debug logging as requested
  console.log("[clientStorageUpload] Preparing upload:", {
    uid: user.uid,
    email: user.email,
    isAnonymous: user.isAnonymous,
    storageBucket: storage?.app?.options?.storageBucket || "unknown",
    storagePath
  });

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
    task.on("state_changed", undefined, reject, () => resolve());
  });
  return { sourceId, storagePath };
}

export async function uploadFileWithClientStorage(args: Parameters<typeof uploadPdfWithClientStorage>[0]) {
  return uploadPdfWithClientStorage(args);
}

export async function uploadImageWithClientStorage({
  file,
  subject,
}: {
  file: File;
  subject?: string;
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

  console.log("[clientStorageUpload] Preparing image upload:", {
    uid: user.uid,
    email: user.email,
    isAnonymous: user.isAnonymous,
    storageBucket: storage?.app?.options?.storageBucket || "unknown",
    storagePath
  });

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
    task.on("state_changed", undefined, reject, () => resolve());
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
