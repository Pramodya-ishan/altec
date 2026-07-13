# Storage Security Rules

This document outlines the security rules and directory separation implemented for Firebase Storage in Clora X.

## 1. Directory Separation

To prevent cross-user data leakage and coordinate access control, storage files are divided into strict namespaces:

```
/uploads/
  ├── users/
  │     └── {uid}/
  │           └── [private user uploads - read/write owned by UID]
  ├── official/
  │     └── [curriculum sources - writable only by content editors/admins]
  └── public/
        └── [public materials - globally readable, writable by admins]
```

## 2. Access Rules

- **Private Files**: Checked against `request.auth.uid == uid`. No foreign user can read or write these objects.
- **Official & Shared Files**: Read permissions are granted based on the user's role (Teachers, Editors, Admins) or explicit RAG sharing lists. Writes are strictly forbidden for standard students.
- **File Integrity & Safety**:
  - Size checks: Standard uploads are bounded dynamically (e.g. up to 25MB depending on resource type).
  - MIME type constraints: Banned executable binaries or broad bypass types (`application/octet-stream`). Standardizes on valid educational formats (`application/pdf`, `image/png`, `image/jpeg`).
  - Path overwrite protections: Prevents users from manipulating upload paths to overwrite other users' storage artifacts.
