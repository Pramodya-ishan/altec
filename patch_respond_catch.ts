import fs from 'fs';
let code = fs.readFileSync('server/ai/respondStream.ts', 'utf-8');

code = code.replace(/sendSSE\(res, "done", \{ ok: false \}\);/g, 
`sendSSE(res, "done", { ok: false, chatSaved: false, finishReason: "error_recovered" });`);

fs.writeFileSync('server/ai/respondStream.ts', code);
