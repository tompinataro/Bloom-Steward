export const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5100';

function withBase(path: string) {
  return `${API_BASE.replace(/\/$/, '')}${path}`;
}

async function fetchJson(input: RequestInfo | URL, init?: RequestInit & { timeoutMs?: number }) {
  const { timeoutMs = 10000, ...rest } = init || {};
  const ac = new AbortController();
  const timeout = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(input, { ...rest, signal: ac.signal });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`${res.status} ${res.statusText}${text ? `: ${text}` : ''}`);
    }
    return res.json();
  } finally {
    clearTimeout(timeout);
  }
}

export async function health(): Promise<{ ok: boolean; ts?: string; message?: string }> {
  return fetchJson(withBase('/health'));
}

export type LoginResponse = { ok: boolean; token: string; user: { id: number; name: string; email: string } };
export async function login(email: string, password: string): Promise<LoginResponse> {
  return fetchJson(withBase('/api/auth/login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
}

export type TodayRoute = { id: number; clientName: string; address: string; scheduledTime: string };
export async function fetchTodayRoutes(token: string): Promise<{ ok: boolean; routes: TodayRoute[] }> {
  return fetchJson(withBase('/api/routes/today'), {
    headers: { Authorization: `Bearer ${token}` }
  });
}

export type Visit = { id: number; clientName: string; checklist: { key: string; label: string; done: boolean }[] };
export async function fetchVisit(id: number, token: string): Promise<{ ok: boolean; visit: Visit }> {
  return fetchJson(withBase(`/api/visits/${id}`), {
    headers: { Authorization: `Bearer ${token}` }
  });
}

export async function submitVisit(
  id: number,
  data: {
    notes?: string;
    checklist: { key: string; done: boolean }[];
    timelyAck?: boolean;
    checkInTs?: string;
    checkOutTs?: string;
    checkInLoc?: { lat: number; lng: number };
    checkOutLoc?: { lat: number; lng: number };
    noteToOffice?: string;
    techNotes?: string;
  },
  token: string
): Promise<{ ok: boolean; id: number } & any> {
  return fetchJson(withBase(`/api/visits/${id}/submit`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(data)
  });
}
