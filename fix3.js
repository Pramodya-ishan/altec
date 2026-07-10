import fs from 'fs';

let p = fs.readFileSync('src/components/views/PaperStructureView.tsx', 'utf8');

p = p.replace(/\s*}\s*const timer = setTimeout\(\(\) => \{/, "\n });\n const timer = setTimeout(() => {");
p = p.replace(/\s*}\s*element\.classList\.add\('animate-highlight-flash'\);/, ");\n element.classList.add('animate-highlight-flash');");

fs.writeFileSync('src/components/views/PaperStructureView.tsx', p);
