# Quality Gates

## Required commands

Run these commands, fix failures, then re-run until passing:

```bash
npm run format
npm run lint:fix
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e:mobile
codex review --uncommitted
```

For native mobile app work, after every command above and local Codex review have
passed, run:

```bash
npm run native:player-mobile:build:android:local
```

When the local Android build completes successfully, the handoff message must
include exactly:

```text
Mobile App build has completed and is ready to test
```

The generated APK is written to `tmp/player-mobile-local-builds/`. The build log
is written to `tmp/player-mobile-local-builds/logs/`; normal EAS output should
not stream to the terminal, and failures should surface the log path plus the
final log lines.

## Gate rules

- Targeted tests are optional diagnostics only; they do not replace the required full `npm test` run.
- `npm run test:e2e:mobile` is part of the normal local gate and should run after `npm run build` because it resets and reseeds the local Supabase sandbox before Playwright starts.
- `npm run test:e2e:mobile` runs the seeded mobile-player Playwright suite with one worker because the specs share one deterministic e2e player and scoring/finish tests mutate active-round state.
- Local Supabase must be running before `npm run test:e2e:mobile`; run `supabase start` first if needed.
- For user-visible UI, UX, auth, signup, account, or form changes, mobile validation is required before PR handoff. `npm run test:e2e:mobile` covers player-facing/mobile-app-candidate workflows that are in Playwright mobile scope; otherwise perform manual mobile-width validation.
- For every native mobile app build PR, `docs/runbooks/player-mobile-local-manual-testing.md` must include a slice-specific testing section before PR handoff. That section must name a stable slice identifier and story, explain the functional klubeez purpose in plain English, list realistic local/manual checks, include real-device or EAS/internal-device validation where applicable, and define pass/fail criteria.
- For native mobile app work, the local Android build runs only after the full quality gate and local Codex review are green. If the local build fails, fix the issue or record the blocker before PR handoff.
- Manual real-phone validation is required when the changed behavior depends on device behavior that Playwright cannot prove, including native keyboard layout, touch ergonomics, mobile browser caching, or real-device viewport quirks. For these HTTP-safe checks, use the LAN helper and record the result in the story, PR body, review log, and handoff:

```bash
npm run test:e2e:mobile:lan:set -- --host <PC_LAN_IP>
npm run dev -- --host 0.0.0.0
# test on phone at http://<PC_LAN_IP>:5173/
npm run test:e2e:mobile:lan:revert
```

- For secure-context browser behavior such as camera, location, notifications, service workers, or installed/PWA behavior, do not rely on the HTTP LAN helper as the proof path. Validate through HTTPS, a reviewed tunnel, or the hosted environment and document that validation path in the story, PR body, review log, and handoff.
- Playwright mobile e2e coverage is scoped to the player/scoring app surface only. Do not add admin, platform admin, tenant onboarding, audit, or other PC-oriented operator surfaces to mobile Playwright coverage unless explicitly requested.
- Before PR handoff, re-run the full gate and do not rely on earlier targeted test results.
- Local Codex review is required before push, but it does not replace CI, bot review, or the required local commands above.
- Repeat the local gate plus local review loop until any remaining findings are explicitly accepted, deferred, or rejected on purpose rather than by omission.
- Every PR must complete this full local gate plus local review loop before push.
- After the gate and local review loop pass, stop and wait for explicit user instruction before pushing or opening/updating the PR.
- Do not create docs/process-only exceptions.

## Security scan

- Run `npm audit --audit-level=high` locally if it does not block progress with noise.
- CI is the source of truth for security scanning.

## Playwright local setup

Playwright browser binaries are installed with:

```bash
npx playwright install chromium webkit
```

Linux hosts may also need browser system libraries installed with:

```bash
npx playwright install-deps chromium webkit
```

That command may require sudo and must be run from a terminal where the user can enter the sudo password.
