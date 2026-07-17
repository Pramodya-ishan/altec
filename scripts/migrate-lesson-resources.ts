import { getAdminDb } from "../server/firebase/admin";
import { isSharedSourceScope } from "../server/utils/contentPermissions";
import { normalizeLessonId, upsertLessonResource } from "../server/lessonResources/service";
import { normalizeRepeatedFileExtension } from "../server/video/videoService";
import { invalidateInventoryCache } from "../server/sources/sourceInventoryService";

const MANAGER_ROLES = new Set(["admin", "content_editor", "teacher", "ops"]);

function roleList(data: any): string[] {
  const roles = Array.isArray(data?.roles) ? data.roles.map(String) : [];
  if (data?.role) roles.push(String(data.role));
  if (data?.admin === true) roles.push("admin");
  return Array.from(new Set(roles));
}

async function creatorCanManage(uid: string, cache: Map<string, boolean>) {
  if (!uid) return false;
  if (cache.has(uid)) return cache.get(uid)!;
  const snapshot = await getAdminDb().collection("user_roles").doc(uid).get();
  const allowed = snapshot.exists && roleList(snapshot.data()).some((role) => MANAGER_ROLES.has(role));
  cache.set(uid, allowed);
  return allowed;
}

async function main() {
  const db = getAdminDb();
  const roleCache = new Map<string, boolean>();
  const touchedOwners = new Set<string>();
  let migratedSources = 0;
  let migratedVideos = 0;
  let skipped = 0;

  const sourceSnapshot = await db.collection("rag_sources").get();
  for (const document of sourceSnapshot.docs) {
    const source: any = { sourceId: document.id, ...document.data() };
    const scope = String(source.sourceScope || "");
    if (!isSharedSourceScope(scope) || scope === "chat_upload") {
      skipped += 1;
      continue;
    }
    const creator = String(source.createdBy || source.ownerUid || "");
    if (!(await creatorCanManage(creator, roleCache))) {
      skipped += 1;
      continue;
    }

    const visibility = scope === "official" || scope === "past_paper" ? "official" : "class";
    const lessonTitle = String(source.lesson || source.topic || "General");
    const title = normalizeRepeatedFileExtension(String(source.title || source.fileName || "Lesson resource"));
    const fileName = normalizeRepeatedFileExtension(String(source.fileName || title));
    const update = {
      visibility,
      published: true,
      title,
      fileName,
      updatedAt: new Date().toISOString(),
    };
    await document.ref.set(update, { merge: true });
    await upsertLessonResource({
      id: document.id,
      sourceId: document.id,
      subject: String(source.subject || "").toUpperCase(),
      lessonId: normalizeLessonId(source.lessonId || lessonTitle),
      lessonTitle,
      resourceType: source.resourceType || source.sourceType || "paper_structure",
      mediaKind: source.mediaKind || (/image/i.test(source.mimeType || "") ? "image" : "pdf"),
      title,
      fileName,
      storagePath: source.storagePath || null,
      mimeType: source.mimeType || "application/pdf",
      sizeBytes: Number(source.sizeBytes || 0) || null,
      visibility,
      published: true,
      processingStatus: source.indexStatus || source.processingStatus || (source.chunkCount > 0 ? "ready" : "queued"),
      needsOcr: source.needsOcr === true,
      textIndexed: source.textIndexed === true || Number(source.chunkCount || 0) > 0,
      createdBy: creator,
      ownerUid: source.ownerUid || creator,
      createdAt: source.createdAt,
    });
    touchedOwners.add(source.ownerUid || creator);
    migratedSources += 1;
  }

  const videoSnapshot = await db.collection("videos").get();
  for (const document of videoSnapshot.docs) {
    const video: any = { id: document.id, ...document.data() };
    const creator = String(video.createdBy || "");
    if (!video.subject || !video.lesson || !(await creatorCanManage(creator, roleCache))) {
      skipped += 1;
      continue;
    }
    const title = normalizeRepeatedFileExtension(String(video.title || "Lesson video"));
    const fileName = normalizeRepeatedFileExtension(String(video.originalFileName || title));
    await document.ref.set({ title, originalFileName: fileName, updatedAt: new Date().toISOString() }, { merge: true });
    await upsertLessonResource({
      id: video.sourceId || video.id,
      sourceId: video.sourceId || video.id,
      subject: String(video.subject).toUpperCase(),
      lessonId: normalizeLessonId(video.lessonId || video.lesson),
      lessonTitle: String(video.lesson),
      resourceType: "video",
      mediaKind: "video",
      title,
      fileName,
      storagePath: video.inputObjectPath || null,
      videoId: video.id,
      mimeType: video.mimeType || "video/mp4",
      sizeBytes: Number(video.sourceSizeBytes || 0) || null,
      visibility: video.visibility === "public" ? "public" : "class",
      published: video.isPublished === true,
      processingStatus: video.status || "draft",
      needsOcr: false,
      textIndexed: false,
      createdBy: creator,
      ownerUid: creator,
      createdAt: video.createdAt,
    });
    touchedOwners.add(creator);
    migratedVideos += 1;
  }

  touchedOwners.forEach((uid) => invalidateInventoryCache(uid));
  console.log(JSON.stringify({ ok: true, migratedSources, migratedVideos, skipped }, null, 2));
}

main().catch((error) => {
  console.error("Lesson resource migration failed", error);
  process.exitCode = 1;
});
