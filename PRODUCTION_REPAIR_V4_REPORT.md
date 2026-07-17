# Production Repair V4

This build removes shared PDF upload and deletion controls from ordinary student accounts and enforces the same boundary on the server. Past papers and lesson resources now sort by administrator-controlled display priority first and original upload time second. Higher priority values appear earlier. Administrators and content managers can update priority directly from the Past Papers cards and Lesson Resources modal.

## Security boundary

Shared past-paper, lesson-resource, and syllabus upload/delete operations require a server-verified content-manager role: `admin`, `content_editor`, `teacher`, or `ops`. UI visibility is driven by API capabilities rather than editable client profile fields. Personal Assistant PDF/image attachments remain available to signed-in students and remain private.

## Ordering

The authoritative fields are `displayPriority`, `createdAt`, and `updatedAt`. Lists are ordered by `displayPriority DESC`, then `createdAt DESC`, then title. Existing `createdAt` values are preserved during metadata updates and processing upserts.

## Deployment note

Deploy `firestore.rules` and `storage.rules` with the application. Existing published files do not need to be re-uploaded; their missing priority defaults to `0`.
