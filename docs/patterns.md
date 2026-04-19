# Approved Patterns Library

This file is the repo-owned snippets and patterns library for 18Birds.

Purpose:

- keep implementation consistent across contributors and sessions
- prefer proven repo patterns over inventing new shapes
- document the code paths already trusted for security, correctness, and maintainability

Related standards:

- `SECURITY-GUARDRAILS.md` defines mandatory security rules
- `FORM-STANDARDS.md` defines mandatory form/input behavior

How to use this file:

1. Before writing new code, check this file for an approved pattern that already matches the job.
2. Reuse the listed source pattern whenever it fits.
3. If no pattern fits, explain why a new pattern is needed before implementing it.
4. When a new pattern is accepted, add it to this file in the same PR.

When using Codex CLI or similar tools:

- prefer read-only inspection of the repo first
- search for the source files listed here before generating new code
- treat this file as a routing guide to proven implementations, not as a substitute for reading the live code

## Source Of Truth Rule

This library points to live source files. The live files remain authoritative if this document ever drifts.

## Pattern 0: Provider-Native Security First

Use when:

- designing auth flows
- adding abuse controls, rate limits, or lockouts
- protecting preview/deployment access
- adding other security-sensitive workflow controls

Approved source files:

- `AGENTS.md`
- `OUR-PROCESS.md`
- `SECURITY-GUARDRAILS.md`
- `src/lib/auth.ts`

Approved shape:

- prefer the provider-native or platform-native control first
- keep the browser as a consumer of the secure flow, not the authority for security outcomes
- if custom behavior is required, move the operation behind a server-owned boundary before adding custom logic

Do:

- use Supabase/Auth provider-native flows and rate limits by default
- keep auth error handling friendly and environment-neutral
- challenge custom client-driven security ideas before implementing them

Avoid:

- custom browser-reported auth failure/reset accounting
- client-only rate limiting as the real control
- inventing a bespoke security mechanism when the provider/platform already has a proven path

Required tests:

- provider-error mapping regressions
- success/failure behavior for the chosen provider-native path
- negative-path coverage when a server-owned boundary is introduced

## Pattern 1: Auth Reset And First-Password Flow

Use when:

- implementing forgot-password
- implementing first-login password setup
- implementing invite links that land in password creation

Approved source files:

- `src/lib/auth.ts`
- `src/App.tsx`
- `src/auth/AuthScreens.tsx`
- `src/app/routeState.ts`

Approved shape:

- trigger the email/reset action in `src/lib/auth.ts`
- send users to `/admin/reset-password` or the equivalent current route
- let route state detect the recovery token from the URL
- reuse `changePasswordWithAccessToken()` for the password update
- treat the recovery/welcome link as the real first-password setup step for invited admins
- keep user-facing errors friendly and environment-neutral

Do:

- reuse `requestPasswordReset()`
- reuse `changePasswordWithAccessToken()`
- use the current origin for local redirect targets
- map provider errors to friendly messages before surfacing them
- move invited-admin onboarding straight into the next real setup step after successful password creation instead of forcing a second password change in-app

Avoid:

- creating a second password-reset implementation
- asking invited admins to create a password from the secure link and then immediately change it again after login
- exposing provider payloads directly to users
- creating separate token parsing code in feature components

Required tests:

- route/token handling regression
- friendly error mapping regression
- success and failure coverage for the password update path

## Pattern 2: Shared Fetch And Response Guarding

Use when:

- adding a new fetch call
- handling retry or token-refresh logic
- mapping raw response failures into safe UI errors

Approved source files:

- `src/lib/transport.ts`
- `src/lib/auth.ts`
- `src/lib/supabase.ts`
- `src/lib/transport.test.ts`

Approved shape:

- perform the fetch
- pass the response through `throwIfResponseNotOk()`
- use `mapErrorMessage` only when a shared or clearly defined friendly mapping is needed
- use `withRefreshRetry()` when the operation should retry after session refresh

Do:

- reuse `throwIfResponseNotOk()`
- reuse `withRefreshRetry()` for refreshable auth-backed operations
- keep fallback errors concise and neutral

Avoid:

- ad hoc `if (!response.ok) throw new Error(await response.text())`
- duplicating refresh logic inside UI components
- returning raw JSON/provider detail to user-visible messages

Required tests:

- response failure mapping
- retry/refresh path where relevant
- unchanged behavior when refresh cannot recover

## Pattern 3: Input Normalization At The Boundary

Use when:

- accepting emails, usernames, names, phones, ABNs, slugs, or similar user input

Approved source files:

- `src/lib/inputValidation.ts`
- `FORM-STANDARDS.md`

Approved shape:

- constrain input in the UI where practical
- normalize and validate again at the submit boundary
- store canonical values only

Do:

- reuse helpers such as `normalizeEmailInput()`, `normalizePhoneInput()`, `normalizeAustralianPhoneInput()`, and `normalizeAbnInput()`
- keep field-specific errors plain English and specific
- normalize before comparing for uniqueness

Avoid:

- storing raw input and cleaning it up later
- duplicating regexes inside feature components
- comparing unnormalized identifiers

Required tests:

- accepted canonical input
- rejected invalid input
- duplicate/derived-field regression coverage when applicable

## Pattern 3A: Structured DB Calls Instead Of Runtime SQL

Use when:

- adding a new database read/write path from app runtime code
- adding a new privileged RPC call
- reviewing whether an injection concern belongs in app code or DB code

Approved source files:

- `src/lib/supabase.ts`
- `src/lib/auth.ts`
- `SECURITY-GUARDRAILS.md`

Approved shape:

- use fixed table/RPC endpoint names
- build REST filters with `URLSearchParams`
- send RPC arguments as JSON bodies
- keep authZ and data constraints in RLS / guarded RPCs / database functions

Do:

- reuse the existing Supabase REST/RPC request helpers
- keep runtime request construction structured rather than string-built
- treat any future raw SQL or dynamic SQL introduction as review-first work

Avoid:

- building SQL strings in runtime frontend code
- interpolating user input into ad hoc query text
- treating “we validated it in the UI” as a substitute for backend enforcement

Required tests:

- request-shape regression tests where helpers are changed
- negative-path coverage for backend rejection on privileged RPCs
- input-validation coverage for user-controlled arguments before they reach the request helper

## Pattern 3B: Advisory Uniqueness Check With DB Enforcement

Use when:

- a form field must be unique in the database
- earlier operator feedback would materially improve the workflow
- the UI wants to warn before submit without becoming the authority

Approved source files:

- `src/admin/PlatformTenantOnboarding.tsx`
- `src/lib/supabase.ts`
- `src/lib/platformTenants.ts`
- `FORM-STANDARDS.md`

Approved shape:

- validate and normalize locally first
- run the async uniqueness check on blur as advisory feedback only
- enforce the same uniqueness again with a DB constraint or server-owned boundary on submit
- map both the advisory conflict and the DB rejection to the same field-safe message
- clear stale uniqueness errors when the field value changes

Do:

- normalize before checking uniqueness
- use structured REST/RPC helpers rather than ad hoc query text
- keep the DB constraint as the source of truth
- fail honestly if the advisory check cannot complete

Avoid:

- treating blur-time availability as the real enforcement layer
- inventing a success state when the advisory check fails
- showing one message on blur and a different one on submit for the same uniqueness rule

Required tests:

- duplicate found during advisory blur check
- stale duplicate message clears when the field changes
- submit-time DB uniqueness rejection maps back to the same field error

## Pattern 3C: Address Autocomplete With Structured Manual Fallback

Use when:

- adding address lookup/autocomplete to a structured address form
- the form still stores split address fields rather than a single free-text address blob
- manual entry must remain possible if the provider is unavailable or the suggestion needs correction

Approved source files:

- `src/admin/PlatformTenantOnboarding.tsx`
- `src/lib/googlePlaces.ts`
- `src/lib/googlePlacesAddress.ts`
- `src/lib/runtimeConfig.ts`
- `FORM-STANDARDS.md`

Approved shape:

- render one provider-backed `Search address` control above the split address fields
- populate structured address fields from the selected result
- keep all address fields editable after autofill
- keep full manual entry available when lookup is missing or fails
- request only the minimum provider fields needed for address population

Do:

- keep the provider dependency behind a small helper/loader
- use frontend env config for the browser key and restrict it to the required Google APIs and hostnames
- map provider address components into repo-owned structured fields before submit
- show a plain-English fallback message if the lookup cannot load

Avoid:

- making address lookup the only way to enter an address
- storing only the provider-formatted address string when the repo uses split fields
- surfacing raw provider/auth/referrer errors to operators
- adding a map to admin forms when the requirement is only address capture

Required tests:

- runtime-config coverage for the address provider key
- address-component mapping coverage
- manual-entry fallback coverage when lookup is unavailable

## Pattern 4: Browser Storage Through Policy And Helpers

Use when:

- adding browser persistence
- changing how local/session storage is used
- introducing new storage keys

Approved source files:

- `src/lib/storagePolicy.ts`
- `src/lib/browserStorage.ts`
- `src/lib/storage.ts`

Approved shape:

- declare the key and rationale in `STORAGE_POLICY`
- access storage only via `browserStorage` helpers
- keep auth/session data out of persistent browser storage unless the policy explicitly allows it

Do:

- add or update the policy entry first
- reuse `readStorageJson()`, `writeStorageJson()`, and `removeStorageKey()`
- define cleanup behavior and future mobile guidance in the policy

Avoid:

- calling `window.localStorage` or `window.sessionStorage` directly in feature code
- inventing storage keys inline
- persisting live bearer tokens in local/session storage

Required tests:

- read/write/remove behavior
- cleanup behavior
- bootstrap or recovery behavior if the key affects auth/session

## Pattern 5: Local Workflow State Modules

Use when:

- a feature needs bounded prototype workflow state before a server-backed model exists

Approved source files:

- `src/lib/storagePolicy.ts`

Approved shape:

- keep workflow state in a dedicated module under `src/lib/`
- define load, create, update, clear, and validation helpers in that module
- keep the UI consuming the module rather than reimplementing transforms inline

Important scope limit:

- this pattern is for bounded low-risk prototype state only
- it is not approved for real platform/admin sensitive workflow data once a database-backed model exists

Do:

- centralize validation and transitions
- sort/load data consistently in one place
- keep prototype-only state explicitly labeled as temporary and replace it when a server-owned source of truth exists

Avoid:

- feature components writing raw JSON into storage

Required tests:

- record validation
- transition/idempotency behavior
- derived-field behavior such as slug generation and duplicate handling

## Pattern 6: Security Telemetry Ownership Boundary

Use when:

- adding security or audit logging
- deciding whether an event belongs in 18Birds logging or a provider dashboard
- changing admin/platform audit visibility

Approved source files:

- `SECURITY-GUARDRAILS.md`
- `SECURITY-REMEDIATION-PLAN.md`
- `docs/runbooks/security-telemetry-ownership-boundary.md`
- `src/lib/supabase.ts`
- `supabase/migrations/027_create_server_audit_log.sql`

Approved shape:

- provider-owned boundaries keep provider-owned telemetry
- 18Birds-owned business/admin/security actions get server-owned audit entries
- browser-local security logs remain secondary debug aids only

Do:

- use provider telemetry first for Cloudflare edge events, Supabase Auth abuse/CAPTCHA/throttles, and Vercel platform/runtime events
- use `audit_log_events` and repo-owned RPC/database paths for platform/admin/domain actions we actually own
- keep redaction rules in repo-owned code and docs
- make the ownership split explicit in docs before adding new telemetry

Avoid:

- rebuilding provider auth-abuse logging in browser code
- treating browser-local security events as the authoritative record
- mixing provider security events and app-domain audit events into one vague catch-all requirement

Required tests:

- coverage for any new server-owned event insert path
- regression coverage for redaction where sensitive context is accepted
- negative-path coverage when audit logging failure must not corrupt the primary business action

## Pattern 7: Async UI Actions With Locking And Status

Use when:

- adding modals, submits, or multi-step actions
- handling in-flight create/send/save actions

Approved source files:

- `src/auth/AuthScreens.tsx`
- `src/admin/PlatformTenantOnboarding.tsx`
- `src/admin/PlatformTenantOnboarding.test.tsx`

Approved shape:

- track explicit loading state
- disable the initiating control while the action is in flight
- add an imperative in-flight guard inside the submit/save handler for DB-backed actions so a second click cannot enter before the disabled rerender lands
- keep the user in context when validation fails
- show short, action-specific status or error feedback

Do:

- use a dedicated boolean like `loading`, `isCreatingTenant`, or `isSendingInvite`
- use a `useRef` guard such as `saveInFlightRef` or `submitInFlightRef` when the action writes data and duplicate entry would create conflicting requests
- keep the modal open for correction when validation fails
- show a visible activity label while the action is running

Avoid:

- closing a modal before validation completes
- allowing duplicate submits during in-flight actions
- relying on disabled-button rerenders alone to prevent rapid double-click duplicate saves
- hiding the only actionable feedback after a failed submit

Required tests:

- disabled state while in flight
- double-click or repeated-submit regression coverage when the action persists data
- validation failure stays in place
- success path updates the visible state

## Pattern 8: Access And Session Boundaries

Use when:

- deriving admin capabilities
- gating data or KPI visibility
- deciding whether a flow is global, tenant-scoped, or unavailable

Approved source files:

- `src/lib/accessControl.ts`
- `src/App.tsx`
- `src/admin/AdminScreens.tsx`

Approved shape:

- derive capability from auth/session context and shared helpers
- gate sensitive UI and data loading by capability
- treat tenant scope and platform scope separately

Do:

- use shared access-control helpers
- keep unauthorized data out of derived KPIs and hidden screens
- add regression tests when a visible metric or action depends on permission

Avoid:

- loading sensitive data first and hiding it later with CSS or rendering conditions
- duplicating scope decisions in multiple components without a helper

Required tests:

- authorized view
- unauthorized view
- no data leakage through derived counts, preload paths, or hidden tabs

## Pattern 9: Regression Test Style

Use when:

- fixing a bug
- adding a workflow transition
- changing auth/session behavior
- adding storage-backed behavior

Approved source files:

- `src/lib/transport.test.ts`
- `src/lib/auth.security.test.ts`
- `src/admin/PlatformTenantOnboarding.test.tsx`
- `src/App.flow.test.tsx`

Approved shape:

- write the reproduction around the behavior that previously broke or could drift
- keep pure transforms in unit tests
- keep UI state and operator actions in jsdom/component tests
- keep auth and security-sensitive flows in dedicated regression tests

Do:

- add a test in the same area as the changed behavior
- cover both success and failure/edge behavior where realistic
- use lightweight test helpers to keep repeated setup consistent

Avoid:

- relying only on manual testing for behavioral fixes
- placing workflow regressions only in broad smoke tests
- changing behavior without updating the nearest regression net

## Pattern 10: SQL Idempotency And Concurrency Guards

Use when:

- a workflow step must be safe to retry
- SQL does a check-then-insert or check-then-transition flow
- duplicate records or double-application could occur from retries, double-clicks, or parallel tabs

Approved source files:

- `supabase/migrations/024_add_tenant_onboarding_model.sql`
- `supabase/migrations/025_provision_initial_tenant_admin_auth.sql`
- `supabase/migrations/026_enforce_initial_club_admin_onboarding.sql`
- `supabase/migrations/027_create_server_audit_log.sql`

Approved shape:

- prefer a normal `unique` constraint plus `insert ... on conflict` when the business rule maps cleanly to table columns
- use `for update` when protecting a transition on an existing row
- use a transaction-scoped advisory lock only when dedupe depends on a logical/computed key that cannot be expressed cleanly as a simple unique constraint

Do:

- make retryable workflow SQL idempotent on purpose
- guard race-prone check-then-insert paths with a real atomic mechanism
- keep the locked/unique key aligned to the true business identity of the event or transition

Avoid:

- plain read-then-insert dedupe for workflow milestones
- using advisory locks as a default for all SQL
- relying on UI button disabling alone to prevent duplicate writes

Required tests:

- retry/idempotency coverage for the affected workflow
- regression coverage for duplicate-submit or already-advanced-state recovery where realistic

## Before Introducing A New Pattern

Check these in order:

1. `patterns.md`
2. `SECURITY-GUARDRAILS.md`
3. `FORM-STANDARDS.md` when the change touches user input or forms
4. the referenced source files
5. existing tests near the pattern

A new pattern is justified only when:

- no approved pattern fits the use case
- reusing the existing pattern would be materially incorrect
- the new pattern is documented in this file in the same PR

## Review Checklist Before Coding

Before new implementation work:

1. Identify whether the change touches auth, transport, validation, storage, workflow state, access control, or async UI actions.
2. Check the matching pattern section in this file.
3. Reuse the referenced source shape where it fits.
4. Add the matching regression coverage.
5. If you still need a new shape, explain why before coding and document it before merge.
