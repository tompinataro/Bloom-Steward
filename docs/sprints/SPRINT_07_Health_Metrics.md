#!/usr/bin/env markdown
# Sprint 7 — Health/Metrics Polish (2h)

- Goal: Harden `/health` and `/metrics`; include build/version.
- Tasks:
  - Add version string and uptime to `/health`.
  - Ensure Prometheus metrics include request counts for key endpoints.
- Acceptance:
  - `/health` returns `{ ok: true, version, ts }`.
  - `/metrics` scrapes without error.
- Dependencies: none
- Status: TODO

