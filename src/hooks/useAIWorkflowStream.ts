import { useState, useRef } from "react";
import { getAuthToken } from "../lib/api";

export function useAIWorkflowStream() {
  const [answer, setAnswer] = useState("");
  const [status, setStatus] = useState<any>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [totalSeconds, setTotalSeconds] = useState<number | null>(null);
  const [safeSummary, setSafeSummary] = useState<string[]>([]);
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  async function sendAIMessage({ prompt, activeSubject, mode = "auto", history = [] }: any) {
    setAnswer("");
    setError("");
    setSafeSummary([]);
    setTotalSeconds(null);
    setIsStreaming(true);

    if (!navigator.onLine) {
      setError("සම්බන්ධතාවය බිඳවැටී ඇත (Offline). Please check your internet connection and try again.");
      setIsStreaming(false);
      setStatus({ stage: "error", label: "Offline" });
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      let response: Response | null = null;
      let attempt = 0;
      const maxAttempts = 3;
      let backoffDelay = 1000;

      while (attempt < maxAttempts) {
        try {
          const token = await getAuthToken();
          response = await fetch("/api/ai/respond-stream", {
            method: "POST",
            signal: controller.signal,
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token || ""}`,
            },
            body: JSON.stringify({ prompt, activeSubject, mode, history }),
          });

          if (response.ok) {
            break; // Success
          }

          const body = await response.json().catch(() => ({}));
          throw new Error(body.error || body.message || `AI failed ${response.status}`);
        } catch (e: any) {
          if (e.name === 'AbortError') throw e;
          attempt++;
          if (attempt >= maxAttempts) {
            throw e;
          }
          console.warn(`AI stream request failed (attempt ${attempt}/${maxAttempts}). Retrying in ${backoffDelay}ms...`, e);
          await new Promise(resolve => setTimeout(resolve, backoffDelay));
          backoffDelay *= 2;
        }
      }

      if (!response || !response.body) {
        throw new Error("Failed to receive stream response.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const events = buffer.split("\n\n");
        buffer = events.pop() || "";

        for (const raw of events) {
          const eventName = raw.match(/^event:\s*(.+)$/m)?.[1]?.trim();
          const dataText = raw.match(/^data:\s*(.+)$/m)?.[1];
          if (!eventName || !dataText) continue;

          let data;
          try {
            data = JSON.parse(dataText);
          } catch(e) { continue; }

          if (eventName === "status") setStatus(data);
          if (eventName === "chunk") setAnswer(prev => prev + data.text);
          if (eventName === "safe_summary") setSafeSummary(data.items || []);
          if (eventName === "error") setError(data.error || "AI error");
          if (eventName === "done") {
            setIsStreaming(false);
            setTotalSeconds(data.totalSeconds);
            setStatus({
              stage: data.ok ? "done" : "error",
              label: data.ok ? "Thought" : "Stopped",
              startedAt: Date.now() - (data.totalMs || 0),
            });
          }
        }
      }
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        setError(e.message || "Network error");
        setIsStreaming(false);
        setStatus({ stage: "error", label: "Stopped" });
      }
    }
  }

  function cancel() {
    abortRef.current?.abort();
    setIsStreaming(false);
    setStatus({ stage: "error", label: "Stopped" });
  }

  return { answer, status, isStreaming, totalSeconds, safeSummary, error, sendAIMessage, cancel };
}
