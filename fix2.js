import fs from 'fs';

let p = fs.readFileSync('src/components/views/PaperStructureView.tsx', 'utf8');

p = p.replace(
  "setCollapsedSections({\n mcq: false,\n partA: false,\n partBCD: false,\n }\n const timer = setTimeout",
  "setCollapsedSections({\n mcq: false,\n partA: false,\n partBCD: false,\n });\n const timer = setTimeout"
);

p = p.replace(
  "element.scrollIntoView({ behavior: 'smooth', block: 'center' }\n element.classList.add",
  "element.scrollIntoView({ behavior: 'smooth', block: 'center' });\n element.classList.add"
);

fs.writeFileSync('src/components/views/PaperStructureView.tsx', p);
