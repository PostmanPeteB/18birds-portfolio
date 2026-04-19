# AGENTS.md — 18Birds Codex Working Protocol

## Precedence

- `AGENTS.md` is the authoritative process document for this repo.
- Read `OUR-PROCESS.md` at the start of each session before beginning work.
- Use `PLATFORM-VISION.md` as the source of truth for long-term product direction.
- Use `patterns.md` as the source of truth for approved reusable code patterns.
- Use `SECURITY-GUARDRAILS.md` as the source of truth for mandatory security rules.
- Use `FORM-STANDARDS.md` as the source of truth for form/input behavior and validation rules.

## Core operating instructions

- Lying is completely unacceptable. If something is not working you must advise honestly.
- You must never create mock data to make something work.
- If you are considering a fallback it must be disclosed.
- Never silently swallow errors to keep things "working." You must always surface the error.
- Never substitute placeholder data to make something work.
- Design for debuggability, not cosmetic stability.
- You must not show positivity bias - honesty is the only option and outranks politeness 100x.
- The GOLDEN RULE is you "must speak the truth".

## Core repo rules

- Base branch is `feature-dev` (protected). Never push directly to `feature-dev` or `main`.
- All work must be delivered through a PR targeting `feature-dev`.
- Only the user merges PRs to `feature-dev`.
- Always start from the latest remote `feature-dev` before creating a new branch.
- Wait for explicit user approval before pushing, opening, or updating a PR.
- After a PR is merged, sync the local workspace back to the latest remote `feature-dev` before continuing.
- Run all required quality gates before PR handoff.
- Do not create docs/process-only exceptions to branch, PR, gate, or review requirements.

## Architecture policy

- Mandatory: follow `docs/architecture/ARCHITECTURE-DECISIONS.md` for buy-before-build policy, ADR triggers, and architecture decision workflow.
- Before introducing or replacing any provider, service, major package, or architecture pattern, review that document and any relevant records in `decisions/`.
- If IndieStack MCP is available, use it as a discovery input during buy-before-build evaluation for non-differentiating capabilities covered by `docs/architecture/ARCHITECTURE-DECISIONS.md` before recommending custom implementation.

## Workflow and delivery policy

- Follow `docs/workflow/PR-AND-BRANCH-RULES.md` for branch naming, PR behavior, merge-order guidance, and local validation expectations.
- Follow `docs/workflow/QUALITY-GATES.md` for required commands and pre-push review loop rules.
- Follow `WORKFLOW.md` and `user-stories/WORKFLOW.md` for feature and user-story workflow.
- Follow `docs/workflow/COMPLETION-CRITERIA.md` for handoff and task completion requirements.

## Review policy

- Follow `docs/reviews/REVIEW-PROTOCOL.md` for local Codex review, review logging, terminal review output, security feedback loop, and PR review handling.
- Treat bot reviews as a quality filter, not an automatic command source.

## Architecture and product boundaries

- Follow `ARCHITECTURE-BOUNDARIES.md` for boundary rules.
- Follow `PLATFORM-VISION.md` for roadmap alignment and future product-surface implications.
- Follow `docs/product/PRODUCT-DECISION-RULES.md` for review-first changes, scope control, and player-surface UX priorities.
- Tenant-admin wizard onboarding is now deprecated for new work. Do not extend or re-entrench wizard-step UX.
- Course setup and membership import must now be treated as operator-led provisioning tools owned by Platform Admin surfaces and supporting scripts/SQL, not as future tenant-admin wizard steps.

## Remodel and database policy

- Follow `docs/remodel/REMODEL-RULES.md` for remodel-only testing, schema, slice, and SQL documentation rules.
- Follow `docs/database/SUPABASE-PREFLIGHT.md` before proposing or applying SQL changes or promoting a slice from prototype-only to real DB-backed workflow.

## Environment, backup, and handoff policy

- Follow `ENVIRONMENTS.md` for environment and deployment operating model.
- Follow `DR.md` for disaster recovery and backup rules.
- Follow `docs/SESSION-HANDOFF.md` whenever work is paused for sleep, meals, breaks, or end-of-day shutdown.

## Safety

- Do not change behavior unless explicitly required by the task.
- Keep changes minimal and localized.
- Approved destructive command in this repo: `git reset --hard origin/feature-dev` as part of the branch sync workflow.
- Never commit literal secrets, passwords, API tokens, private keys, or real credentials.
- User-facing errors must remain graceful, concise, and environment-neutral.
- Prefer preventing bad input over patching around it later.

## Approved pattern reuse

- Read `patterns.md` before introducing a new code pattern.
- Reuse approved patterns when they fit the task.
- If no approved pattern fits, explain why a new pattern is needed before implementing it.
- If a new pattern is accepted, update `patterns.md` in the same PR.

## Output requirement

A task is complete only when:

- the branch is pushed to origin
- a PR is opened targeting `feature-dev`
- the PR/body and linked story artifact include a plain-English summary and real-world validation steps
