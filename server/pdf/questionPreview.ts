import { createHash } from "node:crypto";
import { getAdminBucket, getAdminDb } from "../firebase/admin";

export type NormalizedCrop = {
  x: number;
  y: number;
  width: number;
  height: number;
};

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
    const viewport = page.getViewport({ scale: 2 });
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

  const [exists] = await outputFile.exists().catch(() => [false]);
  if (!exists) {
    const rendered = await renderPdfPageCrop(params.pdfBuffer, pageNumber, crop);
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

  return { imageUrl, storagePath, pageNumber, crop };
}