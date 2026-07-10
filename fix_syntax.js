import fs from 'fs';
let p = fs.readFileSync('src/components/views/CloraXView.tsx', 'utf8');

const regex = /\{\/\* Replaced button logic \*\/ false && \([\s\S]*?<\/button>\)\}/;
p = p.replace(regex, '');

fs.writeFileSync('src/components/views/CloraXView.tsx', p);
