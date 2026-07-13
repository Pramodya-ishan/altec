import { TtsInput, TtsResult } from "./index";

export async function generateElevenLabsTts(input: TtsInput): Promise<TtsResult> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error("Missing ELEVENLABS_API_KEY for ElevenLabs TTS");
  }

  const voiceId = input.voice || process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM"; // Default Rachel
  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: {
      "Accept": "audio/mpeg",
      "Content-Type": "application/json",
      "xi-api-key": apiKey,
    },
    body: JSON.stringify({
      text: input.text,
      model_id: "eleven_multilingual_v2",
    }),
  });

  if (!response.ok) {
    const errorData = await response.text();
    const err: any = new Error("ElevenLabs TTS failed");
    err.code = "TTS_PROVIDER_ERROR";
    err.providerError = errorData;
    throw err;
  }

  const arrayBuffer = await response.arrayBuffer();
  
  return {
    buffer: Buffer.from(arrayBuffer),
    contentType: "audio/mpeg",
    provider: "elevenlabs",
  };
}
