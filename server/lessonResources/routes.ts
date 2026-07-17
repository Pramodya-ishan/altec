import { Router } from "express";
import { requireFirebaseUser } from "../firebase/authMiddleware";
import { getAdminBucket, getAdminDb } from "../firebase/admin";
import { assertContentManager, isContentManager } from "../utils/contentPermissions";
import { normalizeLessonId } from "./service";
import { invalidateInventoryCache } from "../sources/sourceInventoryService";

export const lessonResourceRoutes = Router();

lessonResourceRoutes.get("/lesson-resources", requireFirebaseUser, async (req: any, res) => {
  try {
    const subject = String(req.query.subject || "").trim().toUpperCase();
    const requestedLessonId = normalizeLessonId(req.query.lessonId || req.query.lessonTitle);
    if (!subject || !requestedLessonId) {
      return res.status(400).json({ ok: false, code: "LESSON_QUERY_REQUIRED", message: "subject and lessonId are required." });
    }

    const snapshot = await getAdminDb().collection("lesson_resources").where("subject", "==", subject).get();
    const manager = isContentManager(req.user);
    const resources = snapshot.docs
      .map((document: any) => ({ id: document.id, ...document.data() }))
      .filter((resource: any) => normalizeLessonId(resource.lessonId || resource.lessonTitle) === requestedLessonId)
      .filter((resource: any) => {
        if (manager) return resource.processingStatus !== "archived";
        if (resource.ownerUid === req.user.uid && resource.visibility === "private") return true;
        return resource.published === true
          && ["class", "public", "official"].includes(String(resource.visibility || ""))
          && resource.processingStatus !== "archived";
      })
      .sort((left: any, right: any) => String(right.createdAt || "").localeCompare(String(left.createdAt || "")));

    return res.json({ ok: true, resources, canManageLessonResources: manager });
  } catch (error: any) {
    return res.status(500).json({ ok: false, code: "LESSON_RESOURCES_READ_FAILED", message: error.message });
  }
});

lessonResourceRoutes.patch("/lesson-resources/:resourceId", requireFirebaseUser, async (req: any, res) => {
  try {
    assertContentManager(req.user);
    const resourceRef = getAdminDb().collection("lesson_resources").doc(req.params.resourceId);
    const snapshot = await resourceRef.get();
    if (!snapshot.exists) return res.status(404).json({ ok: false, code: "LESSON_RESOURCE_NOT_FOUND" });
    const update: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (typeof req.body?.published === "boolean") update.published = req.body.published;
    if (["private", "class", "public", "official"].includes(req.body?.visibility)) update.visibility = req.body.visibility;
    if (req.body?.lessonTitle) {
      update.lessonTitle = String(req.body.lessonTitle).slice(0, 180);
      update.lessonId = normalizeLessonId(req.body.lessonId || req.body.lessonTitle);
    }
    await resourceRef.set(update, { merge: true });
    invalidateInventoryCache(req.user.uid);
    return res.json({ ok: true });
  } catch (error: any) {
    return res.status(error.status || 500).json({ ok: false, code: error.code || "LESSON_RESOURCE_UPDATE_FAILED", message: error.message });
  }
});

lessonResourceRoutes.delete("/lesson-resources/:resourceId", requireFirebaseUser, async (req: any, res) => {
  try {
    assertContentManager(req.user);
    const db = getAdminDb();
    const resourceRef = db.collection("lesson_resources").doc(req.params.resourceId);
    const snapshot = await resourceRef.get();
    if (!snapshot.exists) return res.status(404).json({ ok: false, code: "LESSON_RESOURCE_NOT_FOUND" });
    const resource = snapshot.data() || {};

    if (resource.videoId) {
      await db.collection("videos").doc(String(resource.videoId)).set({ status: "archived", isPublished: false, allowPlayback: false, updatedAt: new Date().toISOString() }, { merge: true });
    }
    if (resource.storagePath) {
      await getAdminBucket().file(String(resource.storagePath)).delete({ ignoreNotFound: true }).catch(() => undefined);
    }
    if (resource.sourceId) {
      await db.collection("rag_sources").doc(String(resource.sourceId)).delete().catch(() => undefined);
      const chunks = await db.collection("rag_chunks").where("sourceId", "==", String(resource.sourceId)).get();
      await Promise.all(chunks.docs.map((document: any) => document.ref.delete()));
    }
    await resourceRef.delete();
    invalidateInventoryCache(req.user.uid);
    return res.json({ ok: true });
  } catch (error: any) {
    return res.status(error.status || 500).json({ ok: false, code: error.code || "LESSON_RESOURCE_DELETE_FAILED", message: error.message });
  }
});
