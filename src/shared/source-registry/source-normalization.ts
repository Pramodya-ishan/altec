/**
 * Normalizes a filename or title into a searchable format while preserving Sinhala.
 */
export function normalizeFileName(fileName: string): {
  originalFileName: string;
  normalizedName: string;
  normalizedStem: string;
  extension?: string;
} {
  const original = fileName || "";
  
  // 1. Unicode NFKC normalization
  let normalized = original.normalize("NFKC");

  // 2. Trim leading/trailing whitespace
  normalized = normalized.trim();

  // 3. Extract extension and stem
  const lastDotIndex = normalized.lastIndexOf(".");
  let stem = normalized;
  let ext = "";
  
  if (lastDotIndex !== -1 && lastDotIndex !== 0) {
    stem = normalized.substring(0, lastDotIndex);
    ext = normalized.substring(lastDotIndex + 1);
  }

  // 4. Normalize stem
  let normalizedStem = stem
    .toLowerCase()
    // Replace underscores, hyphens, and repeated punctuation with spaces
    .replace(/[_\-\s]+/g, " ")
    // Remove decorative or repeated punctuation that isn't meaningful
    .replace(/[!@#$%^&*()=+[\]{}|;:'",<>?/\\]/g, "")
    // Collapse repeated internal whitespace
    .replace(/\s+/g, " ")
    .trim();

  // 5. Build normalizedName
  const normalizedName = ext ? `${normalizedStem}.${ext.toLowerCase()}` : normalizedStem;

  return {
    originalFileName: original,
    normalizedName,
    normalizedStem,
    extension: ext.toLowerCase() || undefined
  };
}

/**
 * Normalizes academic subject names into standard codes (e.g. "SFT", "ET", "ICT").
 */
export function normalizeSubject(subject?: string): string | undefined {
  if (!subject) return undefined;
  
  const s = subject.normalize("NFKC").trim().toLowerCase();
  
  // SFT
  if (s === "sft" || s.includes("science for technology") || s.includes("විද්‍යාව තාක්ෂණය සඳහා")) {
    return "SFT";
  }
  
  // ET
  if (s === "et" || s.includes("engineering technology") || s.includes("ඉංජිනේරු තාක්ෂණය")) {
    return "ET";
  }
  
  // ICT
  if (s === "ict" || s.includes("information and communication technology") || s.includes("තොරතුරු හා සන්නිවේදන තාක්ෂණය")) {
    return "ICT";
  }
  
  // Common variants
  if (s === "science" || s === "science for tech") return "SFT";
  if (s === "eng" || s === "eng tech") return "ET";
  
  return undefined; // Fail safely if unknown
}

/**
 * Normalizes resource roles into standard keys.
 */
export function normalizeResourceRole(role?: string): string | undefined {
  if (!role) return undefined;
  const s = role.toLowerCase().trim();
  
  if (s.includes("marking") || s.includes("answer") || s.includes("scheme")) return "marking_scheme";
  if (s.includes("past paper") || s.includes("question paper")) return "past_paper";
  if (s.includes("syllabus")) return "syllabus";
  if (s.includes("model")) return "model_paper";
  if (s.includes("note")) return "teacher_note";
  if (s.includes("textbook") || s.includes("book")) return "textbook";
  
  return undefined;
}
