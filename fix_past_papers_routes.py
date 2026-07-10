import re

with open("server/rag/routes.ts", "r") as f:
    c = f.read()

new_routes = """
// 3. Create past paper doc
ragRoutes.post("/past-papers", requireNonAnonymousUser, async (req: any, res) => {
  try {
    const { id, subject, year, resourceType, title, storagePath } = req.body;
    const db = getAdminDb();
    await db.collection("past_papers").doc(id).set({
      id,
      subject: subject?.toUpperCase(),
      year,
      resourceType,
      title,
      storagePath,
      ownerUid: req.user.uid,
      ownerEmail: req.user.email || "unknown",
      createdAt: new Date().toISOString()
    });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 4. Delete past paper
ragRoutes.delete("/past-papers/:id", requireNonAnonymousUser, async (req: any, res) => {
  try {
    const sourceId = req.params.id;
    const db = getAdminDb();
    
    // Verify user owns the paper or is admin
    const ownerEmail = process.env.SYLLABUS_OWNER_EMAIL || "26002ishan@gmail.com";
    const isAdmin = req.user.email?.toLowerCase() === ownerEmail.toLowerCase();
    
    const ppDoc = await db.collection("past_papers").doc(sourceId).get();
    if (ppDoc.exists) {
      if (ppDoc.data()?.ownerUid !== req.user.uid && !isAdmin) {
        return res.status(403).json({ ok: false, error: "Unauthorized" });
      }
      // Delete storage file if owned
      const storagePath = ppDoc.data()?.storagePath;
      if (storagePath) {
        const { getAdminBucket } = await import("../firebase/admin");
        const bucket = getAdminBucket();
        await bucket.file(storagePath).delete().catch((e: any) => console.warn("Failed to delete storage file:", e.message));
      }
      await db.collection("past_papers").doc(sourceId).delete();
    }
    
    const sourceDoc = await db.collection("rag_sources").doc(sourceId).get();
    if (sourceDoc.exists) {
        if (sourceDoc.data()?.ownerUid !== req.user.uid && !isAdmin) {
            return res.status(403).json({ ok: false, error: "Unauthorized" });
        }
        await db.collection("rag_sources").doc(sourceId).delete();
    }

    const chunks = await db.collection("rag_chunks").where("sourceId", "==", sourceId).get();
    const batch = db.batch();
    chunks.docs.forEach((d: any) => batch.delete(d.ref));
    
    const sylChunks = await db.collection("users").doc(req.user.uid).collection("syllabus_chunks").where("sourceId", "==", sourceId).get();
    sylChunks.docs.forEach((d: any) => batch.delete(d.ref));
    
    await batch.commit();
    
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 5. Delete individual RAG source
"""

c = c.replace("// 3. Delete individual RAG source", new_routes)

with open("server/rag/routes.ts", "w") as f:
    f.write(c)
