const GENERATED_AVATAR_HOSTS = new Set(["api.dicebear.com"]);

export function isGeneratedAvatar(value: string | null | undefined) {
  const candidate = value?.trim();
  if (!candidate) return true;
  try {
    return GENERATED_AVATAR_HOSTS.has(new URL(candidate).hostname.toLowerCase());
  } catch {
    return false;
  }
}

export function resolveProfilePicture(
  savedPicture: string | null | undefined,
  googlePicture: string | null | undefined,
  seed = "LocalStudent",
) {
  const saved = savedPicture?.trim();
  if (saved && !isGeneratedAvatar(saved)) return saved;

  const google = googlePicture?.trim();
  if (google) return google;

  return `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(seed || "LocalStudent")}`;
}
