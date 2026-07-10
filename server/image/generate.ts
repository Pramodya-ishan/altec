import { getAIClient, AI_MODELS } from "../ai/client";
import { getAdminDb } from "../firebase/admin";
import { getStorage } from "firebase-admin/storage";

export async function generateEducationalImage(req: any) {
  try {
    const { prompt, subject, lesson, style, mode, aspectRatio = "1:1", quality } = req.body;
    const uid = req.user.uid;

    if (!prompt) throw new Error("Prompt is required");

    // Build educational Sinhalese/English exam-focused prompt
    const finalPrompt = `Create a clean Sinhala G.C.E. A/L Technology exam-focused diagram. Clear labels. Minimal clutter. Accurate educational layout. No watermark. Sinhala labels where useful. Subject: ${subject || "Technology"}. Lesson: ${lesson || "General"}. User request: ${prompt}`;

    let configuredModel = AI_MODELS.image;
    if (mode === "studio" || mode === "pro" || quality === "high" || quality === "4K") {
      configuredModel = AI_MODELS.imagePro;
    }
    const fallbackModel = "imagen-3.0-generate-001";

    const modelsToTry = [configuredModel, fallbackModel, "gemini-3.1-flash-image", "gemini-3-pro-image", "imagen-3.0-generate-001"];
    const uniqueModels = Array.from(new Set(modelsToTry));

    let imageBase64: string | undefined;
    let modelUsed: string = "";
    let lastError: any = null;

    const ai = getAIClient();

    for (const modelName of uniqueModels) {
      try {
        modelUsed = modelName;
        if (modelName.toLowerCase().startsWith("imagen") || modelName.toLowerCase().includes("image")) {
          // generateImages API works for both imagen-3.0 and gemini-*-image
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
        error: "Image model unavailable for this project/location.",
        hint: "Use imagen-3.0-generate-001 or enable image model access."
      };
    }

    const imageId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    let imageUrl = `data:image/jpeg;base64,${imageBase64}`;
    let storagePath: string | null = null;

    // Upload to Firebase Storage
    try {
      const bucket = getStorage().bucket("al-ai-chat.firebasestorage.app");
      const path = `generated_images/${uid}/${imageId}.jpg`;
      const file = bucket.file(path);
      await file.save(Buffer.from(imageBase64, 'base64'), {
        metadata: {
          contentType: "image/jpeg"
        }
      });
      try {
        await file.makePublic();
      } catch (e) {}
      imageUrl = `https://storage.googleapis.com/${bucket.name}/${path}`;
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
        imageUrl,
        storagePath,
        createdAt: new Date().toISOString()
      });
    } catch (dbErr) {
      console.warn("Failed to save image metadata to Firestore", dbErr);
    }

    return {
      ok: true,
      imageUrl,
      model: modelUsed,
      promptUsed: prompt,
      imageId
    };

  } catch (error: any) {
    console.error("generateEducationalImage top-level error:", error);
    return {
      ok: false,
      code: "IMAGE_GENERATION_FAILED",
      error: error.message || "Failed to generate educational diagram."
    };
  }
}
