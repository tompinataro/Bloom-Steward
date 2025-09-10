#!/usr/bin/env markdown
# Sprint 6 — Auth “Me” + Refresh (2h)

- Goal: Add `/api/auth/me` and (optional) short token refresh/extend.
- Tasks:
  - Add `/api/auth/me` returning user and token validity.
  - Consider extending token expiry on activity (or refresh endpoint).
- Acceptance:
  - App restores session without immediate 401; `me` endpoint passes.
- Dependencies: none
- Status: PARTIAL — `/api/auth/me` implemented; token refresh TBD
