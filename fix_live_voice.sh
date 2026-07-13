cat << 'INNER_EOF' > /tmp/fix_live_voice.js
const fs = require('fs');
let code = fs.readFileSync('src/components/chat/LiveVoiceChatModal.tsx', 'utf8');

code = code.replace(/import \{ auth, storage \} from '\.\.\/\.\.\/lib\/firebase';\\nimport \{ ref, getDownloadURL \} from 'firebase\/storage';/, "import { auth, storage } from '../../lib/firebase';\nimport { ref, getDownloadURL } from 'firebase/storage';");

code = code.replace(/  currentSubject\?: string;\n  activeSourceId\?: string;\n  recentAttachmentIds\?: string\[\];/, "");

fs.writeFileSync('src/components/chat/LiveVoiceChatModal.tsx', code);
INNER_EOF
node /tmp/fix_live_voice.js
