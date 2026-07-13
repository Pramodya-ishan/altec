import { Router } from "express";
import { getAdminDb, getAdminBucket, requireUser } from "../firebase/admin";
import { invalidateInventoryCache } from "../sources/sourceInventoryService";

export const syllabusRoutes = Router();

export async function requireSyllabusOwner(req: any) {
  const user = await requireUser(req);
  if (!user) {
    throw new Error("LOGIN_REQUIRED");
  }
  const db = getAdminDb();
  const roleDoc = await db.collection("user_roles").doc(user.uid).get();
  const roles = roleDoc.exists ? (roleDoc.data()?.roles || (roleDoc.data()?.role ? [roleDoc.data().role] : [])) : [];
  const isOwner = roles.includes("admin") || roles.includes("teacher") || roles.includes("content_editor") || user.admin === true;
  if (!isOwner) {
    throw new Error("SYLLABUS_OWNER_ONLY");
  }
  return user;
}

syllabusRoutes.get("/debug", async (req, res) => {
  try {
    const user = await requireUser(req);
    const db = getAdminDb();
    const roleDoc = await db.collection("user_roles").doc(user.uid).get();
    const roles = roleDoc.exists ? (roleDoc.data()?.roles || (roleDoc.data()?.role ? [roleDoc.data().role] : [])) : [];
    const isOwner = roles.includes("admin") || roles.includes("teacher") || roles.includes("content_editor") || user.admin === true;
    const ownerEmail = process.env.SYLLABUS_OWNER_EMAIL || "admin";
    
    let resourcesCount = 0;
    let chunksCount = 0;
    
    if (isOwner) {
       const db = getAdminDb();
       const resSnap = await db.collection("users").doc(user.uid).collection("syllabus_resources").count().get();
       resourcesCount = resSnap.data().count;
       const chunkSnap = await db.collection("users").doc(user.uid).collection("syllabus_chunks").count().get();
       chunksCount = chunkSnap.data().count;
    }
    
    res.json({
      ok: true,
      ownerEmail,
      currentUserEmail: user?.email,
      currentUserIsOwner: isOwner,
      uid: user?.uid,
      resourcesCount,
      chunksCount,
      storagePrefix: `users/${user?.uid}/syllabus/`,
      firestoreDatabaseId: process.env.FIRESTORE_DATABASE_ID
    });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

syllabusRoutes.get("/resources", async (req, res) => {
  try {
    const user = await requireUser(req);
    const db = getAdminDb();
    
    // Fetch user's own resources
    const userSnap = await db.collection("users").doc(user.uid).collection("syllabus_resources").orderBy("createdAt", "desc").get();
    const userResources = userSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }));

    // Fetch admin resources as official ones if user is not admin
    const roleDoc = await db.collection("user_roles").doc(user.uid).get();
    const roles = roleDoc.exists ? (roleDoc.data()?.roles || (roleDoc.data()?.role ? [roleDoc.data().role] : [])) : [];
    const isAdmin = roles.includes("admin") || user.admin === true;
    
    let resources = [...userResources];
    
    if (!isAdmin) {
      let ownerUid = null;
      const adminsSnap = await db.collection("user_roles").where("role", "==", "admin").limit(1).get();
      if (!adminsSnap.empty) {
        ownerUid = adminsSnap.docs[0].id;
      } else {
        const adminsSnap2 = await db.collection("user_roles").where("roles", "array-contains", "admin").limit(1).get();
        if (!adminsSnap2.empty) {
          ownerUid = adminsSnap2.docs[0].id;
        }
      }
      
      if (ownerUid) {
        const adminSnap = await db.collection("users").doc(ownerUid).collection("syllabus_resources").orderBy("createdAt", "desc").get();
        const adminResources = adminSnap.docs.map((d: any) => ({ id: d.id, ...d.data(), isOfficial: true }));
        // merge keeping unique ids
        const existingIds = new Set(resources.map((r: any) => r.id));
        adminResources.forEach((r: any) => {
          if (!existingIds.has(r.id)) {
            resources.push(r);
          }
        });
      }
    }
    
    res.json({ ok: true, resources });
  } catch (e: any) {
    res.status(403).json({ ok: false, error: e.message });
  }
});

syllabusRoutes.delete("/resources/:resourceId", async (req, res) => {
  try {
    const user = await requireUser(req);
    const { resourceId } = req.params;
    const db = getAdminDb();
    const bucket = getAdminBucket();
    
    const roleDoc = await db.collection("user_roles").doc(user.uid).get();
    const roles = roleDoc.exists ? (roleDoc.data()?.roles || (roleDoc.data()?.role ? [roleDoc.data().role] : [])) : [];
    const isAdmin = roles.includes("admin") || user.admin === true;
    
    // Check in user's own resources
    const docRef = db.collection("users").doc(user.uid).collection("syllabus_resources").doc(resourceId);
    const docSnap = await docRef.get();
    
    let canDelete = docSnap.exists;
    let storagePath: string | null = null;
    
    if (docSnap.exists) {
      storagePath = docSnap.data()?.storagePath || null;
    } else if (isAdmin) {
      // Admin can delete from anywhere, let's find it in rag_sources
      const ragRef = db.collection("rag_sources").doc(resourceId);
      const ragSnap = await ragRef.get();
      if (ragSnap.exists) {
        canDelete = true;
        storagePath = ragSnap.data()?.storagePath || null;
      }
    }
    
    if (!canDelete) {
      return res.status(403).json({ ok: false, error: "Unauthorized or resource not found" });
    }
    
    const batch = db.batch();
    
    // delete local user doc if exists
    batch.delete(docRef);
    
    // delete chunks
    const chunksSnap = await db.collection("users").doc(user.uid).collection("syllabus_chunks").where("sourceId", "==", resourceId).get();
    chunksSnap.docs.forEach((d: any) => batch.delete(d.ref));
    
    // Also delete from rag_sources and rag_chunks
    batch.delete(db.collection("rag_sources").doc(resourceId));
    const rag_chunks = await db.collection("rag_chunks").where("sourceId", "==", resourceId).get();
    rag_chunks.docs.forEach((d: any) => batch.delete(d.ref));
    
    await batch.commit();
    
    let storageAttempted = false;
    let storageOk = false;
    let storageError: string | null = null;
    
    if (storagePath) {
      storageAttempted = true;
      try {
        await bucket.file(storagePath).delete();
        storageOk = true;
      } catch (err: any) {
        console.warn("Syllabus Admin Storage delete failed:", err.message);
        storageError = err.message;
      }
    }
    
    invalidateInventoryCache(user.uid);
    
    res.json({
      ok: true,
      deletedId: resourceId,
      storageDelete: {
        attempted: storageAttempted,
        ok: storageOk,
        skipped: !storagePath,
        error: storageError
      }
    });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

syllabusRoutes.get("/resources/:resourceId/download", async (req, res) => {
  try {
    const user = await requireUser(req);
    const { resourceId } = req.params;
    const db = getAdminDb();
    
    // First, let's check if the current user owns it or if it belongs to admin
    let resourceDoc = await db.collection("users").doc(user.uid).collection("syllabus_resources").doc(resourceId).get();
    if (!resourceDoc.exists) {
      let ownerUid = null;
      const adminsSnap = await db.collection("user_roles").where("role", "==", "admin").limit(1).get();
      if (!adminsSnap.empty) {
        ownerUid = adminsSnap.docs[0].id;
      } else {
        const adminsSnap2 = await db.collection("user_roles").where("roles", "array-contains", "admin").limit(1).get();
        if (!adminsSnap2.empty) {
          ownerUid = adminsSnap2.docs[0].id;
        }
      }
      if (ownerUid) {
        resourceDoc = await db.collection("users").doc(ownerUid).collection("syllabus_resources").doc(resourceId).get();
      }
    }
    
    if (!resourceDoc.exists) {
      // try general rag_sources
      resourceDoc = await db.collection("rag_sources").doc(resourceId).get();
    }

    if (!resourceDoc.exists) {
      return res.status(404).json({ ok: false, error: "Resource not found in syllabus library" });
    }
    
    const data = resourceDoc.data();
    if (!data || !data.storagePath) {
      return res.status(404).json({ ok: false, error: "Storage path not found" });
    }
    
    const bucket = getAdminBucket();
    const file = bucket.file(data.storagePath);
    
    const [exists] = await file.exists();
    if (!exists) {
      return res.status(404).json({ ok: false, error: "File not found in storage" });
    }
    
    // Try to create a signed URL first (valid for 15 mins) and redirect
    try {
      const [signedUrl] = await file.getSignedUrl({
        action: 'read',
        expires: Date.now() + 15 * 60 * 1000, // 15 mins
      });
      return res.redirect(signedUrl);
    } catch (signErr) {
      console.warn("Failed to generate signed URL, falling back to direct stream:", signErr);
    }
    
    // Fallback: direct stream
    res.setHeader("Content-Type", data.mimeType || "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(data.fileName || "syllabus_resource.pdf")}"`);
    file.createReadStream().pipe(res);
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});
