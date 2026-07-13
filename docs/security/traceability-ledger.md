# Audit Traceability Ledger

This ledger acts as a traceability record linking findings discovered in Section 00 & 01 audits to our production remediation changes implemented in Section 02.

## Traceability Grid

| Finding ID | Title / Vulnerability | Root Cause | Section 02 Remediation Fix | Verification Method |
| :---: | :--- | :--- | :--- | :--- |
| **SEC-01** | Cross-User Access via `/api/data` | Accepting unverified emails in bodies/queries allowed reading/writing arbitrary user data. | Derived the active identity strictly from the verified Firebase UID, fully ignoring any client-provided target emails or target UIDs. | Integration and regression tests inside `scripts/run-security-tests.ts`. |
| **SEC-02** | Hard-coded Email Authorization | Literal comparison against email addresses (e.g. `26002ishan@gmail.com`) was used for administrative access. | Eradicated all literal email comparisons across components, controllers, and Firestore/Storage rules. Replaced with roles (`admin`, `teacher`, etc.) and capabilities. | Automated CI scanner test group in security test suite. |
| **SEC-03** | Missing Firestore Read/Write Rules | Generous permissive reads/writes allowed listing other users' notifications or profiles. | Restructured `/users/{userId}` to match nested notifications and profile collections explicitly. Restricted access to the verified owner UID or Admin. | Deployed updated Firestore rules; verified notifications list works seamlessly. |
| **SEC-04** | Client-side Role Forgery | Roles were trusted from client request bodies during user registration/updates. | Enforced roles purely on the server side using Custom Claims and Firestore `/user_roles` collection. Blocked writing of role fields by standard users. | Registry and payload validation checks inside `/api/data` POST handler. |
| **SEC-05** | Destructive Action Vulnerabilities | Arbitrary users could delete files if `uploaded === true` was true. | Tied delete authorization strictly to verified ownership and server-computed capabilities (`canDelete`). | Capability evaluation unit checks. |
| **SYS-03B** | Fragmented Source Registry | Sources were scattered across multiple legacy collections with inconsistent schemas. | Created `SourceRepository` with a canonical `sources` collection and legacy read-compatibility adapters. | Unit tests in `server/sources/__tests__/run-repo-tests.ts`. |
