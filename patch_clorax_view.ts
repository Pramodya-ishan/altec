import fs from 'fs';
let code = fs.readFileSync('src/components/views/CloraXView.tsx', 'utf-8');

code = code.replace(/if \(res\.ok\) \{[\s\S]*?\} else \{[\s\S]*?alert\("Upload failed: " \+ \(res as any\)\.error\);[\s\S]*?\}/m, 
`if (res.ok) {
          if (res.needsOcr) {
             setInput(prev => prev + \`\\n[Uploaded PDF: \${file.name}] \${res.message} \`);
          } else {
             setInput(prev => prev + \`\\n[Uploaded PDF: \${file.name}] Please read this pdf and answer: \`);
          }
        } else {
          alert("Upload failed: " + ((res as any).message || (res as any).code || "Unknown error"));
        }`);

fs.writeFileSync('src/components/views/CloraXView.tsx', code);
