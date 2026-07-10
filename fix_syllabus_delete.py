import re

with open("server/syllabus/routes.ts", "r") as f:
    c = f.read()

old_delete = r'const docRef = db\.collection\("users"\)\.doc\(user\.uid\)\.collection\("syllabus_resources"\)\.doc\(resourceId\);\s*const docSnap = await docRef\.get\(\);\s*if \(!docSnap\.exists\) \{\s*return res\.status\(404\)\.json\(\{ ok: false, error: "Resource not found" \}\);\s*\}\s*const data = docSnap\.data\(\);\s*if \(data\?\.storagePath\) \{\s*bucket\.file\(data\.storagePath\)\.delete\(\)\.catch\(\(e: any\) => console\.warn\("Failed to delete storage file", e\)\);\s*\}'

new_delete = """const docRef = db.collection("users").doc(user.uid).collection("syllabus_resources").doc(resourceId);
    const docSnap = await docRef.get();
    
    // If it doesn't exist in syllabus_resources, it might still exist in rag_sources
    if (docSnap.exists) {
      const data = docSnap.data();
      if (data?.storagePath) {
         bucket.file(data.storagePath).delete().catch((e: any) => console.warn("Failed to delete storage file", e));
      }
      batch.delete(docRef);
    }
"""

c = re.sub(old_delete, new_delete, c, flags=re.DOTALL)

with open("server/syllabus/routes.ts", "w") as f:
    f.write(c)
