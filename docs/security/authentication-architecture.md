# Authentication Architecture

This document describes the unified, production-grade Firebase Authentication architecture implemented in Clora X (Section 02).

## 1. Core Principles

- **Single Source of Truth**: All authentication is verified and managed exclusively on the server side using the official Firebase Admin SDK.
- **Canonical UID Identity**: The unique user identifier (`uid`) provided by Firebase is the only immutable, canonical identifier used throughout all databases, filesystems, and logical access guards.
- **No Email-Based Authorization**: Under no circumstances does a user's email address grant admin, teacher, reviewer, or ops permissions. All roles must be server-owned and verified.

## 2. Shared Security Contracts

The server enforces a single canonical `AuthContext` schema defined under `server/utils/authContext.ts`:

```typescript
export type AppRole =
  | "student"
  | "teacher"
  | "content_editor"
  | "reviewer"
  | "ops"
  | "admin";

export type AuthContext = {
  uid: string;
  email?: string;
  roles: AppRole[];
  isAnonymous: boolean;
  tokenIssuedAt?: number;
  authTime?: number;
};
```

## 3. Token Verification Flow

1. Every protected request includes a `Authorization: Bearer <ID_TOKEN>` header.
2. The `requireFirebaseUser` middleware intercepts the request.
3. The server extracts the bearer token and passes it to `admin.auth().verifyIdToken()`.
4. Upon successful validation, the server loads user roles from:
   - **Custom claims** attached directly to the verified token, or
   - **Firestore collection `user_roles/{uid}`**, which is writable only by administrative services.
5. A sanitized `AuthContext` object is computed, attached to `req.authContext`, and made available to all downstream route handlers.

## 4. Role Revocation & Refresh Behavior

- Since Custom Claims can be cached client-side for up to 1 hour, Firestore `user_roles` acts as the immediate, real-time authority.
- When an administrator modifies or removes a user's role:
  1. The server updates the Firestore role document `/user_roles/{userId}` immediately.
  2. Any sub-second backend checks fetch the Firestore document directly, forcing role changes to take effect instantly.
  3. All authorization state updates produce an audited security record in the immutable audit logging system.
