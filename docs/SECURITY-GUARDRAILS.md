# Security Guardrails

This document defines mandatory secure coding and delivery guardrails for 18Birds.

These rules apply to web and future mobile-facing product work unless an explicit decision record says otherwise.

## 1. Trust Boundaries

- Never trust browser input, browser state, hidden fields, route state, or client capability flags as authoritative.
- UI checks are convenience and UX only unless backed by server/database enforcement.
- Sensitive admin/platform actions must have an identified backend enforcement point.

## 2. Input And Output Safety

- Constrain user input in the UI where practical.
- Normalize and validate again at the submit boundary.
- Revalidate before persistence on the server/database path.
- Store canonical values only.
- Treat all user-provided text as untrusted on output.
- Do not introduce raw HTML rendering for untrusted content without an explicit sanitization decision.
- Do not construct raw SQL in runtime app code.
- Runtime database access must use structured Supabase REST/RPC calls or another reviewed adapter, not string-built SQL.
- Any introduction of raw SQL or dynamic SQL requires review-first with an explicit injection-safety explanation.

## 3. Storage Rules

- Do not store live bearer tokens in browser local/session storage.
- Do not store sensitive platform/admin workflow data in browser storage unless the user explicitly approves a temporary prototype exception.
- Browser-local state is acceptable only for:
  - player offline/runtime convenience data
  - low-risk local preferences
  - secondary debug caches that are not authoritative
- The database must be the source of truth for any real admin/platform workflow.

## 4. Secrets And Access Controls

- Never ship secrets, passwords, service-role keys, or private credentials to the client bundle.
- Never use a client-embedded shared password as a real security control.
- Use least privilege for database roles, grants, and services.
- Prefer RBAC/RLS and narrowly-scoped RPCs over broad client-driven table access.

## 5. Auth And Authorization

- Prefer provider-native or platform-native auth protections over custom auth security logic.
- Do not build custom client-driven login/reset abuse controls unless the auth operation first moves behind a server-owned boundary.
- Browser-reported auth failures, reset sends, or other auth outcomes are not authoritative security signals.
- Frontend session/admin helpers are hints for routing and rendering only.
- All privileged reads/writes must be enforced by RLS, backend checks, or guarded RPC/database functions.
- Tenant isolation must be proven through backend rules, not only hidden UI.
- New admin/platform features must state:
  - who can read
  - who can write
  - where enforcement happens

## 6. Logging And Monitoring

- Security-relevant events require an authoritative server-owned audit trail.
- Local browser security logs are secondary debug aids only.
- Logs must avoid sensitive raw secrets/tokens/passwords.
- Redaction is mandatory for security telemetry.
- Prefer provider-owned telemetry for provider-owned boundaries:
  - Cloudflare for edge bot/WAF/rate-limit events
  - Supabase Auth for auth endpoint abuse, CAPTCHA, and provider throttle outcomes
  - Vercel for deployment/runtime platform events
- Prefer 18Birds-owned server telemetry for 18Birds-owned actions:
  - platform/admin actions
  - role and membership changes
  - tenant onboarding milestones
  - security-relevant authorization decisions inside repo-owned database/RPC paths
- Do not duplicate provider telemetry in browser code just to create a second log trail.
- If stronger custom auth telemetry is ever required, move the auth operation behind a server-owned boundary first.

## 7. CI And Verification

- Security-critical config validation must run in CI, not only locally.
- `npm audit` output is advisory by default in this repo until we explicitly promote it to a blocking gate.
- High-severity dependency findings still require review and disposition; advisory does not mean ignored.
- New security-sensitive features require negative-path tests.
- Security findings from local review, bot review, or audits must be recorded and dispositioned explicitly.

GitHub protection expectations:

- Require pull requests for changes targeting `feature-dev` and `main`.
- Require the CI workflow to pass before merge.
- Do not allow direct pushes to `main`.
- Prefer no direct pushes to `feature-dev` except explicit repository-owner override.
- Enable GitHub secret scanning for the repository.
- Enable push protection for secrets if the repository plan supports it.

## 8. OSS Adoption Guardrails

- For commodity security controls, evaluate OSS/package-first before building a custom mechanism.
- Do not adopt a security-sensitive package directly into feature code without an explicit review-first decision.

Before adoption, check:

- maintenance health and release cadence
- license suitability
- known vulnerabilities / advisories
- whether the package is still actively supported
- whether we can keep a thin repo-owned wrapper around it

After adoption, maintain:

- pinned versions in the repo lockfile/package manifest
- automated update visibility through dependency alerts or update PR tooling
- review of release notes for security-sensitive packages
- prompt handling of security advisories and breaking changes

Code-design rules for OSS:

- wrap security-sensitive packages behind repo-owned helpers or adapters
- do not spread direct package calls across the codebase when a thin wrapper can contain the blast radius
- keep repo-owned policy, logging, error handling, tests, and rollout behavior even when the mechanism comes from OSS
- if a package becomes abandoned, risky, or unsuitable, replace it through a tracked remediation slice rather than leaving it implicit

## 9. Forbidden Patterns

- browser-local persistence of sensitive platform/admin workflow records
- client-bundled preview passwords or secrets
- client-only rate limiting as the real control
- client-only authorization for privileged operations
- raw provider/internal error payloads shown to end users
- direct use of browser storage in feature code when shared policy/helpers exist
- raw SQL construction in runtime frontend code
- dynamic SQL with user-controlled input unless explicitly reviewed and justified

## 10. Required Review-First Topics

Use review-first mode before implementation when a change affects:

- auth or session handling
- authorization / tenant isolation
- browser storage of anything sensitive
- form/input architecture for sensitive workflows
- audit logging / monitoring
- secrets / preview / deployment protection
- database privilege model or `SECURITY DEFINER` behavior
- adoption of a new security-sensitive OSS package or service

## 11. Relationship To Other Docs

- `SECURITY-REMEDIATION-PLAN.md` tracks current remediation work and accepted risks
- `FORM-STANDARDS.md` defines mandatory input/form behavior
- `patterns.md` must only point to patterns that comply with these guardrails
