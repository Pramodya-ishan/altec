import fs from 'fs';

function patchFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  if (content.includes('retryGoogleAuthOperation')) {
      if (!content.includes('const [buffer] = await retryGoogleAuthOperation') && !content.includes('const [contentBuffer] = await retryGoogleAuthOperation') && !content.includes('const [downloaded] = await retryGoogleAuthOperation')) {
           content = content.replace(/const \[(.*?)\] = await file\.download\(\);/g, 'const [$1] = await retryGoogleAuthOperation("fileDownload", async () => await file.download());');
           fs.writeFileSync(filePath, content);
      }
  } else {
      const importStmt = `import { retryGoogleAuthOperation } from "../utils/retry";\n`;
      let importStmtCustom = importStmt;
      if (filePath.includes("ai-core/pdf/indexing")) {
          importStmtCustom = `import { retryGoogleAuthOperation } from "../../utils/retry";\n`;
      } else if (filePath.includes("ocr/cloudVisionOcr")) {
          importStmtCustom = `import { retryGoogleAuthOperation } from "../utils/retry";\n`;
      }
      content = importStmtCustom + content;
      content = content.replace(/const \[(.*?)\] = await file\.download\(\);/g, 'const [$1] = await retryGoogleAuthOperation("fileDownload", async () => await file.download());');
      fs.writeFileSync(filePath, content);
  }
}

patchFile('server/ai-core/pdf/indexing.ts');
patchFile('server/rag/routes.ts');
patchFile('server/pdf/routes.ts');
patchFile('server/ocr/cloudVisionOcr.ts');

