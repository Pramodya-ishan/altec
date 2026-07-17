import { retryGoogleAuthOperation } from "../utils/retry";
import { ImageAnnotatorClient } from "@google-cloud/vision";
import { getAdminStorage, getAdminDb } from "../firebase/admin";

interface OcrPageResult {
  pageNumber: number;
  text: string;
  confidence: number;
}

interface OcrFullResult {
  pages: OcrPageResult[];
  fullText: string;
  provider: "cloud_vision";
  confidence: number;
}

let visionClient: ImageAnnotatorClient | null = null;

function getVisionClient(): ImageAnnotatorClient {
  if (!visionClient) {
    const isEnabled = process.env.ENABLE_CLOUD_VISION_OCR === "true"
      || process.env.OCR_ENABLED === "true";
    if (!isEnabled) {
      throw new Error("Cloud Vision OCR is not enabled (ENABLE_CLOUD_VISION_OCR/OCR_ENABLED is not true).");
    }
    // Automatically picks up credentials via ADC (Application Default Credentials)
    visionClient = new ImageAnnotatorClient();
  }
  return visionClient;
}

export async function runCloudVisionPdfOcr(params: {
  sourceId: string;
  uid: string;
  buffer: Buffer;
  gcsInputUri?: string;
  languageHints?: string[];
}): Promise<{
  queued: boolean;
  operationName?: string;
  result?: OcrFullResult;
}> {
  const { sourceId, uid, buffer, languageHints = ["si", "en"] } = params;

  const inputBucketName = process.env.VISION_OCR_INPUT_BUCKET
    || process.env.OCR_INPUT_BUCKET
    || "al-ai-chat-ocr-input";
  const outputBucketName = process.env.VISION_OCR_OUTPUT_BUCKET
    || process.env.OCR_OUTPUT_BUCKET
    || "al-ai-chat-ocr-output";

  const client = getVisionClient();
  const storage = getAdminStorage();

  // 1. Upload buffer to GCS if not already provided
  const gcsSourceUri = params.gcsInputUri || `gs://${inputBucketName}/jobs/${sourceId}/original.pdf`;
  
  if (!params.gcsInputUri) {
    const inputBucket = storage.bucket(inputBucketName);
    const gcsFile = inputBucket.file(`jobs/${sourceId}/original.pdf`);
    await gcsFile.save(buffer, {
      contentType: "application/pdf",
      metadata: {
        owner: uid,
        sourceId,
      }
    });
    console.log(`Uploaded PDF to ${gcsSourceUri} for Cloud Vision OCR`);
  }

  const gcsDestinationUri = `gs://${outputBucketName}/jobs/${sourceId}/`;

  const request = {
    requests: [
      {
        inputConfig: {
          mimeType: "application/pdf",
          gcsSource: {
            uri: gcsSourceUri,
          },
        },
        features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
        outputConfig: {
          gcsDestination: {
            uri: gcsDestinationUri,
          },
        },
        imageContext: {
          languageHints,
        },
      },
    ],
  };

  console.log(`Triggering asyncBatchAnnotateFiles for sourceId: ${sourceId}`);
  const [operation] = await client.asyncBatchAnnotateFiles(request as any);
  const operationName = operation.name;

  if (!operationName) {
    throw new Error("Failed to start Cloud Vision asyncBatchAnnotateFiles operation.");
  }

  // Save the operation reference in firestore
  const db = getAdminDb();
  await db.collection("ocr_jobs").doc(sourceId).set({
    sourceId,
    uid,
    operationName,
    status: "running",
    inputUri: gcsSourceUri,
    outputUri: gcsDestinationUri,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  // Attempt to wait synchronously up to 25 seconds for small PDFs
  console.log(`Started Cloud Vision OCR operation: ${operationName}. Polling for quick completion...`);
  
  const startTime = Date.now();
  let completedResponse: any = null;
  
  while (Date.now() - startTime < 25000) {
    try {
      const [op] = await client.operationsClient.getOperation({ name: operationName } as any);
      if (op.done) {
        completedResponse = op;
        break;
      }
    } catch (pollErr) {
      console.warn("Polling operation error (ignoring and retrying):", pollErr);
    }
    await new Promise((resolve) => setTimeout(resolve, 2500));
  }

  if (completedResponse && completedResponse.done) {
    console.log(`Cloud Vision OCR finished quickly! Downloading and parsing output...`);
    const result = await parseOcrOutputFromGcs(sourceId);
    
    await db.collection("ocr_jobs").doc(sourceId).update({
      status: "ready",
      updatedAt: new Date().toISOString(),
    });

    return { queued: false, result };
  }

  // Otherwise, it takes longer. Return queued state.
  return { queued: true, operationName };
}

export async function checkOcrJobStatus(sourceId: string): Promise<{
  status: "queued" | "running" | "ready" | "failed";
  error?: string;
  result?: OcrFullResult;
}> {
  const db = getAdminDb();
  const jobSnap = await db.collection("ocr_jobs").doc(sourceId).get();
  
  if (!jobSnap.exists) {
    return { status: "queued" };
  }

  const jobData = jobSnap.data();
  if (jobData.status === "ready") {
    try {
      const result = await parseOcrOutputFromGcs(sourceId);
      return { status: "ready", result };
    } catch (err: any) {
      return { status: "failed", error: `Failed to parse OCR outputs: ${err.message}` };
    }
  }

  if (jobData.status === "failed") {
    return { status: "failed", error: jobData.error || "OCR job failed." };
  }

  const operationName = jobData.operationName;
  if (!operationName) {
    return { status: "failed", error: "Missing operation name in database." };
  }

  try {
    const client = getVisionClient();
    const [op] = await client.operationsClient.getOperation({ name: operationName } as any);
    
    if (op.error) {
      const errMsg = op.error.message || "Unknown error during GCV async processing";
      await db.collection("ocr_jobs").doc(sourceId).update({
        status: "failed",
        error: errMsg,
        updatedAt: new Date().toISOString(),
      });
      return { status: "failed", error: errMsg };
    }

    if (op.done) {
      console.log(`Cloud Vision OCR background job finished. Downloading and parsing output...`);
      const result = await parseOcrOutputFromGcs(sourceId);
      
      await db.collection("ocr_jobs").doc(sourceId).update({
        status: "ready",
        updatedAt: new Date().toISOString(),
      });

      return { status: "ready", result };
    }

    return { status: "running" };
  } catch (err: any) {
    console.error("Error checking Cloud Vision operation status:", err);
    return { status: "running" }; // Treat as running until verified failure
  }
}

async function parseOcrOutputFromGcs(sourceId: string): Promise<OcrFullResult> {
  const outputBucketName = process.env.VISION_OCR_OUTPUT_BUCKET
    || process.env.OCR_OUTPUT_BUCKET
    || "al-ai-chat-ocr-output";
  const storage = getAdminStorage();
  const outputBucket = storage.bucket(outputBucketName);

  // List all JSON files created in jobs/{sourceId}/
  const prefix = `jobs/${sourceId}/`;
  const [files] = await outputBucket.getFiles({ prefix });

  const jsonFiles = files.filter(f => f.name.endsWith(".json"));
  if (jsonFiles.length === 0) {
    throw new Error(`No OCR output JSON files found in bucket ${outputBucketName} at ${prefix}`);
  }

  const pages: OcrPageResult[] = [];

  for (const file of jsonFiles) {
    const [contentBuffer] = await retryGoogleAuthOperation("fileDownload", async () => await file.download());
    const content = JSON.parse(contentBuffer.toString("utf8"));

    if (content.responses && Array.isArray(content.responses)) {
      for (const resp of content.responses) {
        const pageNumber = resp.context?.pageNumber || 1;
        const text = resp.fullTextAnnotation?.text || "";
        
        // Compute average confidence from blocks
        let totalConfidence = 0;
        let blockCount = 0;
        if (resp.fullTextAnnotation?.pages) {
          for (const page of resp.fullTextAnnotation.pages) {
            if (page.blocks) {
              for (const block of page.blocks) {
                if (typeof block.confidence === "number") {
                  totalConfidence += block.confidence;
                  blockCount++;
                }
              }
            }
          }
        }
        const confidence = blockCount > 0 ? (totalConfidence / blockCount) : 0.85;

        pages.push({
          pageNumber,
          text,
          confidence
        });
      }
    }
  }

  if (pages.length === 0) {
    throw new Error("No pages could be parsed from Cloud Vision OCR output JSON files.");
  }

  // Sort pages by pageNumber to maintain order!
  pages.sort((a, b) => a.pageNumber - b.pageNumber);

  const fullText = pages.map(p => p.text).join("\n\n");
  
  // Overall average confidence
  const totalConfidenceSum = pages.reduce((sum, p) => sum + p.confidence, 0);
  const avgConfidence = totalConfidenceSum / pages.length;

  return {
    pages,
    fullText,
    provider: "cloud_vision",
    confidence: avgConfidence,
  };
}
