import fs from 'fs';
let content = fs.readFileSync('src/components/ui/SourceCard.tsx', 'utf8');

content = content.replace("import { openPrivateStoragePdf } from '../../lib/clientStorageUpload';", "import { openSourcePdf } from '../../lib/sourceActions';");

const oldHandleDownload = `const handleDownload = async () => {
    try {
      if (storagePath) {
        await openPrivateStoragePdf(storagePath);
        return;
      }
      
      let tokenParam = '';
      if (auth?.currentUser) {
        try {
          const idToken = await auth.currentUser.getIdToken();
          tokenParam = \`?token=\${encodeURIComponent(idToken)}\`;
        } catch (tokErr) {
          console.warn("Failed to get ID token:", tokErr);
        }
      }
      window.open(\`/api/rag/sources/\${id}/download\${tokenParam}\`, '_blank');
    } catch (e) {
      console.error('Download trigger failed:', e);
    }
  };`;

const newHandleDownload = `const handleDownload = async () => {
    try {
      await openSourcePdf({ storagePath, id, url: \`/api/rag/sources/\${id}/download\` });
    } catch (e: any) {
      console.error('Download trigger failed:', e);
      if (e.message?.includes('LOGIN_REQUIRED')) {
         alert('PDF open කරන්න login අවශ්‍යයි. නැවත sign in කරන්න.');
      } else if (e.message?.includes('storage/unauthorized')) {
         alert('PDF permission denied. Storage rules / App Check / login check කරන්න.');
      } else if (e.message?.includes('NOT_A_PDF_RESPONSE')) {
         alert('PDF වෙනුවට server error response එකක් ආවා. Source route/auth fix කරන්න.');
      } else if (e.message?.includes('NO_OPENABLE_PDF_SOURCE')) {
         alert('මේ source එකට storagePath හෝ public URL එකක් නැහැ.');
      } else {
         alert('Error opening PDF: ' + e.message);
      }
    }
  };`;

content = content.replace(oldHandleDownload, newHandleDownload);

fs.writeFileSync('src/components/ui/SourceCard.tsx', content);
