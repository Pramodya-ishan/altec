# Legacy Source Compatibility & Mapping

This document outlines the strategy for ensuring backward compatibility between the new Clora X Canonical Source Registry (v2) and the existing legacy source collections.

## 1. Compatibility Adapter Architecture

To prevent breaking existing workflows while the system transitions, we have implemented a **Read-Compatibility Adapter** inside the `SourceRepository`.

### How it works:
1. **Canonical-First Lookups**: Every request for a source by ID first checks the new `sources` collection.
2. **Transparent Fallback**: If the record is not found in the canonical collection, the adapter checks a pre-defined set of legacy collections:
   - `rag_sources` (User-uploaded materials)
   - `past_papers` (Official curriculum data)
3. **Normalization (On-the-Fly)**: If a legacy record is found, an isolated converter function transforms it into a standard `SourceRecord` DTO.
4. **Authorization Injection**: The converted legacy record is passed through the same server-side capability and authorization logic as canonical records.

## 2. Field Mapping Reference

| Canonical Field (v2) | Legacy Field (RAG) | Legacy Field (Past Papers) | Default/Fallback Behavior |
| :--- | :--- | :--- | :--- |
| `sourceId` | `docId` | `docId` | Immutable from original record. |
| `ownerUid` | `uploadedByUid` | `ownerUid` | Defaults to `legacy_system` or `official_curriculum`. |
| `originalFileName` | `fileName` | `fileName` | Used as the source of truth for display if title is missing. |
| `visibility` | `isPublic` | `visibility` | `isPublic: true` maps to `public`; `false` to `private`. |
| `mediaKind` | `type` | `type` | Defaults to `pdf` if missing. |
| `resourceRole` | `type` | `type` | Mapped to standard roles (e.g. `past_paper`, `marking_scheme`). |
| `sha256` | `hash` | `sha256` | Defaults to `legacy_pending` if missing. |

## 3. Security Constraints

- **Read-Only Compatibility**: The legacy adapter is strictly for reading. Any updates to a source will force the creation of a new canonical record or require an explicit migration step.
- **No Email-Based Ownership**: The adapter does not derive ownership from emails. It uses verified UIDs where available.
- **Fail-Closed Authorization**: If a legacy record lacks sufficient metadata to determine visibility or ownership, the adapter defaults to the most restrictive access policy.

## 4. Migration Timeline

Legacy compatibility will be maintained throughout the Section 03–12 rebuild. Complete removal of legacy collections will only occur after Section 12 validation passes.
