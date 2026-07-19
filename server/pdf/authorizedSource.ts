import { getAdminDb } from "../firebase/admin";
import { isContentManager, isStudentVisibleSource } from "../utils/contentPermissions";
import { storageObjectPath } from "./sourceBuffer";

function canUseOwnedPath(user: any, path: string) {
  return path.startsWith(`users/${user?.uid}/`) || path.startsWith(`rag_uploads/${user?.uid}/`);
}

/** Resolve a PDF source without trusting a browser-supplied Storage path. */
export async function resolveAuthorizedPdfSource(user: any, sourceIdValue: unknown, submittedPath?: unknown) {
  const sourceId = String(sourceIdValue || "").trim();
  if (!sourceId) throw Object.assign(new Error("PDF source ID is required."), { status: 400, code: "PDF_SOURCE_ID_REQUIRED" });
  const db = getAdminDb();
  const snapshots = await Promise.all([
    db.collection("rag_sources").doc(sourceId).get(),
    db.collection("past_papers").doc(sourceId).get(),
    db.collection("lesson_resources").doc(sourceId).get(),
    db.collection("users").doc(user.uid).collection("syllabus_resources").doc(sourceId).get(),
  ]);
  const candidates = snapshots
    .filter((snapshot: any) => snapshot?.exists)
    .map((snapshot: any) => ({ id: sourceId, ...(snapshot.data?.() || {}) }));
  const extracted = snapshots[0]?.exists ? { id: sourceId, ...(snapshots[0].data?.() || {}) } : null;
  const published = snapshots[2]?.exists ? snapshots[2].data?.() : null;
  if (extracted && published) candidates.unshift({ ...extracted, ...published, id: sourceId });
  const source = candidates.find((candidate: any) => storageObjectPath(candidate.storagePath)) || candidates[0] || null;
  const path = storageObjectPath(source?.storagePath || submittedPath);
  if (!source || !path) throw Object.assign(new Error("PDF source has no readable storage object."), { status: 404, code: "PDF_SOURCE_NOT_FOUND" });

  const owned = source.ownerUid === user.uid || source.createdBy === user.uid || canUseOwnedPath(user, path);
  if (!isContentManager(user) && !isStudentVisibleSource(source) && !owned) {
    throw Object.assign(new Error("You do not have access to this PDF source."), { status: 403, code: "PDF_SOURCE_FORBIDDEN" });
  }
  return { source, path };
}
