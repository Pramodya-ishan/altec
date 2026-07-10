import re

with open("server/syllabus/routes.ts", "r") as f:
    c = f.read()

c = c.replace("""    // If it doesn't exist in syllabus_resources, it might still exist in rag_sources
    if (docSnap.exists) {
      const data = docSnap.data();
      if (data?.storagePath) {
         bucket.file(data.storagePath).delete().catch((e: any) => console.warn("Failed to delete storage file", e));
      }
      batch.delete(docRef);
    }
    
    // delete chunks
    const chunksSnap = await db.collection("users").doc(user.uid).collection("syllabus_chunks").where("sourceId", "==", resourceId).get();
    const batch = db.batch();""", """    const batch = db.batch();

    // If it doesn't exist in syllabus_resources, it might still exist in rag_sources
    if (docSnap.exists) {
      const data = docSnap.data();
      if (data?.storagePath) {
         bucket.file(data.storagePath).delete().catch((e: any) => console.warn("Failed to delete storage file", e));
      }
      batch.delete(docRef);
    }
    
    // delete chunks
    const chunksSnap = await db.collection("users").doc(user.uid).collection("syllabus_chunks").where("sourceId", "==", resourceId).get();""")

with open("server/syllabus/routes.ts", "w") as f:
    f.write(c)
