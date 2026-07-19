import { createHash } from "node:crypto";
import { getAdminBucket, getAdminDb } from "../firebase/admin";

export type NormalizedCrop = {
  x: number;
  y: number;
  width: number;
  height: number;
};

function escapeSvg(value: unknown) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .slice(0, 120);
}

export function createPdfQuestionPreviewFallback(params: { title?: unknown; pageNumber?: unknown; code?: unknown }) {
  const pageNumber = Math.max(1, Math.floor(Number(params.pageNumber) || 1));
  const title = escapeSvg(params.title || "PDF document");
  const code = escapeSvg(params.code || "PDF_PREVIEW_UNAVAILABLE");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="720" viewBox="0 0 1200 720" role="img" aria-label="PDF preview unavailable"><rect width="1200" height="720" fill="#f8fafc"/><rect x="90" y="70" width="1020" height="580" rx="36" fill="#fff" stroke="#cbd5e1" stroke-width="4"/><path d="M220 180h250l100 100v260H220z" fill="#eef2ff" stroke="#6366f1" stroke-width="8"/><path d="M470 180v110h100" fill="none" stroke="#6366f1" stroke-width="8"/><text x="640" y="245" font-family="Arial, sans-serif" font-size="46" font-weight="700" fill="#0f172a">PDF preview unavailable</text><text x="640" y="315" font-family="Arial, sans-serif" font-size="30" fill="#475569">${title}</text><text x="640" y="365" font-family="Arial, sans-serif" font-size="28" fill="#475569">Page ${pageNumber}</text><text x="640" y="430" font-family="Arial, sans-serif" font-size="22" fill="#64748b">The answer can still use verified text evidence.</text><text x="640" y="475" font-family="monospace" font-size="18" fill="#94a3b8">${code}</text></svg>`;
  return {
    imageUrl: `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`,
    storagePath: null,
    pageNumber,
    crop: null,
    delivery: "inline_fallback" as const,
    previewUnavailable: true,
  };
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function normalizeCrop(value: any): NormalizedCrop {
  const x = clamp(Number(value?.x) || 0, 0, 1);
  const y = clamp(Number(value?.y) || 0, 0, 1);
  const width = clamp(Number(value?.width) || 1, 0.08, 1 - x);
  const height = clamp(Number(value?.height) || 1, 0.08, 1 - y);
  const padding = 0.025;
  return {
    x: clamp(x - padding, 0, 1),
    y: clamp(y - padding, 0, 1),
    width: clamp(width + padding * 2, 0.08, 1 - clamp(x - padding, 0, 1)),
    height: clamp(height + padding * 2, 0.08, 1 - clamp(y - padding, 0, 1)),
  };
}

async function loadPdfRenderer() {
  const canvasModule: any = await import("@napi-rs/canvas");
  if (!(globalThis as any).DOMMatrix && canvasModule.DOMMatrix) (globalThis as any).DOMMatrix = canvasModule.DOMMatrix;
  if (!(globalThis as any).Path2D && canvasModule.Path2D) (globalThis as any).Path2D = canvasModule.Path2D;
  if (!(globalThis as any).ImageData && canvasModule.ImageData) (globalThis as any).ImageData = canvasModule.ImageData;
  const pdfjs: any = await import("pdfjs-dist/legacy/build/pdf.mjs");
  return { pdfjs, createCanvas: canvasModule.createCanvas };
}

export async function renderPdfPageCrop(
  pdfBuffer: Buffer,
  pageNumberValue: number,
  cropValue?: Partial<NormalizedCrop> | null,
) {
  const pageNumber = Math.max(1, Math.floor(Number(pageNumberValue) || 1));
  const crop = normalizeCrop(cropValue || null);
  const { pdfjs, createCanvas } = await loadPdfRenderer();
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(pdfBuffer),
    disableWorker: true,
    useSystemFonts: true,
    isEvalSupported: false,
  });
  const pdf = await loadingTask.promise;
  let page: any = null;
  try {
    if (pageNumber > pdf.numPages) {
      throw new Error(`PDF page ${pageNumber} does not exist.`);
    }

    page = await pdf.getPage(pageNumber);
    const baseViewport = page.getViewport({ scale: 1 });
    // Keep previews sharp enough for dimensions and Sinhala glyphs without
    // producing multi-megabyte inline fallbacks on unusually large pages.
    const longestEdge = Math.max(baseViewport.width, baseViewport.height);
    const renderScale = Math.max(1.25, Math.min(2, 1_800 / Math.max(1, longestEdge)));
    const viewport = page.getViewport({ scale: renderScale });
    const pageCanvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    const pageContext = pageCanvas.getContext("2d");
    await page.render({ canvasContext: pageContext, viewport } as any).promise;

    const sourceX = Math.floor(crop.x * pageCanvas.width);
    const sourceY = Math.floor(crop.y * pageCanvas.height);
    const sourceWidth = Math.max(1, Math.min(pageCanvas.width - sourceX, Math.floor(crop.width * pageCanvas.width)));
    const sourceHeight = Math.max(1, Math.min(pageCanvas.height - sourceY, Math.floor(crop.height * pageCanvas.height)));
    const outputCanvas = createCanvas(sourceWidth, sourceHeight);
    const outputContext = outputCanvas.getContext("2d");
    outputContext.drawImage(
      pageCanvas,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      0,
      0,
      sourceWidth,
      sourceHeight,
    );

    return {
      png: outputCanvas.toBuffer("image/png") as Buffer,
      pageNumber,
      crop,
      width: sourceWidth,
      height: sourceHeight,
    };
  } finally {
    if (page) await page.cleanup();
    await pdf.destroy();
  }
}

export async function createPdfQuestionPreview(params: {
  uid: string;
  sourceId: string;
  pdfBuffer: Buffer;
  pageNumber: number;
  crop?: Partial<NormalizedCrop> | null;
  title?: string;
}) {
  const pageNumber = Math.max(1, Math.floor(Number(params.pageNumber) || 1));
  const crop = normalizeCrop(params.crop || null);
  const cropKey = createHash("sha1")
    .update(JSON.stringify({ pageNumber, crop }))
    .digest("hex")
    .slice(0, 12);
  const safeSourceId = String(params.sourceId || "source").replace(/[^a-zA-Z0-9_-]/g, "_");
  const storagePath = `pdf_question_previews/${params.uid}/${safeSourceId}/page-${pageNumber}-${cropKey}.png`;
  const bucket = getAdminBucket();
  const outputFile = bucket.file(storagePath);

  let rendered: Awaited<ReturnType<typeof renderPdfPageCrop>> | null = null;

  // Storage is only a cache. A missing object-signing IAM permission must not
  // turn an otherwise valid PDF crop into a 500 response.
  try {
    const [exists] = await outputFile.exists().catch(() => [false]);
    if (!exists) {
      rendered = await renderPdfPageCrop(params.pdfBuffer, pageNumber, crop);
      await outputFile.save(rendered.png, {
        resumable: false,
        metadata: {
          contentType: "image/png",
          cacheControl: "private, max-age=86400",
          metadata: {
            sourceId: params.sourceId,
            pageNumber: String(pageNumber),
            createdBy: params.uid,
          },
        },
      });

      await getAdminDb().collection("pdf_question_previews").doc(`${safeSourceId}_${pageNumber}_${cropKey}`).set({
        sourceId: params.sourceId,
        ownerUid: params.uid,
        pageNumber,
        crop,
        storagePath,
        title: params.title || null,
        createdAt: new Date().toISOString(),
      }, { merge: true }).catch(() => undefined);
    }

    const [imageUrl] = await outputFile.getSignedUrl({
      action: "read",
      expires: Date.now() + 24 * 60 * 60 * 1000,
      responseType: "image/png",
      responseDisposition: "inline",
    });
    return { imageUrl, storagePath, pageNumber, crop, delivery: "signed_url" as const };
  } catch (storageError) {
    console.warn("[PDF_PREVIEW] Storage cache/signing unavailable; returning inline crop", {
      sourceId: params.sourceId,
      pageNumber,
      error: String(storageError),
    });
    rendered ||= await renderPdfPageCrop(params.pdfBuffer, pageNumber, crop);
    return {
      imageUrl: `data:image/png;base64,${rendered.png.toString("base64")}`,
      storagePath: null,
      pageNumber,
      crop,
      delivery: "inline" as const,
    };
  }
}
