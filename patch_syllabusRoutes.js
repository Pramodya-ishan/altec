import fs from 'fs';
let content = fs.readFileSync('server/syllabus/routes.ts', 'utf8');

const regex = /\/\/ Try to create a signed URL first \(\valid for 15 mins\) and redirect([\s\S]*?)\/\/ Fallback: direct stream/m;

const newBlock = `// Always stream the file directly because signed URL requires Admin Storage which is degraded
    // Fallback: direct stream`;

content = content.replace(regex, newBlock);

fs.writeFileSync('server/syllabus/routes.ts', content);
