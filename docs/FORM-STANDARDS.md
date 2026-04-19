# Form Standards

This document defines the mandatory form, input, validation, and inline guidance rules for 18Birds.

It is the authoritative standard for how user-entered data must be handled across web and future mobile-facing surfaces.

## 1. Core Rule

Every form must use defense in depth:

1. constrain input in the UI where practical
2. explain the expected format clearly to the user
3. normalize and validate again at the submit boundary
4. revalidate again on the server/database path
5. store canonical values only

No single layer is sufficient by itself.

## 2. Form Architecture Rule

Do not build sensitive forms as ad hoc collections of raw inputs with one-off validation.

Preferred architecture:

- shared field wrapper for:
  - label
  - helper text
  - tooltip or guidance copy
  - required/optional state
  - inline error placement
- shared field components for common data types
- shared submit-boundary normalization/validation helpers

## 3. UI-Level Control Rules

Use UI controls to prevent bad input where practical.

Examples:

- use select/radio/checkbox when the value space is finite
- constrain length where hard limits are known
- prefer purpose-built field components for email, phone, ABN, slug, address, and names
- use typed input modes only when they improve correctness, not as the only validation

Do not:

- rely on free-text where a constrained choice is more correct
- rely on placeholder text as the only instruction
- rely on submit-time validation alone when the input can be constrained earlier

## 4. Guidance And Tooltip Rules

Every form field must make the expected input obvious.

Required:

- a clear label
- helper text or tooltip when the expected format, rule, or downstream effect is not obvious
- field-specific plain-English error text when validation fails

Guidance should tell the user:

- what the field is for
- what format it expects
- any important restrictions

## 5. Validation Rules

Validation must exist at three levels:

### UI Constraint

- prevent obviously invalid shapes where practical

### Submit Boundary

- run shared normalization and validation helpers
- fail with field-specific errors
- compare duplicates on normalized values only

### Server/Database

- revalidate before persistence
- enforce constraints in schema/RPC/backend logic where appropriate

## 6. Canonicalization Rules

Canonical values must be defined and stored for repeated field types.

Examples:

- emails: trimmed, normalized case policy
- slugs: lowercase canonical slug format
- phone numbers: normalized canonical storage shape
- ABNs: normalized digits-only canonical storage shape where appropriate

Do not store raw user input and “clean it later.”

## 7. Error Placement Rules

Validation feedback must stay close to the field or action that failed.

Required:

- field-level errors appear under or adjacent to the field when possible
- modal workflows keep the user in context when correction is needed
- submit buttons lock while requests are in flight

Avoid:

- closing a modal before the result is known
- showing the only useful error far away from the field that caused it
- surfacing raw provider/internal payloads

## 8. Security-Sensitive Form Rule

Forms that touch auth, admin/platform data, tenant data, invites, passwords, contact data, or other sensitive workflows must:

- use approved shared components once available
- include explicit helper text/tooltips
- define server-side enforcement and storage format
- include negative-path tests

## 9. Required Reusable Form Components

The shared UI library should provide approved components for at least:

- `NameField`
- `EmailField`
- `PhoneField`
- `ABNField`
- `SlugField`
- `AddressField`
- `PasswordField`
- shared `FormField` wrapper with helper text, tooltip, required marker, and inline error slot

These components must encode:

- label behavior
- helper-text / tooltip support
- normalization hooks
- inline error placement
- accessibility expectations

## 10. Required Test Coverage

For form changes, tests must cover:

- accepted valid input
- rejected invalid input
- normalization behavior
- duplicate/uniqueness behavior when applicable
- inline error placement
- in-flight locking behavior for async submit paths
- server/backend rejection mapping where applicable

## 11. Relationship To Other Docs

- `SECURITY-GUARDRAILS.md` defines the non-negotiable security rules
- `patterns.md` should point only to approved secure form patterns
- `SECURITY-ACCEPTANCE-CRITERIA-TEMPLATE.md` should be used for new security-sensitive features
