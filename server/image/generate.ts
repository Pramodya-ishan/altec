import { randomUUID } from "node:crypto";
import { getAIClient, AI_MODELS } from "../ai/client";
import { getAdminBucket, getAdminDb } from "../firebase/admin";
import { resolveAuthorizedPdfSource } from "../pdf/authorizedSource";
import { renderPdfPageCrop } from "../pdf/questionPreview";
import { recordAiTelemetry } from "../observability/aiTelemetry";

function extensionForMimeType(mimeType: string) {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return "jpg";
}

function findInlineImage(response: any) {
  for (const candidate of response?.candidates || []) {
    for (const part of candidate?.content?.parts || []) {
      const data = part?.inlineData?.data || part?.inlineData?.imageBytes;
      if (data) {
        return {
          data,
          mimeType: part?.inlineData?.mimeType || "image/png",
        };
      }
    }
  }
  return null;
}

export async function generateEducationalImage(req: any) {
  const startedAt = Date.now();
  const telemetryId = `${randomUUID()}_image`;
  const finish = async (result: any) => {
    await recordAiTelemetry({
      id: telemetryId,
      kind: "image_generation",
      ok: result?.ok === true,
      durationMs: Date.now() - startedAt,
      code: result?.ok === true ? "IMAGE_GENERATION_COMPLETE" : (result?.code || "IMAGE_GENERATION_FAILED"),
      model: result?.model || null,
      sourceCount: result?.referenceUsed ? 1 : 0,
      degraded: result?.ok === true && !result?.storagePath,
    }).catch(() => undefined);
    return result;
  };
  try {
    const {
      prompt,
      subject,
      lesson,
      style,
      mode,
      aspectRatio = "1:1",
      quality,
      referenceText,
      referencePdf,
    } = req.body;
    const uid = req.user.uid;

    if (!prompt) throw new Error("Prompt is required");
    if (process.env.DISABLE_IMAGE_GENERATION === "true") {
      return finish({ ok: false, code: "IMAGE_GENERATION_DISABLED", error: "Image generation is temporarily unavailable." });
    }

    const boundedReference = String(referenceText || "").trim().slice(0, 5_000);
    const finalPrompt = [
      "Create one accurate examination-support visual for a Sri Lankan G.C.E. A/L Technology student.",
      "The surrounding application renders the complete Sinhala question as live Unicode text. Generate only the diagram, apparatus, graph, table geometry, circuit, construction detail, or other visual evidence required by that question; never rasterize a long paragraph of question text.",
      "Match the restrained visual language of Sri Lankan Department of Examinations past papers: white page, thin black or dark-grey line work, correct proportions, compact labels, no decorative gradients, no glossy 3D styling, no unrelated stock art.",
      "Prefer symbols, variables, arrows, numbers and SI units. When a word label is required, copy the exact supplied Sinhala Unicode label. Never convert Sinhala into legacy-font ASCII, transliteration, garbled glyphs, or phonetic English.",
      "Keep every label short, readable and correctly attached to the relevant component. Leave enough whitespace so labels never collide or fall outside the diagram.",
      "When a past-paper reference image is supplied, use it only as a layout, geometry and examination-style reference. Create a new, non-identical practice visual; do not reproduce an entire copyrighted page or watermark.",
      "Do not add logos, watermarks, fake citations, prediction percentages, answer hints, or unsupported facts inside the image.",
      `Subject: ${subject || "Technology"}`,
      `Lesson: ${lesson || "General"}`,
      style ? `Requested style: ${style}` : "Style: black-and-white Sri Lankan examination line diagram",
      `Visual request: ${prompt}`,
      boundedReference ? `Required question context and exact Unicode labels:\n${boundedReference}` : "",
    ].filter(Boolean).join("\n\n");

    let referenceImagePart: any = null;
    if (referencePdf?.sourceId && referencePdf?.pageNumber) {
      try {
        const resolved = await resolveAuthorizedPdfSource(req.user, referencePdf.sourceId, referencePdf.storagePath);
        const [pdfBytes] = await getAdminBucket().file(resolved.path).download();
        const crop = await renderPdfPageCrop(pdfBytes, Number(referencePdf.pageNumber), referencePdf.crop || null);
        referenceImagePart = { inlineData: { mimeType: "image/png", data: crop.png.toString("base64") } };
      } catch (referenceError) {
        console.warn("[ImageGeneration] PDF reference image unavailable", {
          sourceId: referencePdf?.sourceId,
          error: String(referenceError),
        });
      }
    }

    let configuredModel = AI_MODELS.image;
    if (mode === "studio" || mode === "pro" || quality === "high" || quality === "4K") {
      configuredModel = AI_MODELS.imagePro;
    }
    const fallbackModel = process.env.IMAGEN_FALLBACK_MODEL || "imagen-3.0-generate-001";

    const modelsToTry = [
      configuredModel,
      process.env.NANO_BANANA_MODEL,
      process.env.NANO_BANANA_PRO_MODEL,
      process.env.GEMINI_IMAGE_MODEL,
      process.env.GEMINI_IMAGE_PRO_MODEL,
      "gemini-2.5-flash-image",
      fallbackModel,
    ];
    const uniqueModels = Array.from(
      new Set(modelsToTry.filter((model): model is string => Boolean(model))),
    );

    let imageBase64: string | undefined;
    let outputMimeType = "image/jpeg";
    let modelUsed: string = "";
    let lastError: any = null;

    const ai = getAIClient();

    for (const modelName of uniqueModels) {
      try {
        modelUsed = modelName;
        if (modelName.toLowerCase().startsWith("imagen")) {
          if (referenceImagePart) continue;
          const response = await ai.models.generateImages({
            model: modelName,
            prompt: finalPrompt,
            config: {
              numberOfImages: 1,
              outputMimeType: "image/jpeg",
              aspectRatio: aspectRatio
            }
          });

          if (response && response.generatedImages && response.generatedImages.length > 0) {
            imageBase64 = response.generatedImages[0].image?.imageBytes;
            outputMimeType = "image/jpeg";
          }
        } else {
          const response = await ai.models.generateContent({
            model: modelName,
            contents: [{
              role: "user",
              parts: [
                ...(referenceImagePart ? [referenceImagePart, { text: "Use this verified PDF question crop as the visual source. Preserve its geometry and dimensions; do not invent hidden details." }] : []),
                { text: finalPrompt },
              ],
            }],
            config: {
              responseModalities: ["IMAGE", "TEXT"],
              imageConfig: { aspectRatio },
            } as any,
          } as any);
          const inlineImage = findInlineImage(response);
          if (inlineImage) {
            imageBase64 = inlineImage.data;
            outputMimeType = inlineImage.mimeType;
          }
        }

        if (imageBase64) {
          break; // Successfully got image bytes!
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`Image generation with model ${modelName} failed, trying fallback:`, err.message || err);
      }
    }

    if (!imageBase64) {
      console.error("All image generation models failed. Last error:", lastError);
      return finish({
        ok: false,
        code: "IMAGE_MODEL_UNAVAILABLE",
        error: "The image service is temporarily unavailable.",
      });
    }

    const imageId = randomUUID();
    const extension = extensionForMimeType(outputMimeType);
    let imageUrl = `data:${outputMimeType};base64,${imageBase64}`;
    let storagePath: string | null = null;

    // Upload to Firebase Storage
    try {
      const bucket = getAdminBucket();
      const path = `generated_images/${uid}/${imageId}.${extension}`;
      const file = bucket.file(path);
      await file.save(Buffer.from(imageBase64, 'base64'), {
        metadata: {
          contentType: outputMimeType,
          cacheControl: "private, max-age=86400",
        },
        resumable: false,
      });

      try { const [url] = await file.getSignedUrl({ action: 'read', expires: Date.now() + 1000 * 60 * 60 * 24 * 7 }); imageUrl = url; } catch (e) { }
      storagePath = path;
    } catch (storageErr) {
      console.warn("Firebase Storage upload failed, falling back to data URL:", storageErr);
    }

    // Save to Firestore
    try {
      const db = getAdminDb();
      const imageRef = db.collection("generated_images").doc(uid).collection("items").doc(imageId);
      await imageRef.set({
        uid,
        subject: subject || null,
        lesson: lesson || null,
        prompt,
        promptUsed: finalPrompt,
        model: modelUsed,
        mimeType: outputMimeType,
        imageUrl,
        storagePath,
        createdAt: new Date().toISOString()
      });
    } catch (dbErr) {
      console.warn("Failed to save image metadata to Firestore", dbErr);
    }

    return finish({
      ok: true,
      imageUrl, storagePath,
      mimeType: outputMimeType,
      model: modelUsed,
      promptUsed: prompt,
      imageId,
      referenceUsed: Boolean(referenceImagePart),
    });

  } catch (error: any) {
    console.error("generateEducationalImage top-level error:", error);
    return finish({
      ok: false,
      code: "IMAGE_GENERATION_FAILED",
      error: "Internal operation failed."
    });
  }
}
