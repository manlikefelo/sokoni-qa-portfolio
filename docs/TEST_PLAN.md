# Test plan — Sokoni

**System under test:** Sokoni e-commerce platform
**Author:** Felix Githure
**Status:** executed; results in `DEFECTS.md` and `TRACEABILITY.md`

---

## 1. Purpose

Verify that Sokoni behaves as specified in `SOKONI_PRD.md` sections 4 and 5, and that
the security controls in section 7 hold. The application contains ten deliberately
seeded defects, documented in `SEEDED_DEFECTS.md`; a secondary purpose of this plan is
to demonstrate that a suite written from the specification — without reading the defect
list first — finds all of them.

## 2. Scope

### In scope

| Area           | What is covered                                                                                                                                                                                                |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Catalogue      | Search by name and description, case variations, category multi-select, price range with inclusive bounds, four sort orders, pagination across 25 products at 12 per page, empty states, URL state persistence |
| Product detail | Variant selection, stock indication, quantity bounds, add to cart, 404 for unknown and inactive slugs                                                                                                          |
| Cart           | Guest and authenticated carts, merge on login, quantity changes on every available path, stock ceiling, removal, persistence, live subtotal                                                                    |
| Promo codes    | All seven seeded codes, case-insensitive entry, expiry including the same-day boundary, minimum spend, usage limits, discount scope                                                                            |
| Pricing        | Subtotal, discount, shipping threshold, total — 25 data-driven cases plus rounding and scope specs                                                                                                             |
| Checkout       | Guest and registered journeys, three addressable steps, address validation, all six payment outcomes, stock invariants, idempotency, concurrency                                                               |
| Accounts       | Registration and its password policy, sign-in, no user enumeration, password change, address book, order history, ownership                                                                                    |
| Admin          | Role gating, product CRUD, stock adjustment, order status state machine across every transition                                                                                                                |
| API            | Mock gateway contract, route-level authorisation, security headers, cookie flags                                                                                                                               |
| Accessibility  | axe-core on nine page states, keyboard-only purchase journey, focus visibility, heading structure, image alt text                                                                                              |
| Visual         | Ten baselines across five screens at two viewports                                                                                                                                                             |

### Out of scope

| Excluded                       | Reason                                                                                                                                               |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Load and performance testing   | Out of scope per the brief. A SQLite-backed demonstration application would not produce meaningful numbers.                                          |
| Penetration testing            | The suite asserts the PRD 7 controls hold; attempting to defeat them is a different discipline requiring different tools and explicit authorisation. |
| Contract and mutation testing  | Out of scope per the brief.                                                                                                                          |
| Real payment processing        | The gateway is an internal mock by design.                                                                                                           |
| Email delivery                 | The application logs rather than sends.                                                                                                              |
| Cross-browser pixel comparison | Functional specs run on four browser projects; screenshot baselines are Chromium-only. Reasoning in `TEST_STRATEGY.md`.                              |

## 3. Approach per layer

**End-to-end (`tests/e2e/`).** The bulk of the suite. Drives real browsers through real
journeys against a production build. Page Object Model throughout; no locator appears in
a spec file.

**API (`tests/api/`).** Playwright's `request` fixture against route handlers, with no
browser involved. Covers the gateway contract, and authorisation as distinct from hidden
UI controls — a customer finding no admin link proves nothing about whether the server
would refuse the request.

**Accessibility (`tests/a11y/`).** `@axe-core/playwright` across all four WCAG 2.0 and
2.1 A/AA tag sets. Critical and serious violations fail the build; moderate and minor
are printed. Keyboard traversal is asserted separately, because axe cannot tell whether
a journey is actually completable without a mouse.

**Visual (`tests/visual/`).** `toHaveScreenshot` with a 1% pixel tolerance, on fixture
data rather than the seeded catalogue so a seed edit does not invalidate every baseline.

## 4. Test environment

|             |                                                            |
| ----------- | ---------------------------------------------------------- |
| Application | Next.js 16 production build, served by `next start`        |
| Database    | SQLite, migrated and seeded before the run                 |
| Runner      | Playwright Test, TypeScript                                |
| Browsers    | Chromium, Firefox, WebKit, Mobile Chrome (Pixel 7 profile) |
| Workers     | Unbounded locally; 2 in CI                                 |
| Retries     | 0, locally and in CI                                       |
| CI          | GitHub Actions, Ubuntu, Node 22                            |

The suite runs against a **production build**, not the development server. This matters:
Next.js streams dynamic routes differently in development, and several assertions are
about HTTP status codes. A 404 asserted against `next dev` can pass while the same route
returns 200 in production, which is how two genuine defects in this application were
found.

### Seeded accounts and data

Three users (one admin, two customers), 25 products across three categories, 47
variants with seven at zero stock and seven at exactly one, and seven promo codes
covering valid, expired, same-day-expiring, inactive and single-use cases. The seed is
deterministic: product `createdAt` values are spaced one hour apart from a fixed epoch
so that "newest" ordering is reproducible.

`TEST_SUPPORT_TOKEN` is set for test runs only. It enables one route that clears
rate-limit buckets; without it that route answers 404.

## 5. Entry criteria

- [x] Application builds with zero TypeScript errors under `strict`
- [x] ESLint and Prettier clean
- [x] Migrations apply and the seed completes from a clean database
- [x] All four browser projects installed
- [x] A trivial smoke test green in CI before any feature spec was written

## 6. Exit criteria

- [x] Every Section 4 requirement has at least one covering test, mapped in `TRACEABILITY.md`
- [x] All ten seeded defects caught by named tests written from the specification
- [x] Zero `waitForTimeout` or equivalent arbitrary wait in the suite
- [x] Zero locators outside the page object classes
- [x] `retries: 0`, and two consecutive full runs producing identical results
- [x] Zero critical or serious axe violations on every covered page
- [x] Every failure triaged to genuine defect or bad test, with the reasoning recorded
- [x] HTML report, traces and screenshots published as CI artifacts

Residual failures at exit are the 60 specs recorded in `tests/expected-failures.json`,
which catch the ten seeded defects and `SK-BUG-011`. With the seeding commits reverted,
two specs still fail, each for a documented open defect. CI enforces both records on
every run.

## 7. Risks and mitigations

| Risk                                              | Impact                                           | Mitigation                                                                                                                                                                                                                                                          |
| ------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shared seed data mutated by a parallel spec       | Order-dependent failures; a suite nobody trusts  | Fixture products live in a dedicated category excluded from every whole-catalogue assertion. Specs that mutate shared state create their own data or declare serial mode with a stated reason. **This risk materialised during the build** — see `TRIAGE_NOTES.md`. |
| Rate limiter firing mid-suite                     | Failures unrelated to the requirement under test | Buckets cleared between specs via a token-gated route. The limiter itself is left at production strength and tested at its boundary. **Also materialised, and exposed a real defect in the limiter.**                                                               |
| Asynchronous server actions outrunning assertions | Intermittent failures; the worst kind            | Every mutating page-object method waits for a settled UI state. No arbitrary waits anywhere. **Materialised three times**, each fixed at the page-object layer.                                                                                                     |
| Browser-level validation masking server checks    | Tests that cannot fail                           | Inputs chosen so the browser accepts them, or the assertion moved to the API layer. **Materialised twice.**                                                                                                                                                         |
| A negative test that never submits anything       | False passes indistinguishable from coverage     | Helpers that might not submit return whether they did; the test asserts that first. **Materialised once, costing six false passes.**                                                                                                                                |
| Visual baselines differing by platform            | Noise that trains people to ignore failures      | Chromium only; CI regenerates Linux baselines per run rather than comparing across platforms.                                                                                                                                                                       |
| Clock-dependent promo expiry                      | A spec that fails at midnight                    | The same-day boundary specs create a code with an expiry they control, rather than relying on the seeded one alone.                                                                                                                                                 |

## 8. Deliverables

| Artefact                         | Location                       |
| -------------------------------- | ------------------------------ |
| Test suite                       | `tests/`                       |
| Test plan                        | `docs/TEST_PLAN.md`            |
| Test strategy and reasoning      | `docs/TEST_STRATEGY.md`        |
| Defect reports                   | `docs/DEFECTS.md`              |
| Requirement traceability         | `docs/TRACEABILITY.md`         |
| Triage log                       | `docs/TRIAGE_NOTES.md`         |
| HTML report, traces, screenshots | CI artifacts, retained 14 days |

## 9. Roles

Single-person project: I wrote the application, the specification-derived suite, and
this documentation.

Worth being explicit about the conflict that creates. Writing tests against your own
application invites unconscious bias toward the implementation you happen to remember.
Two things were done to limit it: the pricing expectations were derived from the
specification and independently verified before any test consumed them, and the suite
was written from PRD sections 4 and 5 without consulting the defect list in section 9
until after the first full run. The triage log in `TRIAGE_NOTES.md` records each
failure and its classification as it happened, including the eight cases where the test
was wrong rather than the application.
