import { getAdminDb } from "../firebase/admin";

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
  classIds?: string[];
  institutionIds?: string[];
  tokenIssuedAt?: number;
  authTime?: number;
};

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

/**
 * Computes capabilities for a given user and source.
 */
export function computeSourceCapabilities(
  auth: AuthContext,
  source: {
    ownerUid?: string;
    visibility?: "private" | "shared" | "official" | "public" | "class" | "institution";
    classId?: string;
    institutionId?: string;
    published?: boolean;
    sourceScope?: string;
    resourceType?: string;
    authority?: string;
    status?: string;
  }
): SourceCapabilities {
  const isOwner = source.ownerUid === auth.uid;
  const isAdmin = auth.roles.includes("admin");
  const isOps = auth.roles.includes("ops");
  const isEditor = auth.roles.includes("content_editor");
  const isReviewer = auth.roles.includes("reviewer");
  const isTeacher = auth.roles.includes("teacher");

  const visibility = source.visibility || "private";
  const isPublicOrOfficial = visibility === "public" || visibility === "official";
  const isShared = visibility === "shared";
  const hasClassAccess = visibility === "class"
    && Boolean(source.classId)
    && (auth.classIds || []).includes(String(source.classId));
  const hasInstitutionAccess = visibility === "institution"
    && Boolean(source.institutionId)
    && (auth.institutionIds || []).includes(String(source.institutionId));
  const isPublished = source.published === true;
  const isPrivatePersonal = isOwner && visibility === "private" && !isPublished;

  // 1. canView
  // Owners can view, Admin/Ops can view everything, Editors/Teachers can view public/official/shared.
  // Students can view public/shared/own.
  let canView = false;
  if (isOwner || isAdmin || isOps) {
    canView = true;
  } else if (isPublished && (isPublicOrOfficial || isShared || hasClassAccess || hasInstitutionAccess)) {
    canView = true;
  }

  // 2. canDownload & canAskAI
  let canDownload = canView;
  let canAskAI = canView;

  // 3. canDelete
  // Only owner (if it's private user policy) can delete. Admins/Ops can delete any.
  // Let's enforce that students cannot delete official/public sources even if they think they own them.
  let canDelete = false;
  if (isAdmin || isOps) {
    canDelete = true;
  } else if (isPrivatePersonal) {
    canDelete = true;
  }

  // 4. canReprocess, canReindex, canRunOcr
  // Admins/Ops can do it anytime. Owners of private sources can do it for their own private sources.
  let canReprocess = false;
  let canReindex = false;
  let canRunOcr = false;

  if (isAdmin || isOps) {
    canReprocess = true;
    canReindex = true;
    canRunOcr = true;
  } else if (isPrivatePersonal) {
    canReprocess = true;
    canReindex = true;
    canRunOcr = true;
  }

  // 5. canViewOcrText
  // Raw OCR text may require a stronger capability than viewing (e.g. owner or ops/admin).
  let canViewOcrText = false;
  if (isAdmin || isOps || isOwner) {
    canViewOcrText = true;
  } else if (isPublicOrOfficial && (isEditor || isTeacher)) {
    canViewOcrText = true;
  }

  // 6. canReviewCache
  let canReviewCache = isAdmin || isReviewer;

  // 7. canRepairSource
  // Official/shared sources must not be repairable by ordinary students.
  let canRepairSource = isAdmin || isOps;
  if (isPrivatePersonal) {
    canRepairSource = true;
  }

  // 8. canChangeVisibility
  // Changing source visibility (e.g. promoting to public/official)
  const canManageContent = isAdmin || isOps || isEditor || isTeacher;
  const canChangeVisibility = canManageContent;

  // Owners may edit descriptive metadata on private personal uploads, but they
  // can never publish or promote them to a shared audience.
  let canEditMetadata = canManageContent;
  if (isOwner && visibility === "private" && source.published !== true) {
    canEditMetadata = true;
  }

  return {
    canView,
    canDownload,
    canAskAI,
    canDelete,
    canReprocess,
    canReindex,
    canRunOcr,
    canViewOcrText,
    canReviewCache,
    canRepairSource,
    canChangeVisibility,
    canEditMetadata,
  };
}

/**
 * Log a security/audit event.
 */
export async function createAuditEvent(params: {
  actorUid: string;
  actorRoles: string[];
  operation: string;
  targetType: string;
  targetId: string;
  previousState?: any;
  newState?: any;
  reason?: string;
  result: "success" | "failure";
}) {
  try {
    const db = getAdminDb();
    const docRef = db.collection("audit_logs").doc();
    const auditRecord = {
      auditId: docRef.id,
      timestamp: new Date().toISOString(),
      ...params,
    };
    await docRef.set(auditRecord);
    
  } catch (err) {
    console.error("Failed to write audit log:", err);
  }
}
