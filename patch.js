import fs from 'fs';
const content = fs.readFileSync('server/pdf/routes.ts', 'utf8');
const updated = content.replace(
  `        const [downloaded] = await file.download();\n        buffer = downloaded;`,
  `        const { retryGoogleAuthOperation } = await import("../utils/retry");\n        const [downloaded] = await retryGoogleAuthOperation("directPdfQaDownload", async () => await file.download());\n        buffer = downloaded;`
);
fs.writeFileSync('server/pdf/routes.ts', updated);
