const fs = require('fs');

// Fix server/ai/routes.ts
let routesFile = 'server/ai/routes.ts';
let routesContent = fs.readFileSync(routesFile, 'utf8');
routesContent = routesContent.replace(/result\.code === 'QUOTA_EXCEEDED'/, `(result as any).code === 'QUOTA_EXCEEDED'`);
fs.writeFileSync(routesFile, routesContent);

// Fix server/image/generate.ts
let imageFile = 'server/image/generate.ts';
let imageContent = fs.readFileSync(imageFile, 'utf8');
imageContent = imageContent.replace(/number_of_images:/, `numberOfImages:`);
fs.writeFileSync(imageFile, imageContent);

