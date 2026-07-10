import { getAdminStorage } from "../firebase/admin";

interface TextPage {
  pageNumber: number;
  text: string;
  confidence?: number;
}

export async function generateSinhalaTextPdf(params: {
  uid: string;
  sourceId: string;
  fileName: string;
  title: string;
  subject: string;
  year?: string | null;
  extractionMethod: string;
  pages: TextPage[];
}): Promise<{
  ocrTextPdfStoragePath: string | null;
  ocrTextStoragePath: string | null;
  ocrTextPdfStatus: "ready" | "failed_storage_upload" | "disabled";
}> {
  const { uid, sourceId, fileName, title, subject, year, extractionMethod, pages } = params;
  const storage = getAdminStorage();
  const bucket = storage.bucket(); // Default al-ai-chat.firebasestorage.app bucket

  // Safe file name for storage path
  const safeFileName = fileName
    .replace(/\.[^/.]+$/, "") // remove extension
    .replace(/[^a-zA-Z0-9_\u0D80-\u0DFF-]/g, "_");

  const jsonStoragePath = `users/${uid}/ocr_text/${sourceId}/pages.json`;
  const htmlStoragePath = `users/${uid}/ocr_text_pdfs/${sourceId}/${safeFileName}_sinhala_text.html`;

  try {
    // 1. Save raw pages to JSON
    const jsonFile = bucket.file(jsonStoragePath);
    await jsonFile.save(
      JSON.stringify({
        sourceId,
        title,
        fileName,
        subject,
        year,
        extractionMethod,
        pages,
        generatedAt: new Date().toISOString(),
      }, null, 2),
      {
        contentType: "application/json",
        metadata: {
          owner: uid,
          sourceId,
        }
      }
    );
    console.log(`Saved OCR raw pages JSON to: ${jsonStoragePath}`);

    // 2. Build elegant print-friendly HTML string
    let htmlContent = `<!DOCTYPE html>
<html lang="si">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - Sinhala Text Version</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Sinhala:wght@400;500;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
    
    body {
      font-family: "Noto Sans Sinhala", "Inter", sans-serif;
      line-height: 1.8;
      color: #1e293b;
      background-color: #f8fafc;
      margin: 0;
      padding: 0;
    }

    .container {
      max-width: 800px;
      margin: 40px auto;
      background: #ffffff;
      box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid #e2e8f0;
    }

    .doc-header {
      background-color: #0f172a;
      color: #ffffff;
      padding: 32px;
      border-bottom: 4px solid #3b82f6;
    }

    .doc-header h1 {
      margin: 0 0 12px 0;
      font-size: 24px;
      font-weight: 700;
      line-height: 1.3;
    }

    .metadata-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 16px;
      font-size: 13px;
      opacity: 0.9;
    }

    .metadata-item span {
      display: block;
      color: #94a3b8;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 2px;
    }

    .metadata-item strong {
      color: #f1f5f9;
      font-weight: 500;
    }

    .page {
      padding: 40px;
      border-bottom: 1px dashed #e2e8f0;
      position: relative;
    }

    .page:last-child {
      border-bottom: none;
    }

    .page-num {
      position: absolute;
      top: 40px;
      right: 40px;
      font-family: "JetBrains Mono", monospace;
      font-size: 12px;
      color: #94a3b8;
      background: #f1f5f9;
      padding: 2px 8px;
      border-radius: 4px;
    }

    .page-title {
      font-size: 14px;
      font-weight: 600;
      color: #3b82f6;
      margin-top: 0;
      margin-bottom: 24px;
      border-bottom: 1px solid #f1f5f9;
      padding-bottom: 8px;
    }

    .page-content {
      font-size: 16px;
      white-space: pre-wrap;
      word-break: break-word;
    }

    .page-content p {
      margin-top: 0;
      margin-bottom: 16px;
    }

    .diagram-desc {
      background-color: #eff6ff;
      border-left: 4px solid #3b82f6;
      padding: 16px;
      margin: 20px 0;
      border-radius: 0 8px 8px 0;
      font-size: 14px;
      font-style: italic;
    }

    .footer {
      text-align: center;
      padding: 24px;
      font-size: 12px;
      color: #64748b;
      background-color: #f8fafc;
      border-top: 1px solid #e2e8f0;
    }

    @media print {
      body {
        background-color: #ffffff;
      }
      .container {
        box-shadow: none;
        border: none;
        max-width: 100%;
        margin: 0;
      }
      .doc-header {
        background-color: #ffffff !important;
        color: #000000 !important;
        border-bottom: 2px solid #000000;
        padding: 20px 0;
      }
      .metadata-item strong {
        color: #000000 !important;
      }
      .page {
        page-break-after: always;
        padding: 20px 0;
      }
      .footer {
        display: none;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <header class="doc-header">
      <h1>${title || fileName}</h1>
      <div class="metadata-grid">
        <div class="metadata-item">
          <span>Subject / විෂය</span>
          <strong>${subject || "N/A"}</strong>
        </div>
        <div class="metadata-item">
          <span>Year / වර්ෂය</span>
          <strong>${year || "N/A"}</strong>
        </div>
        <div class="metadata-item">
          <span>Method / ක්‍රමය</span>
          <strong>${extractionMethod.replace(/_/g, " ").toUpperCase()}</strong>
        </div>
        <div class="metadata-item">
          <span>Generated / සාදන ලදී</span>
          <strong>${new Date().toLocaleDateString("si-LK")}</strong>
        </div>
      </div>
    </header>

    <main>`;

    for (const page of pages) {
      // Light cleanup of page text for display
      const cleanText = page.text
        .replace(/\s+/g, " ")
        .trim();

      htmlContent += `
      <section class="page">
        <div class="page-num">Page ${page.pageNumber}</div>
        <div class="page-title">පිටුව ${page.pageNumber} / Page ${page.pageNumber}</div>
        <div class="page-content">${cleanText || "<i>(මෙම පිටුවේ කිසිදු අකුරක් හඳුනාගත නොහැකි විය / No text detected on this page)</i>"}</div>
      </section>`;
    }

    htmlContent += `
    </main>

    <footer class="footer">
      Clora X / A.L Tech Blueprint - Sinhala-First A/L Learning Platform &copy; ${new Date().getFullYear()}
    </footer>
  </div>
</body>
</html>`;

    // 3. Upload HTML file to Firebase Storage
    const htmlFile = bucket.file(htmlStoragePath);
    await htmlFile.save(htmlContent, {
      contentType: "text/html",
      metadata: {
        owner: uid,
        sourceId,
      }
    });
    console.log(`Successfully generated and uploaded readable HTML document to GCS: ${htmlStoragePath}`);

    return {
      ocrTextPdfStoragePath: htmlStoragePath,
      ocrTextStoragePath: jsonStoragePath,
      ocrTextPdfStatus: "ready",
    };
  } catch (error: any) {
    console.error("Error generating Sinhala text HTML/PDF document:", error);
    return {
      ocrTextPdfStoragePath: null,
      ocrTextStoragePath: jsonStoragePath,
      ocrTextPdfStatus: "failed_storage_upload",
    };
  }
}
