# Audit Logging

This document defines the schema, structure, and collection policy for all security-sensitive events in Clora X.

## 1. Capture Policy

Security auditing is enforced server-side. Sensitive actions trigger an immediate write to the `/audit_logs` collection in Firestore.

Sensitive operations that require auditing include:
- Role changes and role removals.
- Administrative support access.
- File and source deletions.
- Visibility state modifications (e.g., promoting a document to shared/official).
- Metadata overrides.
- Triggering high-cost operations (OCR jobs, source reindexing, and system-level database repairs).
- Unauthenticated or unauthorized access attempts to privileged routes.

## 2. Audit Event Schema

Every audit log entry contains:

| Field | Type | Description |
| :--- | :--- | :--- |
| `auditId` | String | Unique auto-generated identifier. |
| `actorUid` | String | Verified caller UID (from authentication token). |
| `actorRoles` | Array | Verified roles associated with the actor token. |
| `operation` | String | Literal name of action (e.g. `admin_view_user_data`, `unauthorized_role_attempt`). |
| `targetType` | String | Target entity classification (e.g., `user_data`, `source`, `role_guard`). |
| `targetId` | String | Identifier of target entity. |
| `reason` | String | Description or justification of action. |
| `result` | String | Outcome state (`success` or `failure`). |
| `timestamp` | String | ISO 8601 UTC timestamp. |

## 3. Redaction and Immutability

- **No Secrets**: Audit records must never include raw text, session cookies, Bearer tokens, or full file contents.
- **Write-Once Protection**: The Firestore Rules explicitly disable update and delete access for `/audit_logs`:
```javascript
match /audit_events/{id} {
  allow read: if isAdmin();
  allow create: if signedIn();
  allow update, delete: if false; // Immutable
}
```
Once recorded, logs cannot be manipulated by any user.
