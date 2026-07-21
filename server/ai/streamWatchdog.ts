export type StreamWatchdogOptions = {
  idleTimeoutMs?: number;
  signal?: AbortSignal;
  label?: string;
};

function configuredIdleTimeoutMs(value?: number) {
  const configured = Number(value || process.env.AI_STREAM_IDLE_TIMEOUT_MS || 45_000);
  return Math.max(1_000, Math.min(180_000, Number.isFinite(configured) ? Math.trunc(configured) : 45_000));
}

/**
 * Prevent a provider stream from leaving the learner on an endless "thinking"
 * state. The timeout resets after every chunk; it is an idle watchdog, not a
 * total answer-duration cap, so long answers can continue while making progress.
 */
export async function* withStreamIdleTimeout<T>(
  stream: AsyncIterable<T>,
  options: StreamWatchdogOptions = {},
): AsyncGenerator<T> {
  const iterator = stream[Symbol.asyncIterator]();
  const timeoutMs = configuredIdleTimeoutMs(options.idleTimeoutMs);
  const label = options.label || "AI stream";

  try {
    while (true) {
      if (options.signal?.aborted) {
        const error: any = new Error(`${label} cancelled`);
        error.code = "CLIENT_ABORTED";
        throw error;
      }

      let timer: ReturnType<typeof setTimeout> | null = null;
      let abortHandler: (() => void) | null = null;
      const idleFailure = new Promise<IteratorResult<T>>((_resolve, reject) => {
        timer = setTimeout(() => {
          const error: any = new Error(`${label} produced no data for ${timeoutMs}ms`);
          error.code = "AI_STREAM_IDLE_TIMEOUT";
          error.status = 408;
          error.retryable = true;
          reject(error);
        }, timeoutMs);
        abortHandler = () => {
          const error: any = new Error(`${label} cancelled`);
          error.code = "CLIENT_ABORTED";
          reject(error);
        };
        options.signal?.addEventListener("abort", abortHandler, { once: true });
      });

      try {
        const next = await Promise.race([iterator.next(), idleFailure]);
        if (next.done) return;
        yield next.value;
      } finally {
        if (timer) clearTimeout(timer);
        if (abortHandler) options.signal?.removeEventListener("abort", abortHandler);
      }
    }
  } finally {
    // Some provider iterators cannot resolve return() while their internal read
    // is stalled. Trigger cleanup without awaiting it so the watchdog itself
    // can always release the HTTP response.
    try {
      void Promise.resolve(iterator.return?.()).catch(() => undefined);
    } catch {
      // Provider cleanup failures must not mask the original stream outcome.
    }
  }
}
