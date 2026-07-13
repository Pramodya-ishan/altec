import { TtsInput, TtsResult } from "./index";
import textToSpeech from '@google-cloud/text-to-speech';

const client = new textToSpeech.TextToSpeechClient();

export async function generateGoogleTts(input: TtsInput): Promise<TtsResult> {
  let resolvedVoiceName = input.voice;

  if (!resolvedVoiceName || resolvedVoiceName === "auto") {
    try {
      const [result] = await client.listVoices({ languageCode: input.languageCode });
      const voices = result.voices || [];
      if (voices.length > 0) {
        // Prefer Neural2/Wavenet/Studio if available
        const preferred = voices.find(v => v.name?.includes("Neural2") || v.name?.includes("Wavenet") || v.name?.includes("Studio"));
        if (preferred && preferred.name) {
          resolvedVoiceName = preferred.name;
        } else if (voices[0].name) {
          resolvedVoiceName = voices[0].name;
        }
      }
    } catch (e) {
      console.warn("Failed to list voices, falling back to default", e);
    }
  }

  if (!resolvedVoiceName || resolvedVoiceName === "auto") {
     resolvedVoiceName = input.languageCode.startsWith('si') ? 'si-LK-Standard-A' : 'en-US-Standard-D';
  }

  const request = {
    input: { text: input.text },
    voice: { languageCode: input.languageCode, name: resolvedVoiceName },
    audioConfig: { audioEncoding: "MP3" as const },
  };

  try {
    const [response] = await client.synthesizeSpeech(request);
    
    if (!response.audioContent) {
      throw new Error("Google TTS returned no audioContent");
    }

    return {
      buffer: Buffer.from(response.audioContent),
      contentType: "audio/mpeg",
      provider: "google_cloud",
      voiceName: resolvedVoiceName
    };
  } catch (error: any) {
    const err: any = new Error("Google TTS failed");
    err.code = "TTS_PROVIDER_ERROR";
    err.providerError = error.message;
    throw err;
  }
}
