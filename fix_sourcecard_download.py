import re

with open("src/components/ui/SourceCard.tsx", "r") as f:
    c = f.read()

old_download = r'''  const handleDownload = async \(\) => \{
    try \{
      const currentUserUid = auth\?\.currentUser\?\.uid;
      if \(storagePath && ownerUid && currentUserUid && ownerUid === currentUserUid\) \{
        await openPrivateStoragePdf\(storagePath\);
        return;
      \}
      
      let tokenParam = '';
      if \(auth\?\.currentUser\) \{
        try \{
          const idToken = await auth\.currentUser\.getIdToken\(\);
          tokenParam = `\?token=\$\{encodeURIComponent\(idToken\)\}`;
        \} catch \(tokErr\) \{
          console\.warn\("Failed to get ID token:", tokErr\);
        \}
      \}
      window\.open\(`/api/rag/sources/\$\{id\}/download\$\{tokenParam\}`, '_blank'\);
    \} catch \(e\) \{'''

new_download = '''  const handleDownload = async () => {
    try {
      if (storagePath) {
        await openPrivateStoragePdf(storagePath);
        return;
      }
      
      let tokenParam = '';
      if (auth?.currentUser) {
        try {
          const idToken = await auth.currentUser.getIdToken();
          tokenParam = `?token=${encodeURIComponent(idToken)}`;
        } catch (tokErr) {
          console.warn("Failed to get ID token:", tokErr);
        }
      }
      window.open(`/api/rag/sources/${id}/download${tokenParam}`, '_blank');
    } catch (e) {'''

c = re.sub(old_download, new_download, c)

with open("src/components/ui/SourceCard.tsx", "w") as f:
    f.write(c)
