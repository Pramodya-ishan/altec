import { getDownloadURL, ref } from "firebase/storage";
import { storage, auth } from "./firebase";
import { apiUrl } from "./apiBase";
import { apiFetch } from "./api";

export async function resolveTtsAudioUrl(data: any) {
  if (data.audioUrl) return data.audioUrl;
  if (data.storagePath) return await getDownloadURL(ref(storage, data.storagePath));
  throw new Error("TTS_NO_AUDIO_URL");
}

export async function generateTts(text: string, options: any = {}) {
  const token = await auth.currentUser?.getIdToken();
  const res = await apiFetch(apiUrl("/api/tts/generate"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ text, ...options })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw new Error(data.message || "TTS failed");
  return { ...data, playableUrl: await resolveTtsAudioUrl(data) };
}
