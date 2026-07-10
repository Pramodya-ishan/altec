const fs = require('fs');
let text = fs.readFileSync('server/ai/respondStream.ts', 'utf8');
text = text.replace(/streamInterrupted = true;\n      sendSSE\(res, "error", \{ ok: false, error: "Stream was interrupted partially \(network or quota\)\.", recoverable: true, code: "STREAM_INTERRUPTED" \}\);\n    \}\);\n      \}\n    \}/, 
`streamInterrupted = true;
      sendSSE(res, "error", { ok: false, error: "Stream was interrupted partially (network or quota).", recoverable: true, code: "STREAM_INTERRUPTED" });
    }`);
fs.writeFileSync('server/ai/respondStream.ts', text);
