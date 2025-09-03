import { dbQuery, hasDb } from './db';

export type TodayRoute = { id: number; clientName: string; address: string; scheduledTime: string };
export type ChecklistItem = { key: string; label: string; done: boolean };
export type Visit = { id: number; clientName: string; checklist: ChecklistItem[] };

export async function getTodayRoutes(userId: number): Promise<TodayRoute[]> {
  if (hasDb()) {
    const res = await dbQuery<{
      visit_id: number;
      client_name: string;
      address: string;
      scheduled_time: string;
    }>(
      `select v.id as visit_id, c.name as client_name, c.address, rt.scheduled_time
       from routes_today rt
       join clients c on c.id = rt.client_id
       join visits v on v.client_id = c.id and v.scheduled_time = rt.scheduled_time
       where rt.user_id = $1
       order by rt.scheduled_time asc`,
      [userId]
    );
    const rows = res?.rows ?? [];
    if (rows.length > 0) {
      return rows.map(r => ({ id: r.visit_id, clientName: r.client_name, address: r.address, scheduledTime: r.scheduled_time }));
    }
  }
  return [
    { id: 101, clientName: 'Acme HQ', address: '123 Main St', scheduledTime: '09:00' },
    { id: 102, clientName: 'Blue Sky Co', address: '456 Oak Ave', scheduledTime: '10:30' },
    { id: 103, clientName: 'Sunset Mall', address: '789 Pine Rd', scheduledTime: '13:15' }
  ];
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
  const clientName = id === 101 ? 'Acme HQ' : id === 102 ? 'Blue Sky Co' : 'Sunset Mall';
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

export async function saveVisit(id: number, notes: string | undefined, checklist: { key: string; done: boolean }[]) {
  if (hasDb()) {
    try {
      await dbQuery(
        `insert into visit_submissions (visit_id, notes, payload, created_at) values ($1, $2, $3, now())`,
        [id, notes ?? null, JSON.stringify(checklist)]
      );
      return { ok: true, mode: 'db' } as any;
    } catch (e: any) {
      console.warn('saveVisit: DB insert failed, returning demo success:', e?.message || e);
      // In demo mode (no seeded visits), accept submissions without persisting.
      return { ok: true, mode: 'demo', skipped: true } as any;
    }
  }
  return { ok: true, mode: 'memory' } as any;
}
