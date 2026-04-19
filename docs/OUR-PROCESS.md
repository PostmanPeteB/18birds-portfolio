# Our Process

This file captures the exact working process for making changes and PRs in this repo.

1. Start from the latest remote `feature-dev`, never work directly on `feature-dev` or `main`.
2. Create a fresh task branch with the required naming convention.
3. For feature work, read the workflow docs first, then create/update the timestamped user-story folder and story file before coding.
4. If the change has meaningful product, UX, security, architecture, persistence, or roadmap tradeoffs, stop in review-first mode and get explicit approval before implementing.
   - for security-sensitive work, review `SECURITY-GUARDRAILS.md`
   - for user-entered data and forms, review `FORM-STANDARDS.md`
   - if the change adopts a new security-sensitive OSS package, include before-adoption checks and after-adoption maintenance expectations in the review-first analysis
   - explain in plain English why the change is needed before implementing it, especially when it adds tooling, wrappers, config logic, or automation the user did not explicitly request
   - default to a manual runbook/workaround over new automation or generalized tooling unless the user explicitly asks for automation or the manual path would be unsafe
5. Implement on the task branch.
6. Restart local Vite after branch switches when local validation needs it, validate locally on the task branch, and use the same push gate for every PR with no docs/process-only exception.
7. Run the full required gate:
   - `npm run format`
   - `npm run lint:fix`
   - `npm run lint`
   - `npm run typecheck`
   - `npm test`
   - `npm run build`
   - `codex review --uncommitted`
8. Run the full gate and local Codex review in the foreground with visible terminal output. Do not hide them in the background or summarize them without first letting the user see the live command output.
9. Run local Codex review against the actual pending diff before push. Standard command: `codex review --uncommitted`.
10. Local Codex review must be allowed to run to completion. Do not kill it, cut it short, or wrap it in an arbitrary timeout.
11. If local Codex review returns material findings, state them clearly in terminal output with file, disposition, and a short summary, then discuss with the user to decide if a fix is required or the review can be rejected.
12. Repeat the full gate plus local Codex review until the review is clean enough that remaining findings are explicitly accepted, deferred, or rejected.
13. After the full gate plus local Codex review loop passes, stop and wait for the user's explicit instruction before pushing or opening/updating the PR.
14. Keep a review log in the repo:
    - use `docs/reviews/<branch-slug>-local-review.md` before PR creation
    - use `docs/reviews/pr-<number>-local-review.md` once the PR exists
    - record each local review run, each material finding, its disposition, and the fix/rationale
15. Commit after the gates and local review loop pass, preferably as a single commit.
16. Open a PR as ready, never use draft, to `feature-dev` using `gh pr create --base feature-dev --fill` only after the user explicitly instructs you to push/open or update the PR.
17. Fill the PR with the required content from the template in `.github/pull_request_template.md`:
    - plain-English summary
    - why it changed
    - user-visible impact
    - privacy/error-handling note
    - story tracking status
    - boundary compliance
    - validation checklist
    - real-world validation steps to run after merge on synced local `feature-dev`
18. If review feedback arrives, update the same branch/PR by default rather than opening a new one, update the review log, and report each recommendation plus disposition in terminal output.
    - if a security finding changes a reusable pattern or durable rule, update the corresponding standards/process docs in the same PR where practical
19. Before patching any review finding, inspect the whole affected area for adjacent edge cases and workflow implications rather than fixing only the exact commented line.
20. Classify every review finding immediately as one of:
    - real and must fix
    - real but can be deferred only with the user's explicit approval and repo-owned documentation
    - theoretical or non-issue for this workflow
21. Do not compromise on security. Any finding that affects hosted environments, real security posture, authorization, privacy, secret handling, or documented security practices is not eligible for dismissal as a theoretical non-issue.
22. Prefer the simplest implementation that satisfies the real requirement. Avoid adding generalized wrapper logic, fallback branches, or future-proofing that is not needed for the current workflow because it expands review surface and bug risk.
23. Distinguish MVP-safe from fully generalized. Optimize for secure hosted testing, reliable real workflow behavior, and minimal moving parts in this current single-operator pre-launch environment unless the user explicitly asks for broader generalization.
24. Use a stop rule on bot comments: if a comment does not affect hosted environments, actual deployment commands the team uses, the runbook, real app behavior, real security posture, regression coverage, or repeatable validation/setup, explain why it is out of scope, wait for explicit user approval before coding, and then record the disposition.
25. Do not introduce new automation, wrappers, config toggles, or toolchain complexity as a silent “helpful” step. First explain the purpose in plain English, explain the manual alternative, and get explicit approval unless the change is required to prevent a real security issue in the current workflow.
26. Default to battle-tested provider-native or platform-native solutions for auth, security controls, abuse prevention, and deployment protection. Do not build custom client-driven security mechanisms when a standard provider/platform path already exists.
27. If custom security behavior is truly needed, first move the operation behind a server-owned boundary, then add the minimum custom logic there. Do not rely on browser-reported security outcomes as authoritative.
28. Only the user merges the PR.
29. After merge, immediately sync local back to remote `feature-dev` with:

```bash
git fetch origin
git checkout feature-dev
git reset --hard origin/feature-dev
```

30. Revalidate locally on merged `feature-dev`.
31. At pause/end of session, write a session summary, update `session-summaries/LATEST.md`, then run `/home/pete/projects/18Birds/scripts/dr-backup-home.sh`.

## Remodel Point Of View

This repo is currently building a new system in a dev/test environment, not performing a live legacy-data migration.

Big picture:

- 18Birds is being built as a multi-surface platform:
  - player product
  - club administration product
  - platform / superuser product
  - system documentation surface
  - future AI helpdesk and voice support surface
- the current work is in the Phase 1 remodel/cutover program
- Phase 1 priority is to get the future schema, relationships, authorization model, and tenant-scoped behavior correct
- that means correctness of the new baseline matters more than preserving incidental old rows from a hypothetical production past

## Data Posture During The Remodel

Unless the user explicitly says otherwise, treat the working database as disposable dev/test data.

Default operating assumptions:

- prefer deterministic reset/reseed scripts over nursing forward incidental database state
- prefer repeatable SQL script packs and verification SQL over one-off manual repair steps
- validate remodel stories against known seeded users, tenants, courses, and scenarios
- use clean reseed paths when that is the honest way to prove the new model works
- do not optimize by default for preserving hypothetical historical production rows that do not exist in this environment

## How To Evaluate Bot Reviews

Bot reviews are not ignored, but they must be judged against the current remodel posture.

Challenge review findings when they are mainly about protecting imagined legacy/live production data in this dev/test-only environment.

Still fix review findings that affect:

- current correctness
- forward schema integrity
- authorization and tenant isolation integrity
- security or privacy posture
- realistic, repeatable dev/test validation

Working rule:

- if a review comment improves the truth and safety of the future system, fix it
- if a review comment mainly preserves accidental old state that this remodel is intentionally replacing, challenge it before implementing it

## Implication For Development Going Forward

During the remodel:

- seed scripts, verification SQL, and test packs are first-class deliverables
- comprehensive testing belongs inside each remodel phase, not as cleanup at the end
- reset/reseed is preferable to ad hoc patching when validating remodel work
- tenant scope and authorization must be proven with honest seeded scenarios
- the goal is to establish the correct future baseline for the platform, not to carefully carry forward accidental legacy state
