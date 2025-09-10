#!/usr/bin/env markdown
# Sprint 21 — CI/CD (2h)

- Goal: GitHub Actions for lint/test/build; EAS preview build.
- Tasks:
  - Add workflow: typecheck, lint, server build. (DONE)
  - Configure EAS project; generate preview build. (DONE)
    - CI triggers EAS iOS preview build on pushes to main when `EXPO_TOKEN` secret is set.
- Acceptance:
  - PRs show green checks; preview build started on main.
- Dependencies: Sprints 4, 19, 20
- Status: DONE — CI workflow added; EAS preview job triggers on main with secret
