/** Ejecuta `worker` sobre cada elemento con un máximo de `concurrency` tareas a la vez. */
export async function runPool<T>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<void>,
  options: { signal?: AbortSignal; onProgress?: (done: number, total: number) => void } = {},
): Promise<void> {
  const { signal, onProgress } = options;
  let next = 0;
  let done = 0;
  const total = items.length;

  async function lane(): Promise<void> {
    while (true) {
      if (signal?.aborted) return;
      const i = next++;
      if (i >= total) return;
      await worker(items[i]!, i);
      done++;
      onProgress?.(done, total);
    }
  }

  const lanes = Array.from({ length: Math.max(1, Math.min(concurrency, total)) }, lane);
  await Promise.all(lanes);
  if (signal?.aborted) throw new DOMException('Cancelado', 'AbortError');
}
