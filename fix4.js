import fs from 'fs';

let p = fs.readFileSync('src/components/views/PaperStructureView.tsx', 'utf8');

p = p.replace(
  "}\n if (overlap > bestOverlapCount) {",
  "});\n if (overlap > bestOverlapCount) {"
);

p = p.replace(
  "}\n if (bestIndex !== -1 && bestOverlapCount >= 1) {",
  "});\n if (bestIndex !== -1 && bestOverlapCount >= 1) {"
);

fs.writeFileSync('src/components/views/PaperStructureView.tsx', p);
