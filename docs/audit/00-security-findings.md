# 00-security-findings.md

## Security Audit and Vulnerability Assessment

This document maps out high-severity and critical security defects identified during the Section 00 audit of Clora X.

---

### Critical Findings (Severity: CRITICAL)

#### 1. Credential Exposure via Git Tracking
*   **File Path:** `.dev.env.json` (also referenced in backup and test files)
*   **Description:** The repository contains live API keys, Firebase Admin service-account keys, and cryptographic encryption keys in tracked files.
*   **Impact:** Complete administrative compromise of the underlying Firebase project, Cloud Storage bucket, and Gemini API quotas.
*   **Remediation:** Remove and rotate all credentials immediately. Place placeholder variables only in `.env.example`.

#### 2. Cross-User Data Access (Broken Object Level Authorization)
*   **File Path:** `/server.ts` - `/api/data` endpoint.
*   **Description:** The endpoint accepts an arbitrary user email via query-string or request payload and reads or writes that user's data from the DB without comparing it against the caller's verified auth context.
*   **Impact:** Normal students can read, update, or clear other students' private study notes, profiles, and mistakes.
*   **Remediation:** Derive the target UID directly from the verified decoded JWT token.

#### 3. Hard-Coded Administrative Emails
*   **File Paths:** `src/components/layout/Sidebar.tsx`, `server/ai/routes.ts`, `server/syllabus/routes.ts`, `server/ai/respondStream.ts`
*   **Description:** Admin privileges are assigned directly to emails like `26002ishan@gmail.com` and `ishanstc123@gmail.com` in code files.
*   **Impact:** Privilege escalation risk. If a normal student signs in with one of these emails (e.g. by setting a corresponding custom provider domain or exploiting local account creation), they gain immediate administrative capabilities.
*   **Remediation:** Establish database-backed roles/claims and capability matrices.

---

### High Findings (Severity: HIGH)

#### 4. Permissive CORS policy
*   **File Path:** `/server.ts`
*   **Description:** Server-wide CORS is configured to reflect `origin: true` (mirroring any incoming origin header) while simultaneously enabling credentials.
*   **Impact:** Any malicious third-party website visited by a student can run cross-site queries and steal confidential study profiles or chat traces.
*   **Remediation:** Hard-code an environment-derived CORS origin allowlist.

#### 5. Unauthenticated Mock / Paid Endpoints
*   **File Path:** `/server.ts`, `server/ai/routes.ts`
*   **Description:** Paid model test endpoints (`/api/ai/model-test`) and unauthenticated routes are exposed globally without rate limits.
*   **Impact:** Malicious actors can call endpoints repeatedly to exhaust the project's credit quotas.
*   **Remediation:** Introduce strict rate-limiting middleware and administrative guards.
