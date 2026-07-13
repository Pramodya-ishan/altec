cat << 'INNER_EOF' > /tmp/fix_live_voice_props2.js
const fs = require('fs');
let code = fs.readFileSync('src/components/views/CloraXView.tsx', 'utf8');

code = code.replace(
  /activeSourceId=\{activeSourceId \|\| undefined\}/,
  `activeSourceId={uploadedFile?.sourceId || undefined}`
);

fs.writeFileSync('src/components/views/CloraXView.tsx', code);
INNER_EOF
node /tmp/fix_live_voice_props2.js
