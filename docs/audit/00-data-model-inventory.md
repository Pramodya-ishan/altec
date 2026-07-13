# 00-data-model-inventory.md

## Firestore and Firebase Storage Inventory

This document maps all collections and inferred data structures identified within the Clora X Firestore database and Storage buckets during the Section 00 audit.

---

### 1. Firestore Collections

Based on code analysis of `AppContext.tsx`, `server/ai/routes.ts`, and Firestore rules:

#### Collection: `users`
*   **Key Strategy:** Email-based or UID-based string keys.
*   **Purpose:** Persisting user-level attributes, syllabus library access records, notifications, and custom preferences.
*   **Ownership Model:** Implicitly owned by the user matching the document key.
*   **Inconsistencies:** Widespread duplicate indexing. Some records write user data keyed by `email`, while others use `uid`.

#### Collection: `user_roles`
*   **Key Strategy:** UID-based string keys.
*   **Purpose:** Map users to specific admin or reviewer capabilities to bypass email allowlists.
*   **Ownership Model:** System-wide registry.

#### Collection: `rag_sources`
*   **Key Strategy:** Generated unique document UUIDs.
*   **Purpose:** Metadata registry describing uploaded PDFs, documents, or textbook resources available to the RAG system.
*   **Ownership Model:** Checked using the `owner_syllabus` flag or `owner` field.

#### Collection: `rag_chunks`
*   **Key Strategy:** Composite keys matching `sourceId_chunkIdx`.
*   **Purpose:** Raw text blocks and vectorized keywords used for retrieval grounding.

#### Collection: `past_papers`
*   **Key Strategy:** Subject code + Year + Medium string markers.
*   **Purpose:** Official exam registries including structured lists of PDF download locations and marking schemes.

#### Collection: `pdf_question_cache`
*   **Key Strategy:** Normalized subject, year, paper category, and question sequence identifier.
*   **Purpose:** Caching extracted and reviewed exact question assets to speed up retrieval.
*   **Inconsistencies:** The rule set allows wide global write permissions which must be limited.

---

### 2. Firebase Storage Layout

Storage object-path schemas identified inside the client and backend code:

*   **Public Resources:**
    *   `past_papers/{subject}/{year}/{fileName}` - Shared syllabus, question papers, and marking schemes.
*   **User/Private Attachments:**
    *   `users/{uid}/files/{fileName}` - Student-uploaded private resources.
    *   `users/{uid}/notebooks/{notebookId}/files/{fileName}` - Note attachments.
*   **Temporary Pipeline Files:**
    *   `temp/{sourceId}/{fileName}` - Incoming PDF streams awaiting OCR processing.
*   **OCR Derived Text:**
    *   `ocr/{sourceId}/text_pages.json` - Segmented page arrays containing bounding-box coordinates and localized Sinhala-Unicode segments.
