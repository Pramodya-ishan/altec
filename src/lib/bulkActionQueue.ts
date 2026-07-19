export type BulkActionResult<T> = {
  item: T;
  ok: boolean;
  error?: string;
};

export async function runWithConcurrency<T>(params: {
  items: T[];
  concurrency?: number;
  worker: (item: T, index: number) => Promise<void>;
  onProgress?: (completed: number, total: number, result: BulkActionResult<T>) => void;
}) {
  const { items, worker, onProgress } = params;
  const concurrency = Math.max(1, Math.min(4, Math.floor(params.concurrency || 2)));
  const results: BulkActionResult<T>[] = new Array(items.length);
  let cursor = 0;
  let completed = 0;

  const runWorker = async () => {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      const item = items[index];
      let result: BulkActionResult<T>;
      try {
        await worker(item, index);
        result = { item, ok: true };
      } catch (error: any) {
        result = { item, ok: false, error: error?.message || String(error) };
      }
      results[index] = result;
      completed += 1;
      onProgress?.(completed, items.length, result);
    }
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => runWorker()));
  return results;
}
