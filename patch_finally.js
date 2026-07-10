import fs from 'fs';
let p = fs.readFileSync('src/hooks/useAIWorkflowStream.ts', 'utf8');

p = p.replace(
  /                onDone\?\.\(\{ ok: false, completed: true, finishReason: "direct_pdf_qa_failed", errorCode: "FATAL_ERROR", sources: \[\{ id: sourceId, title, storagePath \}\] \}\);\s*\}\s*\}\);\s*\}\s*if \(eventName === "sources"\)/g,
  `                onDone?.({ ok: false, completed: true, finishReason: "direct_pdf_qa_failed", errorCode: "FATAL_ERROR", sources: [{ id: sourceId, title, storagePath }] });
              } finally {
                activeDirectQaKeys.delete(qaKey);
              }
            });
          }
          if (eventName === "sources")`
);
fs.writeFileSync('src/hooks/useAIWorkflowStream.ts', p);
