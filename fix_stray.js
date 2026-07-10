import fs from 'fs';
let p = fs.readFileSync('src/components/views/CloraXView.tsx', 'utf8');

p = p.replace(/\n\s*\)\}\s*\n\s*\)\}/g, '\n                )}');
fs.writeFileSync('src/components/views/CloraXView.tsx', p);
