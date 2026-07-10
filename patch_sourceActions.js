import fs from 'fs';
let content = fs.readFileSync('src/lib/sourceActions.ts', 'utf8');

const regex = /export async function openSourcePdf\(source: any\) \{([\s\S]*?)\}/;

const newBlock = `export async function openSourcePdf(source: any) {
  if (!source) throw new Error("MISSING_SOURCE");

  let lastError = null;

  if (source.storagePath) {
    try {
      await openFirebaseStoragePdf(source.storagePath);
      return;
    } catch (e: any) {
      console.warn("Failed to open Firebase Storage PDF:", e);
      lastError = e;
      // Fall through to try URLs if they exist
    }
  }

  if (source.url && /^https?:\\/\\//i.test(source.url)) {
    window.open(source.url, "_blank", "noopener,noreferrer");
    return;
  }

  if (source.url && source.url.startsWith("/api/")) {
    try {
       await openProtectedApiPdf(source.url);
       return;
    } catch(e: any) {
       console.warn("Failed to open protected API PDF:", e);
       lastError = e;
    }
  }

  if (source.apiUrl && source.apiUrl.startsWith("/api/")) {
    try {
       await openProtectedApiPdf(source.apiUrl);
       return;
    } catch(e: any) {
       console.warn("Failed to open protected API PDF (apiUrl):", e);
       lastError = e;
    }
  }

  throw lastError || new Error("NO_OPENABLE_PDF_SOURCE");
}`;

content = content.replace(regex, newBlock);

fs.writeFileSync('src/lib/sourceActions.ts', content);
