export const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5100';

// Allows AuthProvider to register a handler for 401s
let unauthorizedHandler: (() => void) | null = null;
let tokenRefreshedHandler: ((token: string, user: any) => void | Promise<void>) | null = null;
export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}
export function setTokenRefreshedHandler(handler: ((token: string, user: any) => void | Promise<void>) | null) {
  tokenRefreshedHandler = handler;
}

function withBase(path: string) {
  return `${API_BASE.replace(/\/$/, '')}${path}`;
}

async function fetchJson(input: RequestInfo | URL, init?: RequestInit & { timeoutMs?: number }, _allowRetry = true) {
  const { timeoutMs = 10000, ...rest } = init || {};
  const ac = new AbortController();
  const timeout = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const originalBody = (rest as any)?.body;
    const res = await fetch(input, { ...rest, signal: ac.signal });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      if (res.status === 401) {
        try {
          // Attempt a one-time refresh+retry if caller used Bearer token
          const hdr = (rest.headers || {}) as any;
          const auth = (hdr['Authorization'] || hdr['authorization']) as string | undefined;
          const isAuthReq = typeof input === 'string' ? input.includes('/api/auth/') : false;
          if (_allowRetry && auth && /Bearer\s+/.test(auth) && !isAuthReq) {
            // Try refresh with current token
            const refreshRes = await fetch(withBase('/api/auth/refresh'), {
              method: 'POST',
              headers: { Authorization: auth },
            });
            if (refreshRes.ok) {
              const rr = await refreshRes.json();
              const newToken: string | undefined = rr?.token;
              const user = rr?.user;
              if (newToken) {
                try { await tokenRefreshedHandler?.(newToken, user); } catch {}
                const headers = new Headers(rest.headers as any);
                headers.set('Authorization', `Bearer ${newToken}`);
                // Retry original request once with new token
                const retryRes = await fetchJson(input, { ...(rest as any), headers, body: originalBody }, false);
                return retryRes;
              }
            }
          }
        } catch {}
        try { unauthorizedHandler?.(); } catch {}
      }
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

export async function refresh(token: string): Promise<LoginResponse> {
  return fetchJson(withBase('/api/auth/refresh'), {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
}

// Sign in with Apple (development-friendly endpoint)
export type AppleLoginRequest = {
  identityToken?: string;
  authorizationCode?: string;
  email?: string | null;
  name?: string | null;
};
export async function loginWithApple(data: AppleLoginRequest): Promise<LoginResponse> {
  return fetchJson(withBase('/api/auth/apple'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export type TodayRoute = {
  id: number;
  clientName: string;
  address: string;
  scheduledTime: string;
  // Server truth flags (optional; present when server supports Sprint 5)
  completedToday?: boolean;
  inProgress?: boolean;
};
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

export async function markVisitInProgress(id: number, token: string): Promise<{ ok: boolean; id: number }> {
  return fetchJson(withBase(`/api/visits/${id}/in-progress`), {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
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

// Admin utilities (dev/Staging only)
export async function adminResetVisitState(date: string | undefined, token: string): Promise<{ ok: boolean } & any> {
  const q = date ? `?date=${encodeURIComponent(date)}` : '';
  return fetchJson(withBase(`/api/admin/visit-state/reset${q}`), {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
}
