import re

with open("src/components/views/PastPapersView.tsx", "r") as f:
    c = f.read()

# Replace creation logic
old_create = r'''      const newPaper = \{
        id: data\.sourceId,
        title: data\.title \|\| title,
        year: year,
        type: type,
        subject: currentSubject,
        category: category,
        url: `/api/rag/sources/\$\{data\.sourceId\}/download`,
        storagePath: data\.storagePath,
        chunkCount: data\.chunkCount,
        needsOcr: data\.needsOcr,
        createdAt: new Date\(\)
      \};
      setUploadedPapers\(prev => \[newPaper, \.\.\.prev\]\);'''

new_create = '''      const newPaper = {
        id: data.sourceId,
        title: data.title || title,
        year: year,
        type: type,
        subject: currentSubject,
        category: category,
        url: `/api/rag/sources/${data.sourceId}/download`,
        storagePath: data.storagePath,
        chunkCount: data.chunkCount,
        needsOcr: data.needsOcr,
        createdAt: new Date()
      };
      
      await apiFetch("/api/rag/past-papers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: data.sourceId,
          subject: currentSubject,
          year,
          resourceType: selectedCategory === "Model Papers" ? "model_paper" : "past_paper",
          title: data.title || title,
          storagePath: data.storagePath
        })
      });
      
      setUploadedPapers(prev => [newPaper, ...prev]);'''

c = re.sub(old_create, new_create, c)


old_delete = r'''    try \{
      if \(paper\.category === 'A/L Past Papers'\) \{
        // It's a rag_source
        const res = await apiFetch\(`/api/rag/sources/\$\{paper\.id\}`,\{ method: 'DELETE' \}\);
        if \(!res\.ok\) throw new Error\("Failed to delete source"\);
      \} else \{
        // It's a past_papers doc
        await deleteDoc\(doc\(db, 'past_papers', paper\.id\)\);
      \}'''

new_delete = '''    try {
      const res = await apiFetch(`/api/rag/past-papers/${paper.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error("Failed to delete paper");'''

c = re.sub(old_delete, new_delete, c)

with open("src/components/views/PastPapersView.tsx", "w") as f:
    f.write(c)
