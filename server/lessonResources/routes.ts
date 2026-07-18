import { Router } from "express";
import { requireFirebaseUser } from "../firebase/authMiddleware";
import { getAdminBucket, getAdminDb } from "../firebase/admin";
import { assertContentManager, isContentManager, isStudentVisibleSource } from "../utils/contentPermissions";
import { normalizeDisplayPriority, normalizeLessonId, resourceTimestampMillis } from "./service";
import { invalidateInventoryCache } from "../sources/sourceInventoryService";

import { requireFirebaseAppCheck } from "../firebase/appCheckMiddleware";

export const lessonResourceRoutes = Router();
lessonResourceRoutes.use(requireFirebaseUser, requireFirebaseAppCheck);

lessonResourceRoutes.get("/lesson-resources", requireFirebaseUser, async (req: any, res) => {
  try {
    const subject = String(req.query.subject || "").trim().toUpperCase();
    const requestedLessonId = normalizeLessonId(req.query.lessonId || req.query.lessonTitle);
    const requestedLessonTitle = String(req.query.lessonTitle || req.query.lessonId || "").normalize("NFKC").trim();
    if (!subject || !requestedLessonId) {
      return res.status(400).json({ ok: false, code: "LESSON_QUERY_REQUIRED", message: "subject and lessonId are required." });
    }

    const db = getAdminDb();
    const manager = isContentManager(req.user);
    const subjectVariants = Array.from(new Set([subject, subject.toLowerCase(), subject[0] + subject.slice(1).toLowerCase()]));
    const loadSubjectDocs = async (collection: any) => {
      const snapshots = await Promise.allSettled(
        subjectVariants.map((variant) => collection.where("subject", "==", variant).limit(200).get()),
      );
      const merged = new Map<string, any>();
      for (const snapshot of snapshots) {
        if (snapshot.status !== "fulfilled") continue;
        for (const document of snapshot.value.docs) merged.set(document.id, document);
      }
      return Array.from(merged.values());
    };

    const [authoritativeDocs, legacyDocs, personalDocs, videoDocs] = await Promise.all([
      loadSubjectDocs(db.collection("lesson_resources")),
      loadSubjectDocs(db.collection("rag_sources")),
      loadSubjectDocs(db.collection("users").doc(req.user.uid).collection("syllabus_resources")),
      loadSubjectDocs(db.collection("videos")),
    ]);

    const authoritative = authoritativeDocs.map((document: any) => ({ id: document.id, ...document.data(), origin: "lesson_resources" }));
    const legacy = legacyDocs.map((document: any) => ({ id: document.id, sourceId: document.id, ...document.data(), origin: "rag_sources" }));
    const personalSyllabus = personalDocs.map((document: any) => ({ id: document.id, sourceId: document.id, ...document.data(), origin: "syllabus_resources" }));
    const videoFallbackDocs = videoDocs.map((document: any) => {
      const video = document.data() || {};
      return {
        id: `video-${document.id}`,
        videoId: document.id,
        sourceId: document.id,
        subject,
        lessonId: video.lessonId || normalizeLessonId(video.lesson || video.lessonTitle),
        lessonTitle: video.lessonTitle || video.lesson || "General",
        resourceType: "lesson_video",
        sourceScope: "shared_lesson",
        mediaKind: "video",
        title: video.title || video.fileName || "Lesson video",
        fileName: video.fileName || video.title || "Lesson video",
        storagePath: video.storagePath || video.sourceStoragePath || null,
        visibility: video.visibility || "public",
        published: Boolean(video.isPublished),
        processingStatus: video.status || "processing",
        allowPlayback: Boolean(video.allowPlayback),
        createdBy: video.createdBy || video.ownerUid || null,
        ownerUid: video.ownerUid || video.createdBy || null,
        createdAt: video.createdAt,
        updatedAt: video.updatedAt,
        displayPriority: normalizeDisplayPriority(video.displayPriority, 0),
        origin: "videos",
      };
    });

    const aliases = new Set([
      requestedLessonId,
      normalizeLessonId(requestedLessonTitle),
      normalizeLessonId(requestedLessonTitle.replace(/[–—:()\[\]]/g, " ")),
    ].filter(Boolean));
    const requestedTokens = requestedLessonId.split("-").filter((token) => token.length > 1);
    const matchesLesson = (resource: any) => {
      const stableLessonId = normalizeLessonId(resource.lessonId);
      if (stableLessonId) return aliases.has(stableLessonId);

      // Legacy records without a stable lessonId may use a conservative title
      // fallback. Never attach a resource on a partial substring alone.
      const candidates = [resource.lessonTitle, resource.lesson, resource.topic]
        .map((value) => normalizeLessonId(value))
        .filter(Boolean);
      if (candidates.some((candidate) => aliases.has(candidate))) return true;
      if (requestedTokens.length < 2) return false;
      return candidates.some((candidate) => {
        const candidateTokens = new Set(candidate.split("-").filter((token) => token.length > 1));
        const overlap = requestedTokens.filter((token) => candidateTokens.has(token)).length;
        const union = new Set([...requestedTokens, ...candidateTokens]).size;
        return overlap >= 2 && union > 0 && overlap / union >= 0.85;
      });
    };

    const merged = new Map<string, any>();
    for (const resource of [...legacy, ...personalSyllabus, ...videoFallbackDocs, ...authoritative]) {
      if (!matchesLesson(resource)) continue;
      const isOwner = resource.ownerUid === req.user.uid || resource.createdBy === req.user.uid;
      const visible = manager
        ? String(resource.processingStatus || resource.indexStatus || "").toLowerCase() !== "archived"
        : isOwner && String(resource.visibility || "") === "private"
          ? true
          : isStudentVisibleSource(resource)
            && (resource.mediaKind !== "video" || resource.allowPlayback === true);
      if (!visible) continue;

      const key = String(resource.videoId || resource.sourceId || resource.id);
      const previous = merged.get(key) || {};
      const mediaKind = resource.mediaKind || (resource.videoId ? "video" : resource.mimeType?.startsWith?.("image/") ? "image" : "pdf");
      merged.set(key, {
        ...previous,
        ...resource,
        id: resource.id || previous.id || key,
        sourceId: resource.sourceId || previous.sourceId || key,
        mediaKind,
        processingStatus: resource.processingStatus || resource.indexStatus || resource.status || "ready",
        textIndexed: resource.textIndexed === true || Number(resource.chunkCount || 0) > 0,
        displayPriority: normalizeDisplayPriority(resource.displayPriority, 0),
      });
    }

    const resources = Array.from(merged.values()).sort((left: any, right: any) => {
      const priorityDelta = normalizeDisplayPriority(right.displayPriority, 0) - normalizeDisplayPriority(left.displayPriority, 0);
      if (priorityDelta !== 0) return priorityDelta;
      const uploadedDelta = resourceTimestampMillis(right.createdAt || right.uploadedAt || right.updatedAt) - resourceTimestampMillis(left.createdAt || left.uploadedAt || left.updatedAt);
      if (uploadedDelta !== 0) return uploadedDelta;
      return String(left.title || "").localeCompare(String(right.title || ""));
    });

    res.setHeader("Cache-Control", "private, no-store, max-age=0");
    return res.json({ ok: true, resources, canManageLessonResources: manager, lessonId: requestedLessonId });
  } catch (error: any) {
    return res.status(500).json({ ok: false, code: "LESSON_RESOURCES_READ_FAILED", message: "The operation failed. Please try again." });
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
    if (req.body?.displayPriority !== undefined) update.displayPriority = normalizeDisplayPriority(req.body.displayPriority, 0);
    if (["private", "class", "public", "official"].includes(req.body?.visibility)) update.visibility = req.body.visibility;
    if (req.body?.lessonTitle) {
      update.lessonTitle = String(req.body.lessonTitle).slice(0, 180);
      update.lessonId = normalizeLessonId(req.body.lessonId || req.body.lessonTitle);
    }
    const resource = snapshot.data() || {};
    const db = getAdminDb();
    const batch = db.batch();
    batch.set(resourceRef, update, { merge: true });
    const sourceId = String(resource.sourceId || req.params.resourceId);
    if (sourceId) {
      batch.set(db.collection("rag_sources").doc(sourceId), update, { merge: true });
      if (String(resource.resourceType || "") === "past_paper") {
        batch.set(db.collection("past_papers").doc(sourceId), update, { merge: true });
      }
      if (resource.videoId) batch.set(db.collection("videos").doc(String(resource.videoId)), update, { merge: true });
    }
    await batch.commit();
    invalidateInventoryCache(req.user.uid);
    return res.json({ ok: true });
  } catch (error: any) {
    return res.status(error.status || 500).json({ ok: false, code: error.code || "LESSON_RESOURCE_UPDATE_FAILED", message: "The operation failed. Please try again." });
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
      await getAdminBucket().file(String(resource.storagePath)).delete({ ignoreNotFound: true });
    }
    if (resource.sourceId) {
      await db.collection("rag_sources").doc(String(resource.sourceId)).delete();
      const chunks = await db.collection("rag_chunks").where("sourceId", "==", String(resource.sourceId)).get();
      await Promise.all(chunks.docs.map((document: any) => document.ref.delete()));
    }
    await resourceRef.delete();
    invalidateInventoryCache(req.user.uid);
    return res.json({ ok: true });
  } catch (error: any) {
    return res.status(error.status || 500).json({ ok: false, code: error.code || "LESSON_RESOURCE_DELETE_FAILED", message: "The operation failed. Please try again." });
  }
});
