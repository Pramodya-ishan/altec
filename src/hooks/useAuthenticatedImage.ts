import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";

export function useAuthenticatedImage(endpoint?: string | null) {
  const [url, setUrl] = useState("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    let objectUrl = "";
    const controller = new AbortController();
    setUrl("");
    setFailed(false);
    if (!endpoint) return () => undefined;

    void (async () => {
      try {
        const response = await apiFetch(endpoint, { signal: controller.signal });
        if (!response.ok) throw new Error("AUTHENTICATED_IMAGE_LOAD_FAILED");
        objectUrl = URL.createObjectURL(await response.blob());
        if (active) setUrl(objectUrl);
      } catch {
        if (active) setFailed(true);
      }
    })();

    return () => {
      active = false;
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [endpoint]);

  return { url, failed };
}
