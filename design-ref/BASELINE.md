# Baseline before redesign

Recorded 2026-10-15 on commit `e5a5b82` ("baseline before redesign"), branch `redesign`.
Run from the repo root in PowerShell (Git Bash's `npx` fails to launch `node` on this machine).

| Check | Result |
|---|---|
| `npx tsc --noEmit` | PASS — 0 errors (exit 0) |
| `npm test` (vitest 5.0.3) | PASS — 19/19 test files, 198/198 tests (exit 0) |
| `npm run check:i18n` | PASS — used: 83, translated: 83, MISSING: 0 (exit 0) |

Nothing was failing before the redesign started.

## Known noise (not a failure)
- Vitest prints a warning: `vitest.config.ts` uses ESM syntax in a file loaded as CommonJS
  (`configLoader: 'native'` notice). Tests still run and pass.
- `git` warns that LF will be replaced by CRLF on many files (Windows line endings). Harmless.

## Scope
- `npm test` here covers the app only. `backend/` has its own `package.json` and tests and was not run.
