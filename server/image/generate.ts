import { randomUUID } from "node:crypto";
import { getAIClient, AI_MODELS } from "../ai/client";
import { getAdminBucket, getAdminDb } from "../firebase/admin";

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
    } = req.body;
    const uid = req.user.uid;

    if (!prompt) throw new Error("Prompt is required");
    if (process.env.DISABLE_IMAGE_GENERATION === "true") {
      return { ok: false, code: "IMAGE_GENERATION_DISABLED", error: "Image generation is temporarily unavailable." };
    }

    const boundedReference = String(referenceText || "").trim().slice(0, 5_000);
    const finalPrompt = [
      "Create one accurate educational image for a Sri Lankan G.C.E. A/L Technology student.",
      "Use natural Sinhala Unicode for labels when the request is in Sinhala or Singlish.",
      "Keep labels short, readable, correctly spelled, and free from decorative filler.",
      "Use a clean white or very light background, strong visual hierarchy, and exam-focused content.",
      "Do not add watermarks, logos, fake citations, or unsupported facts.",
      `Subject: ${subject || "Technology"}`,
      `Lesson: ${lesson || "General"}`,
      style ? `Requested style: ${style}` : "Style: modern educational diagram",
      `User request: ${prompt}`,
      boundedReference ? `Relevant previous answer/context:\n${boundedReference}` : "",
    ].filter(Boolean).join("\n\n");

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
            contents: [{ role: "user", parts: [{ text: finalPrompt }] }],
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
      return {
        ok: false,
        code: "IMAGE_MODEL_UNAVAILABLE",
        error: "The image service is temporarily unavailable.",
      };
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

    return {
      ok: true,
      imageUrl, storagePath,
      mimeType: outputMimeType,
      model: modelUsed,
      promptUsed: prompt,
      imageId
    };

  } catch (error: any) {
    console.error("generateEducationalImage top-level error:", error);
    return {
      ok: false,
      code: "IMAGE_GENERATION_FAILED",
      error: "Internal operation failed."
    };
  }
}
