# 00-test-plan.md

## Automated and Manual Testing Strategy

This document details the planned automated and manual test cases designed to prove that the remediation phases resolve the backlog items while maintaining system integrity.

---

### 1. Unit Testing
*   **Filename Normalization:** Validate that Unicode strings, Sinhala words, punctuations, casing variations, and whitespaces map to consistent normalized file stems.
*   **Question Parser:** Table-driven test cases proving that `MCQ 1`, `mcq 01`, `q 1`, Sinhala digits, and localized ordinals map to a single canonical question identifier.
*   **Capability Calculator:** Test cases confirming that various roles (anonymous, student, reviewer, admin) map to correct backend capabilities (e.g., student has no `canDelete`, admin has all).

---

### 2. Integration Testing
*   **Authorization Controls:** Verify that directly calling endpoints like `/api/pdf/reprocess/:sourceId` or `/api/question-cache/:docId/resolve` as a standard student returns a clean `403 Forbidden` response.
*   **Cross-User Data Attack:** Test that sending random UIDs/emails in `/api/data` requests is rejected or only accesses the authentic caller's private profile.
*   **SSE Contract Validation:** Confirm that the SSE stream outputs correctly formatted, ordered stages and ends with exactly one terminal event (either `completed`, `cancelled`, or `failed`).

---

### 3. Firebase Emulator Rule Testing
*   **Firestore Rules:** Write and execute local tests for the `pdf_question_cache`, `rag_sources`, and `users` collections confirming role restrictions.
*   **Storage Rules:** Confirm that unauthenticated users cannot read or write private user folders, and that only owner UIDs can modify their files.

---

### 4. End-to-End (E2E) Testing
*   **Full Retrieval Cycle:** Student uploads a past-paper PDF → parsing/indexing runs successfully → student queries a specific question by filename → system resolves the file, retrieves page context, and renders a cited answer.
*   **No Unrelated PDF Fallback:** Verify that asking for a non-existent PDF does not silently fall back to the latest uploaded document.
