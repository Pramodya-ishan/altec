import fs from 'fs';
let p = fs.readFileSync('src/hooks/useAIWorkflowStream.ts', 'utf8');

if (!p.includes('activeDirectQaKeys')) {
  // Add Set to top level
  p = p.replace(/export function useAIWorkflowStream\(/, `const activeDirectQaKeys = new Set<string>();\n\nexport function useAIWorkflowStream(`);
  
  // Inside the event handler
  const replaceTarget = `const { sourceId, storagePath, title, subject, year, reason, message } = data;
            const questionNo = data.questionNo || data.parsedIntent?.questionNo || data.question?.questionNo;
            const questionType = data.questionType || data.parsedIntent?.questionType || "MCQ";`;
            
  const replacement = `const { sourceId, storagePath, title, subject, year, reason, message } = data;
            const questionNo = data.questionNo || data.parsedIntent?.questionNo || data.question?.questionNo;
            const questionType = data.questionType || data.parsedIntent?.questionType || "MCQ";
            
            const qaKey = \`\${sourceId}:\${questionType}:\${questionNo}\`;
            if (activeDirectQaKeys.has(qaKey)) {
              console.log("[DirectPDFQA] Skipping duplicate call for key:", qaKey);
              return;
            }
            activeDirectQaKeys.add(qaKey);`;
            
  p = p.replace(replaceTarget, replacement);
  
  const finallyTarget = `} catch (err: any) {`;
  const finallyReplacement = `} catch (err: any) {`;
  // wait, I need to remove the key from the set in finally block.
  const completeTarget = `onDone?.({ ok: false, completed: true, finishReason: "direct_pdf_qa_failed", errorCode: result.errorCode, sources: [{ id: sourceId, title, storagePath }] });
                }`;
  const completeReplacement = `onDone?.({ ok: false, completed: true, finishReason: "direct_pdf_qa_failed", errorCode: result.errorCode, sources: [{ id: sourceId, title, storagePath }] });
                }
              } finally {
                activeDirectQaKeys.delete(qaKey);
              }`;
  
  // Actually, I can just replace `return;` inside catch with the finally or just delete at the end of `.then(async () => { try {...} finally { activeDirectQaKeys.delete(qaKey); } })`
}
fs.writeFileSync('src/hooks/useAIWorkflowStream.ts', p);
