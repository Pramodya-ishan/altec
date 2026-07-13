# Firestore Security Rules

This document details the Firestore Security Rules architecture deployed in Clora X (Section 02).

## 1. Safety-First Foundation

We employ a strict **"fail-closed"** default security rule to block all unmapped reads, writes, and list queries globally:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

## 2. Core Policies by Collection

### A. Users & Subcollections (`/users/{userId}`)
- **Read/Write Policy**: Restricted to the owner (`userId` equals `request.auth.uid` or verified token email) or authenticated system administrators.
- **Protection**: Users can read and write only their own profiles, progress, and notification documents.

### B. User Roles (`/user_roles/{userId}`)
- **Read Policy**: Any authenticated user can read role documents to verify collaboration context.
- **Write Policy**: Strictly restricted to `isAdmin()`. Role self-escalation is physically impossible.

### C. RAG Sources & Chunks (`/rag_sources/{id}`, `/rag_chunks/{id}`)
- **Read Policy**: Users can read sources if the visibility is `"public"`, `"official"`, `"shared"`, if the caller owns the source, or if the caller is an administrator.
- **Write Policy**: Creating documents requires the `ownerUid` field to match the authenticated user's verified UID. Deletions and updates are restricted to the owner or admins.

### D. Audit Logs (`/audit_events/{id}`)
- **Read Policy**: Restricted exclusively to system administrators.
- **Write Policy**: Any verified user can append an audit event (`create` only), but updating or deleting existing audit logs is strictly disabled (`allow update, delete: if false`).

## 3. Deployment Instructions

To apply these rules to the Firebase project environment, execute:
```bash
npm run deploy-rules
```
The deployment workflow has been automated through `deploy_firebase`.
