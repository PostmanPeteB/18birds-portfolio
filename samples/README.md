# Code Samples

This folder contains a small set of representative, sanitized code samples selected to demonstrate engineering approach, security thinking, and code structure rather than the full private production codebase.

## Included areas
- `auth/` — authentication, session handling, and security-focused regression coverage
- `data-access/` — data access and API interaction patterns
- `ui/` — representative frontend component structure

## Included samples
- `auth/auth.ts` — representative authentication and session-management logic showing validation, error handling, Supabase integration, token lifecycle handling, and user context hydration.
- `auth/auth.security.test.ts` — security-focused regression coverage demonstrating friendly error handling, fail-closed authorization behavior, in-memory-only session handling, and captcha propagation.
- `data-access/supabase.ts` — representative data-access layer showing frontend-safe Supabase configuration validation, runtime URL resolution, shared request helpers, and typed read/write patterns for core application data.
- `data-access/supabase.security.test.ts` — regression coverage for frontend-safe Supabase configuration, HTTPS enforcement, publishable-key validation, stable error mapping, and runtime URL resolution behavior.

## Note
Note: Supporting utilities and adjacent implementation files are intentionally omitted from this portfolio sample for brevity. The goal is to show representative engineering approach, security guardrails, and data-access structure rather than provide a complete standalone module.
