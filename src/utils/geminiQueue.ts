const configuredConcurrency = Number(import.meta.env.VITE_GEMINI_CLIENT_CONCURRENCY || 4);
const MAX_CONCURRENT_GEMINI = Number.isFinite(configuredConcurrency)
  ? Math.max(1, Math.min(8, Math.floor(configuredConcurrency)))
  : 4;

let currentGeminiRequests = 0;
const geminiQueue: Array<{
  task: () => Promise<unknown>;
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
}> = [];

function runNext() {
  while (currentGeminiRequests < MAX_CONCURRENT_GEMINI && geminiQueue.length > 0) {
    const item = geminiQueue.shift();
    if (!item) return;
    currentGeminiRequests += 1;
    void item.task()
      .then(item.resolve, item.reject)
      .finally(() => {
        currentGeminiRequests = Math.max(0, currentGeminiRequests - 1);
        runNext();
      });
  }
}

export function enqueueGeminiTask<T>(task: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    geminiQueue.push({
      task,
      resolve: (value) => resolve(value as T),
      reject,
    });
    runNext();
  });
}
