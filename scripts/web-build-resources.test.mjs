import { test, expect } from 'bun:test';
import { compilerMemoryBudget } from './web-build-resources.mjs';

test('compiler gets a bounded 6 GiB heap only with at least 8 GiB available', () => {
  expect(compilerMemoryBudget('MemAvailable: 8388608 kB\n')).toEqual({ heapMiB: 6144, availableMiB: 8192 });
  expect(compilerMemoryBudget('MemAvailable: 33554432 kB\n').heapMiB).toBe(6144);
  expect(() => compilerMemoryBudget('MemAvailable: 8387584 kB\n')).toThrow('needs at least 8192');
});

test('unknown available memory fails closed', () => {
  expect(() => compilerMemoryBudget('MemTotal: 16777216 kB\n')).toThrow('Cannot determine');
});
