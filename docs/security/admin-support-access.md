# Administrative Support & Impersonation

This document details the secure administrative support workflow designed to prevent silent or unauthorized access to student profiles in Clora X.

## 1. Zero-Impersonation Principal

- Admins are forbidden from silently impersonating users by changing client-side cookie files or query parameters.
- There is no custom code that alters the admin's verified authenticated token identity.

## 2. Secure Impersonation Endpoints

All support requests are routed through a dedicated administrative route:
- **Endpoint**: `POST /api/admin/support/data`
- **Guard**: `requireFirebaseUser`, `requireRole("admin")`, and `adminLimiter` (strict rate limiting: 5 requests per 1 minute).

### Required Parameters
Every request must supply:
```json
{
  "targetUid": "7kUEmzikv8hat7KQg8pCNGR1ZUd2",
  "operation": "view" | "edit",
  "reason": "Support Ticket #12847 - Investigating progress sync lag",
  "data": { ... } // Required only for edit
}
```

## 3. Mandatory Audit Trail

Every invocation of administrative access executes a transaction that writes to the immutable `/audit_logs` collection. This record includes:
- `adminUid` (derived from verified ID token)
- `targetUid`
- `operation` (view / edit)
- `reason` (must be non-empty)
- `timestamp`
- `result` (success / failure)

If the audit log cannot be successfully recorded, the transaction fails closed, and access to target data is denied.
