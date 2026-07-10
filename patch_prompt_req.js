import fs from 'fs';

let p = fs.readFileSync('server/pdf/routes.ts', 'utf8');

p = p.replace(
  /      if \(\!prompt\) \{\s*console\.error\("\[DirectPDFQA\] Missing prompt"\);\s*return \{ ok: false, status: 400, error: "Missing prompt\." \};\s*\}/g,
  `      const effectivePrompt = prompt?.trim() || \`\${year || ""} \${subject || ""} \${questionType || "question"} \${questionNo} answer\`;`
);

// We should also replace the usage of 'prompt' further down in general extraction, maybe?
// Wait, askGeminiDirectPdfStructured takes questionType, questionNo, doesn't even use prompt?
// Let's check what askGeminiDirectPdfStructured uses.

fs.writeFileSync('server/pdf/routes.ts', p);
