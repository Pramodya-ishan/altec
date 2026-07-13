# Source Registry v2 Architecture

## Motivation
Clora X previously used fragmented source identities (e.g., separate collections for `past_papers`, `rag_sources`, and `syllabus_nodes`). This version unifies all educational and user resources into a single canonical registry to ensure consistent authorization, versioning, and discovery.

## Canonical Field Meanings

| Field | Meaning |
| :--- | :--- |
| `sourceId` | Immutable unique identifier for the resource. |
| `ownerUid` | Verified Firebase UID of the resource creator. |
| `sha256` | Authoritative content hash for deduplication and integrity. |
| `displayTitle` | Human-readable title for UI. |
| `originalFileName` | Preserved filename from the original upload (including Unicode/Sinhala). |
| `normalizedName` | Lowercase, whitespace-normalized searchable name. |
| `normalizedStem` | `normalizedName` without extension for fuzzy matching. |
| `sourceVersion` | Incremented only when the underlying bytes (SHA-256) change. |
| `processingVersion` | Incremented when backend extraction/OCR logic is updated. |

## Storage Object Identity
Storage paths are decoupled from display names to prevent collisions and path injection.
Recommended path: `sources/{ownerUid}/{sourceId}/original`

## Processing States & Transitions
The system uses a strictly validated state machine for processing:
- `uploaded` → `queued` → `validating` → `extracting` → `ready`
- Failure path: Any active state can move to `failed`.
- Completion is server-owned; clients cannot mark a source `ready`.

## Trusted vs. Client-Writable Fields
- **Client-Writable**: `notebookIds`, `visibility`, `displayTitle`, `academicMetadata` (subject, year).
- **Server-Owned**: `sha256`, `sourceVersion`, `processingStatus`, `chunkCount`, `authority`, `verifiedBy`.

## Legacy Field Mapping (Part 03B)
- `id` → `sourceId`
- `fileName` → `originalFileName`
- `status` → `processingStatus`
- `uploadedByUid` → `ownerUid`
