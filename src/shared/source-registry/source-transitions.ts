import { ProcessingStatus } from "./source.types";

/**
 * Validates if a processing state transition is legal.
 */
export function isValidProcessingTransition(
  from: ProcessingStatus,
  to: ProcessingStatus
): boolean {
  // Global path to failure
  if (to === "failed") return true;
  
  // Global path to deletion
  if (to === "deleted") return true;

  const transitions: Record<ProcessingStatus, ProcessingStatus[]> = {
    uploaded: ["queued", "failed", "deleted"],
    queued: ["validating", "failed", "deleted"],
    validating: ["extracting", "transcoding", "failed", "deleted"],
    extracting: ["ready", "ocr_required", "legacy_conversion_required", "failed", "deleted"],
    legacy_conversion_required: ["legacy_conversion_running", "failed", "deleted"],
    legacy_conversion_running: ["indexing", "failed", "deleted"],
    ocr_required: ["ocr_running", "failed", "deleted"],
    ocr_running: ["indexing", "failed", "deleted"],
    transcoding: ["transcribing", "indexing", "ready", "failed", "deleted"],
    transcribing: ["indexing", "failed", "deleted"],
    indexing: ["ready", "failed", "deleted"],
    ready: ["source_missing", "queued", "deleted"],
    failed: ["queued", "deleted"],
    unsupported: ["deleted"],
    source_missing: ["queued", "deleted"],
    deleted: [] // Cannot transition from deleted
  };

  return (transitions[from] || []).includes(to);
}
