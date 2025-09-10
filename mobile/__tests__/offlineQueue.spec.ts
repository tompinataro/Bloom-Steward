import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock AsyncStorage with an in-memory map
const store = new Map<string, string>();
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: async (k: string, v: string) => { store.set(k, v); },
    removeItem: async (k: string) => { store.delete(k); },
    multiRemove: async (keys: string[]) => { keys.forEach(k => store.delete(k)); },
  },
}));

// Mock submitVisit to control success/failure
vi.mock('../src/api/client', () => ({
  submitVisit: vi.fn(async () => { throw new Error('network'); }),
}));

import { enqueueSubmission, flushQueue, getQueueStats } from '../src/offlineQueue';

describe('offlineQueue', () => {
  beforeEach(() => { store.clear(); });

  it('dedupes submissions by id:YYYY-MM-DD', async () => {
    await enqueueSubmission(123, { a: 1 });
    await enqueueSubmission(123, { a: 2 });
    const stats = await getQueueStats();
    expect(stats.pending).toBe(1);
  });

  it('backs off on failure and increments attempts', async () => {
    await enqueueSubmission(999, { foo: 'bar' });
    const res = await flushQueue('fake-token');
    expect(res.sent).toBe(0);
    const stats = await getQueueStats();
    expect(stats.pending).toBe(1);
    expect(stats.maxAttempts).toBeGreaterThanOrEqual(1);
    expect(typeof stats.oldestNextTryAt === 'string' || stats.oldestNextTryAt === undefined).toBe(true);
  });
});

