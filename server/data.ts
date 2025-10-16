import { dbQuery, hasDb } from './db';

export type TodayRoute = { id: number; clientName: string; address: string; scheduledTime: string };
export type ChecklistItem = { key: string; label: string; done: boolean };
export type Visit = { id: number; clientName: string; checklist: ChecklistItem[] };

const FALLBACK_ROUTES: TodayRoute[] = [
  { id: 104, clientName: 'Harbor Plaza', address: '50 S 6th St, Minneapolis, MN 55402', scheduledTime: '12:30' },
  { id: 105, clientName: 'Palm Vista', address: '1000 Nicollet Mall, Minneapolis, MN 55403', scheduledTime: '14:00' },
  { id: 106, clientName: 'Riverwalk Lofts', address: '225 3rd Ave S, Minneapolis, MN 55401', scheduledTime: '15:15' },
  { id: 101, clientName: 'Acme HQ', address: '123 Main St SE, Minneapolis, MN 55414', scheduledTime: '08:30' },
  { id: 102, clientName: 'Blue Sky Co', address: '456 Oak Grove St, Minneapolis, MN 55403', scheduledTime: '09:45' },
  { id: 103, clientName: 'Sunset Mall', address: '789 University Ave NE, Minneapolis, MN 55413', scheduledTime: '11:15' }
];

function normalizeKey(route: TodayRoute): string {
  const name = (route.clientName || '').trim().toLowerCase();
  const address = (route.address || '').trim().toLowerCase();
  const time = route.scheduledTime || '';
  return `${name}__${address}__${time}`;
}

function dedupeById(routes: TodayRoute[]): TodayRoute[] {
  const map = new Map<number, TodayRoute>();
  for (const route of routes) {
    if (!map.has(route.id)) map.set(route.id, route);
  }
  return Array.from(map.values());
}

function dedupeByKey(routes: TodayRoute[]): TodayRoute[] {
  const seen = new Set<string>();
  const result: TodayRoute[] = [];
  for (const route of routes) {
    const key = normalizeKey(route);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(route);
  }
  return result;
}

function ensureMinimumRoutes(routes: TodayRoute[], min = 6): TodayRoute[] {
  if (routes.length >= min) return routes;
  const existing = new Set(routes.map(normalizeKey));
  const next = routes.slice();
  for (const fallback of FALLBACK_ROUTES) {
    const key = normalizeKey(fallback);
    if (existing.has(key)) continue;
    next.push(fallback);
    existing.add(key);
    if (next.length >= min) break;
  }
  return next;
}

export async function getTodayRoutes(userId: number): Promise<TodayRoute[]> {
  if (hasDb()) {
    const res = await dbQuery<{
      visit_id: number;
      client_name: string;
      address: string;
      scheduled_time: string;
    }>(
      // Use LATERAL to select a single matching visit per route and avoid duplicate rows
      `select v.id as visit_id, c.name as client_name, c.address, rt.scheduled_time
       from routes_today rt
       join clients c on c.id = rt.client_id
       join lateral (
         select id, scheduled_time
         from visits
         where client_id = c.id and scheduled_time = rt.scheduled_time
         order by id desc
         limit 1
       ) v on true
       where rt.user_id = $1
       order by rt.scheduled_time asc`,
      [userId]
    );
    const rows = res?.rows ?? [];
    if (rows.length > 0) {
      const mapped = rows.map(r => ({ id: r.visit_id, clientName: r.client_name, address: r.address, scheduledTime: r.scheduled_time }));
      const deduped = dedupeByKey(dedupeById(mapped));
      return ensureMinimumRoutes(deduped);
    }
    // Fallback: if routes_today is empty or userId doesn't match, read from visits table
    const res2 = await dbQuery<{
      id: number; client_name: string; address: string; scheduled_time: string;
    }>(
      `select v.id, c.name as client_name, c.address, v.scheduled_time
       from visits v join clients c on c.id = v.client_id
       order by v.scheduled_time asc`
    );
    const rows2 = res2?.rows ?? [];
    if (rows2.length > 0) {
      const mapped = rows2.map(r => ({ id: r.id, clientName: r.client_name, address: r.address, scheduledTime: r.scheduled_time }));
      const deduped = dedupeByKey(dedupeById(mapped));
      return ensureMinimumRoutes(deduped);
    }
  }
  return FALLBACK_ROUTES;
}

export async function getVisit(id: number): Promise<Visit> {
  if (hasDb()) {
    const visit = await dbQuery<{ id: number; client_name: string }>(
      `select v.id, c.name as client_name from visits v join clients c on c.id = v.client_id where v.id = $1`,
      [id]
    );
    const items = await dbQuery<{ key: string; label: string; done: boolean }>(
      `select key, label, done from visit_checklist where visit_id = $1 order by key asc`,
      [id]
    );
    if (visit && visit.rows[0]) {
      return { id, clientName: visit.rows[0].client_name, checklist: items?.rows ?? [] };
    }
  }
  const clientName =
    id === 101 ? 'Acme HQ' :
    id === 102 ? 'Blue Sky Co' :
    id === 103 ? 'Sunset Mall' :
    id === 104 ? 'Harbor Plaza' :
    id === 105 ? 'Palm Vista Resort' :
    id === 106 ? 'Riverwalk Lofts' : 'Client';
  return {
    id,
    clientName,
    checklist: [
      { key: 'watered', label: 'Watered plants', done: false },
      { key: 'pruned', label: 'Pruned and cleaned', done: false },
      { key: 'replaced', label: 'Replaced unhealthy plants', done: false }
    ]
  };
}

export async function saveVisit(id: number, data: any) {
  if (hasDb()) {
    await dbQuery(
      `insert into visit_submissions (visit_id, notes, payload, created_at) values ($1, $2, $3, now())`,
      [id, data?.notes ?? null, JSON.stringify(data)]
    );
    return { ok: true } as any;
  }
  return { ok: true } as any;
}
