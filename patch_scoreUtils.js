import fs from 'fs';

function patchFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  if (!content.includes("import { calculateSubjectAveragePercent, calculateSubjectZ } from '../../lib/scoreUtils';")) {
    content = "import { calculateSubjectAveragePercent, calculateSubjectZ } from '../../lib/scoreUtils';\n" + content;
  }
  
  // Need to replace the dynamic import blocks.
  // In PaperStructureView:
  // import('../../lib/scoreUtils').then(({ calculateSubjectAveragePercent, calculateSubjectZ }) => {
  //   const avg = calculateSubjectAveragePercent(marks, activeSubject);
  //   setZscore(calculateSubjectZ(avg, activeSubject));
  // });
  
  content = content.replace(
    /import\('\.\.\/\.\.\/lib\/scoreUtils'\)\.then\(\(\{ calculateSubjectAveragePercent, calculateSubjectZ \}\) => \{([\s\S]*?)\}\);/g,
    `{
$1
    }`
  );
  
  fs.writeFileSync(filePath, content);
}

patchFile('src/components/views/PaperStructureView.tsx');
patchFile('src/components/modals/AddPaperMarksModal.tsx');
