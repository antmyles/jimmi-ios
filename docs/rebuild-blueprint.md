# JIMMI Rebuild Blueprint and Recovery Decision Note

## Purpose

This document records the current controlled rebuild direction for **JIMMI** after the user chose to continue in the existing project rather than starting a separate task or performing a destructive database cleanup. The working approach is to keep the project source clean, leave legacy recovery-era database artifacts untouched, and rebuild the product path in small validated increments.

> The selected direction is a **safe clean rebuild inside the existing project**. Old database tables and data remain in place, but the active application code only relies on the retained auth and onboarding/profile path needed for the current foundation.

## Recovery Context and Decision

The project previously contained recovery-era implementation work and old database tables. A destructive migration was generated during cleanup, but the platform blocked the `DROP TABLE` operation to protect existing data. After that safeguard, the chosen path was to **leave the database as-is** and work around unused legacy tables instead of deleting data.

| Decision Area | Options Considered | Selected Direction | Risk Managed |
|---|---|---|---|
| Project continuity | Continue here or start a new project | Continue in this project | Preserves setup, auth wiring, project history, and current checkpoint context. |
| Database cleanup | Drop old tables, back up then drop, or leave untouched | Leave old tables/data untouched | Avoids irreversible data loss and blocked destructive SQL operations. |
| Product rebuild | Restore older implementation or rebuild from a minimal foundation | Rebuild from clean foundation | Keeps the app understandable and avoids carrying stale recovery-era code. |
| First module | Marketing, dashboard, chat, or onboarding | Onboarding first | Creates the source of truth for future profile, chat, and coaching personalization. |

## Restoration and Rollback Options

The latest checkpoint records the validated onboarding foundation. If future work breaks the project, rollback should use the project checkpoint system rather than destructive file operations. A full original-code recovery is not being pursued right now because the user explicitly approved continuing the rebuild and keeping old data untouched.

| Option | When to Use | Main Risk | Recommendation |
|---|---|---|---|
| Stay on current checkpoint | Normal forward development | Legacy database artifacts remain unused | Recommended. Continue rebuilding module by module. |
| Roll back to latest checkpoint | A new change breaks onboarding, routing, or auth | Work after checkpoint is lost | Use checkpoint rollback if manual repair is unsafe. |
| Start a new project | User wants a fully fresh database and project history | Loses continuity and requires redoing setup decisions | Not needed technically right now. |
| Destructive database cleanup | Only after export and explicit approval | Irreversible data loss; SQL may be blocked | Defer unless there is a clear reason and backup. |

## Current Product Scope

The current rebuild foundation is intentionally narrow. It keeps authentication, onboarding, a lightweight post-onboarding chat destination, and a lightweight profile page. Marketing polish, full AI coaching, logging, subscriptions, analytics, reminders, and scanner flows should be rebuilt later only after the foundation is stable.

| Route | Access | Current Purpose | Next Evolution |
|---|---|---|---|
| `/` | Public | Black-background JIMMI entry point with Login and Start Trial actions | Later connect pricing and conversion flow. |
| `/onboarding` | Authenticated | Multi-step intake that saves progress and completes the user's baseline | Later add richer edit/resume UX and profile confirmation. |
| `/chat` | Authenticated | Lightweight welcome destination after Start Coaching | Later integrate JIMMI coaching assistant with scope limits and medical disclaimers. |
| `/profile` | Authenticated | Reads onboarding answers as the initial My Profile foundation | Later make profile editable and sync updates back to onboarding profile data. |

## Onboarding Field Contract

Onboarding is the first core product module and the current source of truth for personalization. The requested intake fields are implemented as the foundation for future chat and profile behavior.

| Field | Control | Required | Notes |
|---|---|---:|---|
| Name | Text input | Yes | Captures the user's preferred profile name. |
| Date of Birth | Calendar/date input | Yes | Used to compute age automatically instead of storing manual age. |
| Gender | Dropdown | Yes | Captures gender selection through a controlled list. |
| Weight | Numeric input | Yes | Captures bodyweight for future coaching context. |
| Height | Scroll selector | Yes | Uses a scroll-style selector rather than a plain freeform text field. |
| Activity Level | Choice control | Yes | Captures current activity baseline. |
| Fitness Level | Choice control | Yes | Captures user training experience level. |
| Fitness Goal | Choice control | Yes | Captures the primary coaching goal. |
| Dietary Restrictions | Multi-choice control | Yes | Captures nutrition constraints. |
| Health Complications | Multi-choice control | Yes | Supports multiple health complications. |
| Food Allergies | Multi-choice/text-style intake | Yes | Captures allergy constraints for nutrition guidance. |
| Additional Info | Text area | No | Optional freeform context. |

## Visual Direction

The active visual direction is **black-background, dark luxury, and sleek**. The design should avoid thick bold typography and instead use lighter, refined letterforms, premium spacing, subtle borders, and restrained electric-citron accents.

| Design Attribute | Direction |
|---|---|
| Background | Black foundation with dark elevated surfaces. |
| Typography | Light to medium weight, refined, not thick or overly bold. |
| Accent | Restrained electric citron for action and metadata emphasis. |
| Surfaces | Low-contrast luxury cards with fine borders and soft depth. |
| Tone | Calm, premium, coaching-oriented, and not generic fitness neon. |

## Validation Expectations

Every rebuild milestone should include TypeScript validation, Vitest coverage, and development server health checks before checkpointing. For onboarding, coverage includes the server-side onboarding contract and focused UI source tests that verify the requested controls and visual patterns are present.

## Next Recommended Milestone

The next rebuild milestone should be to convert the lightweight chat page into the first scoped **JIMMI coaching assistant**. That assistant should use the onboarding profile as context, answer only fitness, wellness, health, and nutrition questions, and include a medical-professional disclaimer before medical-adjacent guidance.
