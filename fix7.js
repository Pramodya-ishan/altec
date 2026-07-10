import fs from 'fs';

let p = fs.readFileSync('src/components/views/PaperStructureView.tsx', 'utf8');

p = p.replace(
  /if \(item\.title === topicName\) mcqMax = item\.count \|\| 10;\s*\}\s*\}/g,
  "if (item.title === topicName) mcqMax = item.count || 10;\n   });\n   }"
);

fs.writeFileSync('src/components/views/PaperStructureView.tsx', p);
