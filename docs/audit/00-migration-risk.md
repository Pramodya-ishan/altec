# 00-migration-risk.md

## Persisted Data and Schema Migration Risk Assessment

This document maps the structural variations in the existing Firestore database and evaluates the safe transition strategies for the upcoming remediation phases.

---

### 1. Database Schema Mappings

#### Schema: `users`
*   **Current State:** Dual key strategies:
    *   Some documents are keyed by standard Firebase `uid` (secure).
    *   Other documents are keyed by raw `email` (vulnerable/redundant).
*   **Inconsistencies:** Widespread duplicate saving. Field properties (such as roles, username, custom flags) vary in layout depending on whether they were created via anonymous flows, Google Sign-In, or legacy passwords.
*   **Migration Risk:** High. Moving completely to `uid` keys requires:
    *   Updating all queries to reference UID instead of email.
    *   Safely mapping existing email-based notes and mistake profiles to corresponding verified UIDs.
*   **Rollback Strategy:** Run duplicate dual-writing adapter logic during Phase 1 to support both keys before fully sunsetting email keys in Phase 4.

#### Schema: `videos` / `attachments` Array Inconsistencies
*   **Current State:** The legacy system stores uploaded files or PDF notes inside nested document properties named `videos`.
*   **Inconsistencies:** The `videos` array contains non-video objects (MIME type: `application/pdf`, `image/*`).
*   **Migration Risk:** Medium. Renaming fields without migrating records will break rendering of existing notes.
*   **Backward Compatibility:** Implement an adapter/resolver layer on both the client and server to map the legacy `videos` field into a generic `attachments` model.

#### Schema: `pdf_question_cache` / `question_cache`
*   **Current State:** Collection naming and keys are inconsistent (e.g., using `id`, `sourceId`, or custom generated string markers).
*   **Inconsistencies:** Inconsistent spelling of resource types and question markers.
*   **Migration Risk:** Low. Clean the schema to use canonical keys, keeping legacy fields available during the rollout.
