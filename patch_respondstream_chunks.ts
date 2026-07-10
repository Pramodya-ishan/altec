import fs from 'fs';

let content = fs.readFileSync('server/ai/respondStream.ts', 'utf8');

const oldChunksLogic = `    const chunks = await retrieveRelevantKnowledge({ prompt, activeSubject, mode: selectedMode, limit: 8 });

    const searchEnabled = requiresGoogleSearch(selectedMode, prompt);`;

const newChunksLogic = `    const chunks = await retrieveRelevantKnowledge({ prompt, activeSubject, mode: selectedMode, limit: 8 });
    
    // Send sources event to frontend
    if (chunks && chunks.length > 0) {
      const safeChunks = chunks.map(c => ({
        title: c.title || c.sourceTitle || "Source",
        lesson: c.lesson || "",
        sourceType: c.sourceType || "unknown",
        page: c.page || c.year || "",
        confidence: c.confidence || 0,
        id: c.id
      }));
      sendSSE(res, "sources", { chunks: safeChunks });
    }

    const searchEnabled = requiresGoogleSearch(selectedMode, prompt);`;

content = content.replace(oldChunksLogic, newChunksLogic);

const oldPromptLogic = `    const finalPrompt = getCloraSystemPrompt(userContext, selectedMode) + 
      (chunks?.length ? \`\\n\\nReference Sources:\\n\${JSON.stringify(chunks)}\` : '') + 
      (history?.length ? \`\\n\\nPrevious Chat History:\\n\${JSON.stringify(history)}\` : '') + 
      \`\\n\\nCurrent User Request:\\n\${prompt}\`;`;

const newPromptLogic = `    let chunkText = "";
    if (chunks?.length) {
      chunkText = "\\n\\nRAG SOURCES:\\n" + chunks.map((c, i) => 
        \`[\${i+1}] \${c.title || c.sourceTitle} | \${c.subject || ''} | \${c.lesson || ''} | \${c.sourceType || ''} | \${c.page || c.year || ''} | conf:\${c.confidence}\\nText: \${c.text.substring(0, 1000)}\`
      ).join("\\n\\n");
    }

    const finalPrompt = getCloraSystemPrompt(userContext, selectedMode) + 
      chunkText + 
      (history?.length ? \`\\n\\nPrevious Chat History:\\n\${JSON.stringify(history)}\` : '') + 
      \`\\n\\nCurrent User Request:\\n\${prompt}\`;`;

content = content.replace(oldPromptLogic, newPromptLogic);

fs.writeFileSync('server/ai/respondStream.ts', content);
