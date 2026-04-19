# 18Birds Platform Vision

Created: 2026-03-08
Owner: Product / Engineering

## Purpose

This document is the source of truth for the big-picture product vision.

Use it when evaluating:

- architecture decisions
- workflow/process changes
- auth/session/storage decisions
- environment and deployment choices
- roadmap sequencing
- any tradeoff that could make future expansion harder

This document must be referenced during review-first decisions so short-term changes do not cut across the long-term platform direction.

## Product Surfaces

18Birds should be treated as a multi-surface platform, not a single app.

### 1. Player Product

Primary purpose:

- let players play social and tournament rounds
- view tournament leaderboard and related round context
- upload eligible rounds to Golf Australia for handicap updates
- support future player/member features

Future direction:

- should be able to evolve into dedicated iPhone and Android apps
- player logic should stay as independent as possible from admin and platform tooling
- player UX decisions should default to phone-first, touch-first use on the golf course rather than desktop-browser assumptions

### 2. Club Administration Product

Primary purpose:

- provide each club with a full operational backend
- support membership administration
- support tournament administration
- support sponsor, newsletter, social, and automated club workflow features
- support future club-management capabilities

Future direction:

- should behave like a true club operations product, not just a side panel inside the player app

### 3. Platform / Superuser Product

Primary purpose:

- give 18Birds support and operations staff a global view across all clubs
- provide cross-club health, support, and exception management
- expose platform-level administration that club admins must not access

Future direction:

- must remain clearly separated from club-admin capabilities and permissions

### 4. System Documentation Surface

Primary purpose:

- provide full HTML documentation of the system
- include screenshots and operator guidance
- support onboarding, support, release, and operational workflows

Future direction:

- should become a first-class product support surface rather than scattered notes

### 5. AI Helpdesk And Voice Support Surface

Primary purpose:

- support AI-assisted helpdesk and voice support experiences
- connect users and support staff to the right workflows and documentation
- reduce manual support burden over time

Future direction:

- should be designed with clean boundaries to player, club-admin, superuser, and documentation systems

## Architectural Implications

These are the default assumptions for future decisions:

1. Player, club-admin, and superuser are separate product surfaces.
2. Shared domain/auth/integration modules can be reused, but UI and workflow logic should not be tightly coupled across surfaces.
3. Player architecture decisions must be evaluated against future mobile-app requirements.
4. Superuser capabilities must not be treated as an extension of club-admin UI.
5. Documentation and AI/helpdesk should be planned as real platform surfaces, not bolted on as miscellaneous pages later.

## Decision Rule

Before approving a significant change, ask:

1. Which product surface or surfaces does this affect?
2. Does it make future player-mobile work easier or harder?
3. Does it keep club-admin and superuser concerns properly separated?
4. Does it preserve room for documentation and AI support surfaces?
5. Is this a local optimization that creates platform debt later?

If the answer to any of those is unclear, the change should be reviewed before implementation.

## Near-Term Guidance

For the current codebase:

- prefer separating product surfaces before adding large numbers of new features
- avoid embedding superuser concerns inside club-admin flow structure
- avoid player-specific decisions that assume the player product will remain web-only
- treat the player surface as a phone-first product in practical use:
  - prioritize touch interaction, tap confidence, readability, and fast task completion on a mobile device
  - deprioritize desktop-only polish such as hover-driven behavior unless it also improves the phone experience or materially helps a non-player surface
- prefer shared domain/auth contracts with surface-specific UI and orchestration
- keep user-facing error handling neutral and reusable across surfaces

## Relationship To Other Docs

- `AGENTS.md` defines how work must be executed
- `WORKFLOW.md` defines the delivery workflow
- `ARCHITECTURE-BOUNDARIES.md` defines current boundaries and should align to this vision
- `ENVIRONMENTS.md` defines current runtime/deployment model

If any of those docs conflict with this platform vision, update them so the repo stays aligned.
