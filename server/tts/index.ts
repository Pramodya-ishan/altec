import { generateGoogleTts } from "./googleTts";
import { generateElevenLabsTts } from "./elevenlabsTts";

export type TtsInput = {
  text: string;
  languageCode: string;
  voice?: string;
  format?: "mp3";
};

export type TtsResult = {
  buffer: Buffer;
  contentType: "audio/mpeg";
  provider: string;
  voiceName?: string;
};

export async function generateTtsAudio(input: TtsInput): Promise<TtsResult> {
  const provider = process.env.TTS_PROVIDER || "google";
  if (String(process.env.ENABLE_TTS || "").toLowerCase() !== "true") {
    const err: any = new Error("TTS is disabled");
    err.code = "TTS_DISABLED";
    throw err;
  }

  if (provider === "elevenlabs") {
    return generateElevenLabsTts(input);
  }
  return generateGoogleTts(input);
}
