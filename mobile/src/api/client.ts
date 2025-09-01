export const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5100';

function withBase(path: string) {
  return `${API_BASE.replace(/\/$/, '')}${path}`;
}

export async function health(): Promise<{ ok: boolean; ts?: string; message?: string }> {
  const res = await fetch(withBase('/health'));
  if (!res.ok) throw new Error(`Health check failed: ${res.status}`);
  return res.json();
}

export type LoginResponse = { ok: boolean; token: string; user: { id: number; name: string; email: string } };
export async function login(email: string, password: string): Promise<LoginResponse> {
  const res = await fetch(withBase('/api/auth/login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  if (!res.ok) throw new Error(`Login failed: ${res.status}`);
  return res.json();
}

export type TodayRoute = { id: number; clientName: string; address: string; scheduledTime: string };
export async function fetchTodayRoutes(token: string): Promise<{ ok: boolean; routes: TodayRoute[] }> {
  const res = await fetch(withBase('/api/routes/today'), {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error(`Routes fetch failed: ${res.status}`);
  return res.json();
}

export type Visit = { id: number; clientName: string; checklist: { key: string; label: string; done: boolean }[] };
export async function fetchVisit(id: number, token: string): Promise<{ ok: boolean; visit: Visit }> {
  const res = await fetch(withBase(`/api/visits/${id}`), {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error(`Visit fetch failed: ${res.status}`);
  return res.json();
}

export async function submitVisit(id: number, data: { notes?: string; checklist: { key: string; done: boolean }[] }, token: string): Promise<{ ok: boolean; id: number } & any> {
  const res = await fetch(withBase(`/api/visits/${id}/submit`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error(`Submit failed: ${res.status}`);
  return res.json();
}
