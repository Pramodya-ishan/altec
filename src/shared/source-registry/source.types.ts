export type SourceVisibility =
  | "private"
  | "class"
  | "institution"
  | "public";

export type MediaKind =
  | "pdf"
  | "image"
  | "video"
  | "audio"
  | "text"
  | "document"
  | "web";

export type ResourceRole =
  | "past_paper"
  | "question_paper"
  | "marking_scheme"
  | "syllabus"
  | "textbook"
  | "teacher_note"
  | "student_note"
  | "model_paper"
  | "image"
  | "audio"
  | "video"
  | "external_link";

export type ProcessingStatus =
  | "uploaded"
  | "queued"
  | "validating"
  | "extracting"
  | "legacy_conversion_required"
  | "legacy_conversion_running"
  | "ocr_required"
  | "ocr_running"
  | "transcoding"
  | "transcribing"
  | "indexing"
  | "ready"
  | "failed"
  | "unsupported"
  | "source_missing"
  | "deleted";

export type SourceRecord = {
  sourceId: string;

  ownerUid: string;
  notebookIds: string[];
  visibility: SourceVisibility;

  displayTitle: string;
  originalFileName: string;
  normalizedName: string;
  normalizedStem: string;
  aliases: string[];

  sha256: string;
  sourceVersion: number;
  processingVersion: number;

  mimeType: string;
  mediaKind: MediaKind;
  resourceRole: ResourceRole;

  sizeBytes: number;
  pageCount?: number;
  durationMs?: number;

  subject?: string;
  year?: number;
  medium?: string;
  paperType?: string;
  paperPart?: string;
  syllabusVersion?: string;

  authority?: string;
  issuer?: string;
  verifiedAt?: string | number | null; // ISO string or timestamp
  verifiedBy?: string;

  storagePath: string;
  thumbnailPath?: string;
  transcriptPath?: string;
  hlsPrefix?: string;
  masterManifestPath?: string;

  processingStatus: ProcessingStatus;
  chunkCount: number;
  ocrQuality?: number;
  lastErrorCode?: string;

  createdAt: string | number; // ISO string or timestamp
  updatedAt: string | number;
  deletedAt?: string | number | null;

  migrationInfo?: {
    runId: string;
    legacyId: string;
    legacyCollection: string;
    migratedAt: number;
  };
};

export type SourceIdentity = {
  sourceId: string;
  sha256: string;
  sourceVersion: number;
  processingVersion: number;
};

export type SourceFileIdentity = {
  originalFileName: string;
  normalizedName: string;
  normalizedStem: string;
  aliases: string[];
};

export type SourceAcademicMetadata = {
  subject?: string;
  year?: number;
  medium?: string;
  paperType?: string;
  paperPart?: string;
  syllabusVersion?: string;
};

export type SourceProcessingSummary = {
  processingStatus: ProcessingStatus;
  chunkCount: number;
  pageCount?: number;
  durationMs?: number;
  ocrQuality?: number;
  lastErrorCode?: string;
};
