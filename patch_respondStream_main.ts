import fs from 'fs';
let code = fs.readFileSync('server/ai/respondStream.ts', 'utf-8');

code = code.replace(/await saveFinalChat\(\{([\s\S]*?)\}\);\n\s*sendSSE\(res, "done", \{ chatSaved: chatRes\.chatSaved \}\);/g, 
`const chatRes = await saveFinalChat({$1});
      sendSSE(res, "done", { chatSaved: chatRes.chatSaved === true, saveErrorCode: chatRes.errorCode });`);
      
code = code.replace(/sendSSE\(res, "done", \{ chatSaved: chatRes\.chatSaved, sources: allSources \}\);/g, 
`sendSSE(res, "done", { chatSaved: chatRes?.chatSaved === true, saveErrorCode: chatRes?.errorCode, sources: allSources, finishReason: "complete" });`);

code = code.replace(/sendSSE\(res, "done", \{ chatSaved: chatRes\.chatSaved \}\);/g, 
`sendSSE(res, "done", { chatSaved: chatRes?.chatSaved === true, saveErrorCode: chatRes?.errorCode, finishReason: "complete" });`);

fs.writeFileSync('server/ai/respondStream.ts', code);
