import { SourceRecord } from "./source.types";

/**
 * Logic for incrementing source and processing versions.
 */

/**
 * Returns a new version number if the source bytes (SHA-256) have changed.
 */
export function getUpdatedSourceVersion(
  oldRecord: SourceRecord,
  newSha256: string
): number {
  if (oldRecord.sha256 !== newSha256) {
    return oldRecord.sourceVersion + 1;
  }
  return oldRecord.sourceVersion;
}

/**
 * Returns a new processing version if the extraction logic has been updated.
 * (In a real system, this would be tied to a code version constant).
 */
export const CURRENT_PROCESSING_VERSION = 1;

export function shouldReprocess(record: SourceRecord): boolean {
  return record.processingVersion < CURRENT_PROCESSING_VERSION;
}
