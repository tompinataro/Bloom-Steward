import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'completed_visits_v1';
const KEY_PROGRESS = 'inprogress_visits_v1';

export async function getCompleted(): Promise<Set<number>> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as number[];
    return new Set(arr);
  } catch {
    return new Set();
  }
}

export async function addCompleted(id: number): Promise<void> {
  const set = await getCompleted();
  set.add(id);
  await AsyncStorage.setItem(KEY, JSON.stringify(Array.from(set)));
}

export async function clearCompleted(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}

export async function getInProgress(): Promise<Set<number>> {
  try {
    const raw = await AsyncStorage.getItem(KEY_PROGRESS);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as number[];
    return new Set(arr);
  } catch {
    return new Set();
  }
}

export async function addInProgress(id: number): Promise<void> {
  const set = await getInProgress();
  set.add(id);
  await AsyncStorage.setItem(KEY_PROGRESS, JSON.stringify(Array.from(set)));
}

export async function removeInProgress(id: number): Promise<void> {
  const set = await getInProgress();
  if (set.has(id)) set.delete(id);
  await AsyncStorage.setItem(KEY_PROGRESS, JSON.stringify(Array.from(set)));
}
