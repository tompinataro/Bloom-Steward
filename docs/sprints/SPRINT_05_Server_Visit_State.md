#!/usr/bin/env markdown
# Sprint 5 — Server Visit State (2h)

- Goal: Persist completed/in‑progress visit state on the server; surface in `/api/routes/today`.
- Tasks:
  - Add DB tables/columns for per‑day visit state.
  - Extend submit endpoint to mark completed; add in‑progress mark on first open.
  - Return `completedToday` (and optional `inProgress`) with route list.
- Acceptance:
  - Fresh install fetches state and shows ✓ correctly.
- Dependencies: Sprint 8 (DB) can be stubbed; otherwise store in memory temporarily.
- Status: TODO

