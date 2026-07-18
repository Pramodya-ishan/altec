export const CONTENT_MANAGER_ROLES = new Set(["admin", "content_editor", "teacher", "ops"]);
export const SHARED_SOURCE_SCOPES = new Set(["paper_structure", "past_paper", "owner_syllabus", "shared_lesson", "official"]);

export function isContentManager(user: { admin?: boolean; roles?: string[] } | null | undefined) {
  if (user?.admin === true) return true;
  return Array.isArray(user?.roles) && user.roles.some((role) => CONTENT_MANAGER_ROLES.has(String(role)));
}

export function assertContentManager(user: { admin?: boolean; roles?: string[] } | null | undefined) {
  if (!isContentManager(user)) {
    const error = new Error("You do not have permission to manage shared lesson resources.");
    (error as any).status = 403;
    (error as any).code = "CONTENT_MANAGER_REQUIRED";
    throw error;
  }
}

export function isSharedSourceScope(scope: unknown) {
  return SHARED_SOURCE_SCOPES.has(String(scope || "").trim().toLowerCase());
}

/**
 * Returns true only when a source was explicitly published. Legacy rows with
 * missing `published` must be migrated and reviewed before students can see
 * them; sourceScope alone is never treated as publication consent.
 */
export function isStudentVisibleSource(source: Record<string, unknown> | null | undefined) {
  if (!source || source.published !== true) return false;
  const visibility = String(source.visibility || "").trim().toLowerCase();
  return ["public", "official", "shared", "class", "institution"].includes(visibility)
    && String(source.processingStatus || "").toLowerCase() !== "archived";
}
