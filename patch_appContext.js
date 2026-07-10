import fs from 'fs';

let content = fs.readFileSync('src/context/AppContext.tsx', 'utf8');

// replace dynamic import with static import
if (!content.includes("import { calculateCurrentGradeFromData } from '../lib/utils';")) {
  content = "import { calculateCurrentGradeFromData } from '../lib/utils';\n" + content;
}
content = content.replace(
  "const { calculateCurrentGradeFromData } = await import('../lib/utils');\n",
  ""
);

fs.writeFileSync('src/context/AppContext.tsx', content);
