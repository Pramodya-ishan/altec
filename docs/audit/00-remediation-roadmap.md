# 00-remediation-roadmap.md

## Prioritized Remediation Roadmap

This document maps the proposed phased plan for resolving the Clora X remediation backlog across subsequent implementation sessions.

---

### Phase 0 — Security and Incident Containment (P0 Blockers)
*   **Scope:**
    *   Revoke and rotate all tracked secrets.
    *   Remove `.dev.env.json` and similar files from version control and Git history.
    *   Introduce `.env.example` placeholders.
    *   Resolve cross-user read/write risk in `/api/data`.
    *   Eliminate all hard-coded email-based auth comparisons.
    *   Fix the permissive CORS policy.
    *   Close unauthenticated mock and paid model-test endpoints.
    *   Fix the linter warning in `useAIWorkflowStream.ts`.
*   **Dependency:** None. First priority.
*   **Risk:** Low. Essential for baseline security.

---

### Phase 1 — Correctness Foundation (P1)
*   **Scope:**
    *   Establish unified claims/roles in database or Firebase auth claims.
    *   Deploy server-enforced `canDelete`, `canReprocess`, and other capability matrices.
    *   Deploy Firestore rules and Cloud Storage rules updates.
    *   Add schema validation libraries (e.g. Zod or schema assertions) to all incoming API requests.
*   **Dependency:** Phase 0.
*   **Risk:** Medium. Requires careful Firebase rules validation.

---

### Phase 2 — AI and PDF Retrieval Repair (P2)
*   **Scope:**
    *   Remove the premature Sinhala fallback.
    *   Implement the full retrieval state machine.
    *   Support Unicode-normalized filename alias searches.
    *   Define exact page/range citation models and verification.
    *   Deploy the typed versioned SSE contract.
*   **Dependency:** Phase 1.
*   **Risk:** High. Rewriting `respondStream.ts` requires extensive automated integration tests.

---

### Phase 3 — Durable Processing & Resumable Uploads (P3)
*   **Scope:**
    *   Deploy a resumable one-byte client upload flow.
    *   Introduce content hashing and duplicate upload checks.
    *   Establish background job leases for OCR/indexing to survive container recycles.
    *   Provide real progress indicators.
*   **Dependency:** Phase 2.
*   **Risk:** High. Heavy asynchronous integration work.

---

### Phase 4 — Student UI Redesign & separation (P4)
*   **Scope:**
    *   Redesign the attachments modal (remove giant blank 85vh area, add drop-zone empty states and real previews).
    *   Hide administrative buttons from the student view.
    *   Implement the NotebookLM-style workspace (pinning sources, notes mapping).
*   **Dependency:** Phase 3.
*   **Risk:** Low-Medium. Front-end heavy, highly visual.
