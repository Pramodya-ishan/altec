const PERSONAL_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const MB = 1024 * 1024;

export function safeFileName(name: string) {
  return String(name || "file")
    .replace(/(\.[a-z0-9]{2,5})(?:\1)+$/i, "$1")
    .replace(/[^\w.\-]+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 120);
}

export function effectiveMimeType(file: Pick<File, "type" | "name">) {
  if (file.type) return file.type.toLowerCase();
  if (file.name.toLowerCase().endsWith(".pdf")) return "application/pdf";
  return "";
}

function startsWithBytes(bytes: Uint8Array, signature: readonly number[], offset = 0) {
  return signature.every((value, index) => bytes[offset + index] === value);
}

export async function validateFileSignature(file: File, mimeType = effectiveMimeType(file)) {
  const header = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  let valid = false;

  if (mimeType === "application/pdf") {
    valid = startsWithBytes(header, [0x25, 0x50, 0x44, 0x46, 0x2d]);
  } else if (mimeType === "image/png") {
    valid = startsWithBytes(header, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  } else if (mimeType === "image/jpeg") {
    valid = startsWithBytes(header, [0xff, 0xd8, 0xff]);
  } else if (mimeType === "image/webp") {
    valid = startsWithBytes(header, [0x52, 0x49, 0x46, 0x46])
      && startsWithBytes(header, [0x57, 0x45, 0x42, 0x50], 8);
  }

  if (!valid) {
    throw new Error("The selected file content does not match its declared PDF or image type.");
  }
}

export function validatePersonalAssistantFile(file: File) {
  const mimeType = effectiveMimeType(file);
  const isPdf = mimeType === "application/pdf";
  const isImage = PERSONAL_IMAGE_TYPES.has(mimeType);
  if (!isPdf && !isImage) throw new Error("Only PDF, PNG, JPEG, and WebP files are allowed.");
  const maxBytes = isPdf ? 25 * MB : 10 * MB;
  if (!Number.isFinite(file.size) || file.size <= 0 || file.size > maxBytes) {
    throw new Error(`The selected ${isPdf ? "PDF" : "image"} exceeds the ${isPdf ? "25 MB" : "10 MB"} limit.`);
  }
  return { mimeType, kind: isPdf ? "pdf" as const : "image" as const };
}

export function validateSharedResourceFile(file: File) {
  const mimeType = effectiveMimeType(file);
  const isPdf = mimeType === "application/pdf";
  const isImage = PERSONAL_IMAGE_TYPES.has(mimeType);
  if (!isPdf && !isImage) {
    throw new Error("Shared lesson resources must be PDF, PNG, JPEG, or WebP files. Use the secure video uploader for video.");
  }
  const maxBytes = isPdf ? 50 * MB : 20 * MB;
  if (!Number.isFinite(file.size) || file.size <= 0 || file.size > maxBytes) {
    throw new Error(`The shared resource exceeds the ${isPdf ? "50 MB" : "20 MB"} limit.`);
  }
  return { mimeType, kind: isPdf ? "pdf" as const : "image" as const };
}

export function isPersonalImageType(mimeType: string) {
  return PERSONAL_IMAGE_TYPES.has(mimeType);
}
