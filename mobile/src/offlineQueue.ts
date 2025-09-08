import AsyncStorage from '@react-native-async-storage/async-storage';
import { submitVisit } from './api/client';

const KEY = 'offline_submissions_v1';

type QueueItem = {
  id: number;
  payload: any;
  enqueuedAt: string;
};

async function readQueue(): Promise<QueueItem[]> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return [];
  try { return JSON.parse(raw) as QueueItem[]; } catch { return []; }
}

async function writeQueue(items: QueueItem[]) {
  await AsyncStorage.setItem(KEY, JSON.stringify(items));
}

export async function enqueueSubmission(id: number, payload: any) {
  const items = await readQueue();
  items.push({ id, payload, enqueuedAt: new Date().toISOString() });
  await writeQueue(items);
}

export async function flushQueue(token: string): Promise<{ sent: number; remaining: number }> {
  let items = await readQueue();
  if (!items.length) return { sent: 0, remaining: 0 };
  const keep: QueueItem[] = [];
  let sent = 0;
  for (const item of items) {
    try {
      await submitVisit(item.id, item.payload, token);
      sent += 1;
    } catch {
      keep.push(item);
    }
  }
  await writeQueue(keep);
  return { sent, remaining: keep.length };
}

