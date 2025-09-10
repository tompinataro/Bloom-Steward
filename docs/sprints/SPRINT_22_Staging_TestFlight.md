#!/usr/bin/env markdown
# Sprint 22 — Staging & TestFlight (2h)

- Goal: Deliver a staging environment and TestFlight (iOS) build for testers.
- Tasks:
  - Provision a staging API (Heroku/Render/Fly) with `DATABASE_URL`.
  - Configure Expo EAS project + profiles (staging/dev).
  - Build and distribute an iOS internal build to TestFlight.
  - Add staging `.env` for mobile (`EXPO_PUBLIC_API_URL=...`).
- Acceptance:
  - Testers install via TestFlight and run full flow successfully.
- Dependencies: Sprint 21 (CI/CD), Sprint 8 (DB enabled)
- Status: PARTIAL — EAS profiles configured; staging uses Heroku API
- Notes:
  - `mobile/eas.json` defines `preview` (internal) and `production` profiles.
  - API base for builds: `https://bloom-steward-2a872c497756.herokuapp.com`.
  - Next: log into Expo, run `eas build -p ios --profile preview`, then `eas submit -p ios`.
