// Shared VPS compiler budget. Keep a bounded heap and reserve native/OS headroom.
export function compilerMemoryBudget(meminfo) {
  const match = /^MemAvailable:\s+(\d+)\s+kB\s*$/m.exec(meminfo);
  if (!match) throw new Error('Cannot determine available RAM; compiler was not started');
  const availableMiB = Math.floor(Number(match[1]) / 1024);
  if (availableMiB < 8192) {
    throw new Error(`Compiler needs at least 8192 MiB available RAM; found ${availableMiB} MiB. Retry when memory is available; do not stop other apps.`);
  }
  return { heapMiB: 6144, availableMiB };
}
