import re

with open("server/ai/examResourceResolver.ts", "r") as f:
    c = f.read()

old_chunks = r'''  // Query matching rag_chunks for specific text snippets
  try \{
    const chunkIds = sources\.map\(s => s\.id\);
    if \(chunkIds\.length > 0\) \{
      // Fetch text chunks linked to found source documents
      const chunkRef = db\.collection\("rag_chunks"\);
      // Firestore in-queries can have max 10/30 elements, let's limit to top 10 unique IDs or query all matching subject/year
      let chunkSnap;
      if \(subject\) \{
        chunkSnap = await chunkRef\.where\("subject", "==", subject\)\.limit\(30\)\.get\(\);
      \} else \{
        chunkSnap = await chunkRef\.limit\(30\)\.get\(\);
      \}
      chunkSnap\.forEach\(\(doc: any\) => \{
        const data = doc\.data\(\);
        const textContent = data\.text \|\| "";
        const matchesQuestion = normQuestion && textContent\.toUpperCase\(\)\.includes\(normQuestion\);
        
        if \(normQuestion && !matchesQuestion\) \{
          return; // Skip if looking for a specific question but chunk doesn't mention it
        \}

        // Add chunk details to sources
        sources\.push\(\{
          id: doc\.id,
          title: `Excerpt from: \$\{data\.title \|\| data\.sourceId\}`,
          subject: data\.subject,
          year: data\.year,
          resourceType: data\.resourceType,
          questionNo: data\.questionNo \|\| \(matchesQuestion \? normQuestion : undefined\),
          text: textContent,
          pageNumber: data\.pageNumber,
          confidence: matchesQuestion \? 0\.95 : 0\.8,
          verified: true,
          candidate: false,
          badge: "Text Chunk",
        \}\);

        if \(textContent\) \{
          bestTextBlocks\.push\(textContent\);
        \}
      \}\);
    \}
  \} catch \(err\) \{
    console\.warn\("rag_chunks query resolve failed:", err\);
  \}'''

new_chunks = '''  // Query matching rag_chunks for specific text snippets
  try {
    const chunkIds = Array.from(new Set(sources.filter(s => s.id && !s.id.startsWith("static_")).map(s => s.id)));
    if (chunkIds.length > 0) {
      const topIds = chunkIds.slice(0, 10); // Firestore max IN is 10
      const chunkRef = db.collection("rag_chunks");
      
      const chunkSnap = await chunkRef.where("sourceId", "in", topIds).get();
      
      chunkSnap.forEach((doc: any) => {
        const data = doc.data();
        const textContent = data.text || "";
        const matchesQuestion = normQuestion && (
            (data.questionNo && String(data.questionNo).toUpperCase() === normQuestion) ||
            textContent.toUpperCase().includes(normQuestion)
        );
        
        if (normQuestion && !matchesQuestion) {
          return; // Skip if looking for a specific question but chunk doesn't mention it
        }

        sources.push({
          id: doc.id,
          sourceId: data.sourceId,
          title: `Excerpt from: ${data.title || data.sourceId}`,
          subject: data.subject,
          year: data.year,
          resourceType: data.resourceType,
          questionNo: data.questionNo || (matchesQuestion ? normQuestion : undefined),
          text: textContent,
          pageNumber: data.pageNumber,
          storagePath: data.storagePath,
          confidence: matchesQuestion ? 0.95 : 0.8,
          verified: true,
          candidate: false,
          badge: "Text Chunk",
        });

        if (textContent) {
          bestTextBlocks.push(textContent);
        }
      });
    }
  } catch (err) {
    console.warn("rag_chunks query resolve failed:", err);
  }'''

c = re.sub(old_chunks, new_chunks, c)

with open("server/ai/examResourceResolver.ts", "w") as f:
    f.write(c)
