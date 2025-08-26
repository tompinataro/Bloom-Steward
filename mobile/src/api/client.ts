export const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5001';

export async function health(): Promise<{ ok: boolean; message: string }> {
  const res = await fetch(`${API_BASE}/api/health`);
  if (!res.ok) throw new Error(`Health check failed: ${res.status}`);
  return res.json();
}
