import { z } from "zod";

export const SourceVisibilitySchema = z.enum([
  "private",
  "class",
  "institution",
  "public",
]);

export const MediaKindSchema = z.enum([
  "pdf",
  "image",
  "video",
  "audio",
  "text",
  "document",
  "web",
]);

export const ResourceRoleSchema = z.enum([
  "past_paper",
  "question_paper",
  "marking_scheme",
  "syllabus",
  "textbook",
  "teacher_note",
  "student_note",
  "model_paper",
  "image",
  "audio",
  "video",
  "external_link",
]);

export const ProcessingStatusSchema = z.enum([
  "uploaded",
  "queued",
  "validating",
  "extracting",
  "legacy_conversion_required",
  "legacy_conversion_running",
  "ocr_required",
  "ocr_running",
  "transcoding",
  "transcribing",
  "indexing",
  "ready",
  "failed",
  "unsupported",
  "source_missing",
  "deleted",
]);

export const SourceRecordSchema = z.object({
  sourceId: z.string().min(1),
  ownerUid: z.string().min(1),
  notebookIds: z.array(z.string()),
  visibility: SourceVisibilitySchema,

  displayTitle: z.string(),
  originalFileName: z.string().min(1),
  normalizedName: z.string(),
  normalizedStem: z.string(),
  aliases: z.array(z.string().trim().min(1)).max(50),

  sha256: z.string().regex(/^[a-f0-9]{64}$/i),
  sourceVersion: z.number().int().min(1),
  processingVersion: z.number().int().min(1),

  mimeType: z.string(),
  mediaKind: MediaKindSchema,
  resourceRole: ResourceRoleSchema,

  sizeBytes: z.number().int().min(0),
  pageCount: z.number().int().min(0).optional(),
  durationMs: z.number().int().min(0).optional(),

  subject: z.string().optional(),
  year: z.number().int().min(1900).max(2100).optional(),
  medium: z.string().optional(),
  paperType: z.string().optional(),
  paperPart: z.string().optional(),
  syllabusVersion: z.string().optional(),

  authority: z.string().optional(),
  issuer: z.string().optional(),
  verifiedAt: z.union([z.string(), z.number()]).nullish(),
  verifiedBy: z.string().optional(),

  storagePath: z.string().min(1),
  thumbnailPath: z.string().optional(),
  transcriptPath: z.string().optional(),
  hlsPrefix: z.string().optional(),
  masterManifestPath: z.string().optional(),

  processingStatus: ProcessingStatusSchema,
  chunkCount: z.number().int().min(0),
  ocrQuality: z.number().min(0).max(1).optional(),
  lastErrorCode: z.string().optional(),

  createdAt: z.union([z.string(), z.number()]),
  updatedAt: z.union([z.string(), z.number()]),
  deletedAt: z.union([z.string(), z.number()]).nullish(),
});

// Source Creation Input (Client-writable fields)
export const CreateSourceInputSchema = z.object({
  notebookIds: z.array(z.string()).optional().default([]),
  visibility: SourceVisibilitySchema.optional().default("private"),
  displayTitle: z.string().optional(),
  originalFileName: z.string().min(1),
  mediaKind: MediaKindSchema,
  resourceRole: ResourceRoleSchema,
  subject: z.string().optional(),
  year: z.number().int().min(1900).max(2100).optional(),
  medium: z.string().optional(),
  paperType: z.string().optional(),
  paperPart: z.string().optional(),
});

// Source Update Input
export const UpdateSourceInputSchema = z.object({
  notebookIds: z.array(z.string()).optional(),
  visibility: SourceVisibilitySchema.optional(),
  displayTitle: z.string().optional(),
  subject: z.string().optional(),
  year: z.number().int().min(1900).max(2100).optional(),
  medium: z.string().optional(),
  paperType: z.string().optional(),
  paperPart: z.string().optional(),
  // Note: sourceId, ownerUid, sha256, etc. are NOT allowed to be updated by client
});
