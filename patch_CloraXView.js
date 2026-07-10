import fs from 'fs';
let content = fs.readFileSync('src/components/views/CloraXView.tsx', 'utf8');

const oldClick = `onClick={() => {
                          if (src.storagePath) {
                              import('../../lib/clientStorageUpload').then(m => m.openPrivateStoragePdf(src.storagePath));
                          } else if (src.url) {
                              window.open(src.url, '_blank');
                          }
                        }}`;

const newClick = `onClick={() => {
                          import('../../lib/sourceActions').then(m => {
                            m.openSourcePdf(src).catch((e: any) => {
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
                          });
                        }}`;

content = content.replace(oldClick, newClick);

fs.writeFileSync('src/components/views/CloraXView.tsx', content);
