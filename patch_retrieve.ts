import fs from 'fs';

let content = fs.readFileSync('server/rag/retrieve.ts', 'utf8');

// Wrap the sourceDoc fetching in try/catch
content = content.replace(
  /const sourceDoc = await db\.collection\("ragSources"\)\.doc\(c\.sourceId\)\.get\(\);/,
  `let sourceDoc: any = { exists: false };\n        try { sourceDoc = await db.collection("ragSources").doc(c.sourceId).get(); } catch (e) { console.warn("Failed to get sourceDoc", e); }`
);

fs.writeFileSync('server/rag/retrieve.ts', content);
