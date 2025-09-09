#!/usr/bin/env markdown
# Sprint 5 — Server Visit State (2h)

- Goal: Server is the source of truth for completed/in‑progress; ship Phase A now via in‑memory store, preserving the final API contract.
- Phase A (now, in‑memory):
  - Add in‑memory map keyed by `YYYY‑MM‑DD:visitId[:userId]`.
  - GET `/api/routes/today` includes `{ completedToday, inProgress }` per item.
  - POST `/api/visits/:id/in-progress` marks opened (fire‑and‑forget from client).
  - POST `/api/visits/:id/submit` marks completed. Keep idempotent behavior.
- Phase B (later, Sprint 8):
  - Swap storage to DB with identical API; dual‑write + shadow‑read; flip reads.
- Acceptance:
  - Fresh install → fetch → ✓ and in‑progress reflect server truth.
  - Opening a visit sets in‑progress; submitting sets completed.
- Dependencies: none (DB comes in Sprint 8)
- Status: TODO
