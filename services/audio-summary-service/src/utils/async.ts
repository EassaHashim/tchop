/** Run async tasks with concurrency limit */
export async function pooled<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  const executing = new Set<Promise<void>>();
  for (const item of items) {
    const p = fn(item).then(() => { executing.delete(p); });
    executing.add(p);
    if (executing.size >= limit) await Promise.race(executing);
  }
  await Promise.all(executing);
}
