# UID & Email Data Compatibility & Migration

This document outlines the transition plan and compatibility adapter designed to shift Clora X from legacy email-keyed records to the canonical, production-secure UID-keyed data model.

## 1. Problem Definition & Historical Baseline

Historically, student progress, profiles, and notifications were saved under user email addresses (e.g. `users/26002ishan@gmail.com/progress/data`). 
- **Security Vulnerability**: Using email addresses as document keys poses cross-user read/write risks if a client requests arbitrary email profiles or query parameters.
- **Privacy Standard**: Using emails in keys exposes PII and violates secure data design.

## 2. Dynamic Migration Adapter

To prevent data loss for existing students while enforcing a hard boundary for secure UID authorization, we implemented a real-time migration fallback inside the GET `/api/data` handler in `server.ts`:

1. **Step 1: Check Canonical Path**: The server attempts to read from `/users/{uid}/progress/data`.
2. **Step 2: Check Local UID Fallback**: If missing, it checks the root `/users/{uid}` document.
3. **Step 3: Legacy Fallback**: If still missing, the server checks the legacy `/users/{email}/progress/data` or `/users/{email}` documents.
4. **Step 4: Synchronous Migration**: If legacy data is discovered, the server automatically writes a combined, standardized object into the canonical `/users/{uid}/progress/data` path in a single atomic transaction.
5. **Step 5: Standardized Response**: Subsequent reads are immediately resolved through the canonical path with zero further overhead.

## 3. Data Schema Standards

All migrated user data maps emails strictly to metadata only:
- Canonical document path: `/users/{uid}/`
- Email is stored purely inside the document payload for informational display (e.g., `{ email: "26002ishan@gmail.com" }`).
- Authorization is exclusively determined by verifying the caller's immutable UID via `req.authContext.uid`.
