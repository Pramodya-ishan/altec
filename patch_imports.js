import fs from 'fs';
['src/components/views/PastPapersView.tsx', 'src/components/views/SyllabusLibraryView.tsx'].forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  if (!content.includes('import { openSourcePdf }')) {
    content = content.replace("import { cn } from '../../lib/utils';", "import { cn } from '../../lib/utils';\nimport { openSourcePdf } from '../../lib/sourceActions';");
  }
  content = content.replace('.catch((e) => {', '.catch((e: any) => {');
  fs.writeFileSync(file, content);
});
