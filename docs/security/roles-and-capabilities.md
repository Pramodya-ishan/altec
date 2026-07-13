# Roles and Capabilities

This document defines the Role Responsibilities Matrix and the server-computed Capability Calculation Model used to protect resources in Clora X.

## 1. Role Responsibilities Matrix

The system supports the following server-owned user roles:

| Role | Core Privileges / Allowed Actions | Restrictions |
| :--- | :--- | :--- |
| **Student** | Can view authorized public/shared sources, manage own private sources, query the AI, read own chat history. | Strictly cannot alter official sources, review answer caches, run diagnostic repairs, or change other users' roles. |
| **Teacher** | Can access teaching workflows, view institution-shared curriculum sources, manage class-level resources. | Does not inherit broad admin or systems operations privileges. |
| **Content Editor** | Can upload and manage curriculum-source metadata, publish institution-approved material. | Cannot edit user roles, access unrelated private user folders, or execute systems repairs. |
| **Reviewer** | Can review generated AI answer cache entries, approve/quarantine answers, review evidence conflicts. | Cannot modify roles, access unrelated private files, or edit database structures. |
| **Ops** | Can execute OCR processing, rebuild system indexes, reprocess sources, view system status diagnostics. | Cannot modify user roles or access private student files without an audited operational reason. |
| **Admin** | Has full system role management, access to secure administration dashboards, and audited support tools. | Actions are strictly rate-limited, logged, and audited. |

## 2. Server-Computed Capability Model

Instead of hardcoding role-based checks inside business logic or on frontend elements, the server computes a strict capability map (`SourceCapabilities`) dynamically:

```typescript
export type SourceCapabilities = {
  canView: boolean;
  canDownload: boolean;
  canAskAI: boolean;
  canDelete: boolean;
  canReprocess: boolean;
  canReindex: boolean;
  canRunOcr: boolean;
  canViewOcrText: boolean;
  canReviewCache: boolean;
  canRepairSource: boolean;
  canChangeVisibility: boolean;
  canEditMetadata: boolean;
};
```

These capabilities are recalculated on every protected request by the central authorization service based on:
1. The authenticated user's verified roles.
2. The target source's metadata (ownership `ownerUid`, `visibility` state, authority levels, processing state).
3. The specified operation policy.

Clients are forbidden from supplying capability flags as input. Capabilities returned by the API are strictly used for frontend rendering and UI control gating.
