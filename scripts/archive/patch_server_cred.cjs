const fs = require('fs');
let file = 'server.ts';
let content = fs.readFileSync(file, 'utf8');

const replacement = `
if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
  try {
    let credStr = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON.trim();
    if (!credStr.startsWith('{')) credStr = '{' + credStr;
    if (!credStr.endsWith('}')) credStr = credStr + '}';
    // Validate JSON
    JSON.parse(credStr);
    
    fs.writeFileSync('/tmp/google-credentials.json', credStr);
    process.env.GOOGLE_APPLICATION_CREDENTIALS = '/tmp/google-credentials.json';
    console.log("Successfully wrote GOOGLE_APPLICATION_CREDENTIALS_JSON to /tmp/google-credentials.json");
  } catch (err) {
    console.error("Failed to write GOOGLE_APPLICATION_CREDENTIALS_JSON:", err);
  }
}
`;

content = content.replace(/if \(process\.env\.GOOGLE_APPLICATION_CREDENTIALS_JSON\) \{[\s\S]*?console\.error\("Failed to write GOOGLE_APPLICATION_CREDENTIALS_JSON:", err\);\s*\n\s*\}\s*\n\}/, replacement.trim());

fs.writeFileSync(file, content);
