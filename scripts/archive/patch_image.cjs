const fs = require('fs');
let file = 'server/image/generate.ts';
let content = fs.readFileSync(file, 'utf8');

// The @google/genai SDK often nests these under `config` or simply omits them if not needed.
// Let's just remove the numberOfImages option to be safe if it's not accepted at the root.
content = content.replace(/numberOfImages: 1,\s*output_mime_type: "image\/jpeg"/, `config: { numberOfImages: 1, outputMimeType: "image/jpeg" }`);

fs.writeFileSync(file, content);
