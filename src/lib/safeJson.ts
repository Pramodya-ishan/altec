export async function safeJson<T = any>(res: Response): Promise<{ data: T | null; error: string | null; ok: boolean }> {
  try {
    const text = await res.text();
    try {
      const data = JSON.parse(text);
      return { data, error: null, ok: res.ok };
    } catch (e: any) {
      // Not JSON
      return { data: null, error: `Invalid JSON response: ${text.substring(0, 100)}...`, ok: false };
    }
  } catch (e: any) {
    return { data: null, error: e.message || "Failed to read response", ok: false };
  }
}
