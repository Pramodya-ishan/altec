import fs from 'fs';
let content = fs.readFileSync('server/rag/routes.ts', 'utf8');

const regex = /if \(!shouldStream\) \{([\s\S]*?)const readStream = file\.createReadStream\(\);/m;

const newBlock = `if (!shouldStream || shouldStream) {
      // Always stream the file because signed URL requires Admin Storage which is degraded
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", \`inline; filename="\${data.title || 'document'}.pdf"\`);
      
      const readStream = file.createReadStream();`;

content = content.replace(regex, newBlock);

fs.writeFileSync('server/rag/routes.ts', content);
