import fs from 'fs';

let content = fs.readFileSync('src/lib/ai/directPdfQa.ts', 'utf8');

const regex = /if \(normalized\.kind === "downloadUrl"\) \{([\s\S]*?)\} else \{([\s\S]*?)\}/;

const newLogic = `if (normalized.kind === "downloadUrl" || normalized.path) {
      let downloadUrl = "";
      if (normalized.kind === "downloadUrl") {
         downloadUrl = normalized.url;
      } else {
         try {
             downloadUrl = await getDownloadURL(ref(storage, normalized.path));
         } catch(e) {
             console.error("Failed to get download URL", e);
             throw makeDirectQaError("DIRECT_QA_FIREBASE_FETCH_FAILED", source, {
                status: 500,
                statusText: "Storage rules / App Check / login check",
                message: "PDF source එක තියෙනවා, නමුත් Storage permission නිසා open/scan කරන්න බැහැ. Storage rules/App Check/login check කරන්න."
             });
         }
      }
      
      console.info("[DirectPDFQA] Fetching blob from client...");
      // Fetching from download URL
      const r = await fetch(downloadUrl);
      if (!r.ok) {
        throw makeDirectQaError("DIRECT_QA_FIREBASE_FETCH_FAILED", source, {
          status: r.status,
          statusText: r.statusText,
          url: downloadUrl
        });
      }
      const blob = await r.blob();
      formData.append("file", blob, source.fileName || \`\${source.id || source.sourceId}.pdf\`);
    }`;

content = content.replace(regex, newLogic);
content = content.replace(`const endpoint = \`\${apiBase}/api/pdf/direct-qa\`;`, `const endpoint = \`\${apiBase}/api/pdf/direct-qa-file\`;`);

fs.writeFileSync('src/lib/ai/directPdfQa.ts', content);
