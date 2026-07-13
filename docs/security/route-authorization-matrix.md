# Route Authorization Matrix

This matrix describes the access policies enforced for all backend API routes in Clora X.

## Route Enforcements

| Method | Route | Public | Student | Owner | Teacher | Editor | Reviewer | Ops | Admin | Guard / Notes |
| :---: | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **GET** | `/api/auth/context` | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | `requireFirebaseUser` (returns current user's capabilities) |
| **GET** | `/api/data` | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | `requireFirebaseUser` (strictly returns caller's own data based on verified UID) |
| **POST** | `/api/data` | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | `requireFirebaseUser` (strictly updates caller's own data based on verified UID) |
| **POST** | `/api/admin/support/data` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | `requireRole("admin")` (audited administrative impersonation) |
| **GET** | `/api/notifications` | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | `requireFirebaseUser` (returns user's notifications) |
| **POST** | `/api/notifications/trigger` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | `requireRole("admin")` + `adminLimiter` |
| **POST** | `/api/notifications/read` | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | `requireFirebaseUser` (allows user to mark notifications as read) |
| **POST** | `/api/notifications/delete` | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | `requireFirebaseUser` (allows user to delete own notifications) |
| **GET** | `/api/sources/inventory` | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | `requireUser` |
| **GET** | `/api/syllabus` | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | `requireFirebaseUser` |
| **POST** | `/api/syllabus` | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ✅ | `requireRole("teacher", "content_editor", "admin")` |
| **POST** | `/api/ai/model-test` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | `requireRole("admin")` + `adminLimiter` (Disabled in production) |

*Key:*
- **Public**: Unauthenticated access allowed.
- **Student**: Any authenticated student has general access.
- **Owner**: Action restricted to the specific user who uploaded/created the source.
- **Admin**: Complete system-wide administrative access.
