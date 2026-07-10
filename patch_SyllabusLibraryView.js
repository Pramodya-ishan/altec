import fs from 'fs';
let content = fs.readFileSync('src/components/views/SyllabusLibraryView.tsx', 'utf8');

content = content.replace("import { openPrivateStoragePdf } from \"../../lib/clientStorageUpload\";", "import { openSourcePdf } from '../../lib/sourceActions';");
content = content.replace("import { openPrivateStoragePdf } from '../../lib/clientStorageUpload';", "import { openSourcePdf } from '../../lib/sourceActions';");

const oldClick = `onClick={() => {
                                if (r.storagePath) {
                                  openPrivateStoragePdf(r.storagePath).catch(err => {
                                    window.open(\`/api/rag/sources/\${r.id}/download\`, '_blank');
                                  });
                                }
                              }}`;

const newClick = `onClick={() => {
                                openSourcePdf({ storagePath: r.storagePath, id: r.id, url: \`/api/rag/sources/\${r.id}/download\` }).catch((e) => {
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
                                });
                              }}`;

content = content.replace(oldClick, newClick);

fs.writeFileSync('src/components/views/SyllabusLibraryView.tsx', content);
