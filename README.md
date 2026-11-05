# Sokoni — e-commerce platform and QA automation suite

[![CI](https://github.com/manlikefelo/sokoni-qa-portfolio/actions/workflows/ci.yml/badge.svg)](https://github.com/manlikefelo/sokoni-qa-portfolio/actions/workflows/ci.yml)

A working Next.js storefront, built to be tested. The application is the system under
test; the Playwright suite in `tests/` and the write-ups in `docs/` are the point of the
repository.

> **This application contains ten deliberately seeded defects.** Every one is documented
> in [`SEEDED_DEFECTS.md`](./SEEDED_DEFECTS.md), each introduced in its own commit, and
> the last defect-free commit is tagged `v1.0-clean`. They exist so the suite has real
> failures to find. Everything outside that list is meant to be correct — including the
> whole security layer, where nothing was seeded.

---

## The short version

I wrote a specification-complete e-commerce application, seeded ten defects into it, then
wrote a Playwright suite from the specification without looking at the defect list. The
suite found all ten. It also found **two defects I had not planted**, which stay open and
documented, and **six genuine bugs in my own application** that I fixed rather than
leaving in.

More usefully, it found **sixteen defects in my own tests** — including one case where
six tests were passing while submitting nothing at all. Those are written up in
[`docs/TRIAGE_NOTES.md`](./docs/TRIAGE_NOTES.md) with the reasoning, because knowing the
difference between a broken application and a broken test is most of the job.

|                              |                                                                   |
| ---------------------------- | ----------------------------------------------------------------- |
| Application                  | 24 routes, Next.js 16 App Router, TypeScript `strict`, zero `any` |
| Suite                        | 274 specs across E2E, API, accessibility and visual layers        |
| Seeded defects               | 10, all caught by named tests written from the spec               |
| Unplanned defects found      | 2 still open, 6 found and fixed during the build                  |
| Test defects found and fixed | 16, each documented with the root cause                           |
| Retries                      | 0, locally and in CI                                              |

---

## Start here

| If you want to see…                        | Read                                               |
| ------------------------------------------ | -------------------------------------------------- |
| How I think about testing this application | [`docs/TEST_STRATEGY.md`](./docs/TEST_STRATEGY.md) |
| Scope, entry and exit criteria, risks      | [`docs/TEST_PLAN.md`](./docs/TEST_PLAN.md)         |
| Defect reports with concrete values        | [`docs/DEFECTS.md`](./docs/DEFECTS.md)             |
| Requirement-to-test coverage               | [`docs/TRACEABILITY.md`](./docs/TRACEABILITY.md)   |
| Every failure I triaged, and how           | [`docs/TRIAGE_NOTES.md`](./docs/TRIAGE_NOTES.md)   |
| What was seeded and why it is subtle       | [`SEEDED_DEFECTS.md`](./SEEDED_DEFECTS.md)         |

If you only read one, read `TRIAGE_NOTES.md`. The other documents describe a finished
suite; that one shows the working.

---

## What this demonstrates

**Boundary analysis where it matters.** Eight of the ten seeded defects are boundary
errors, so the suite is weighted accordingly. The free-shipping threshold is tested at
exactly KSh 5,000 and a cent either side, and again where the discount drags the
post-discount subtotal across it. The 25 pricing cases were derived by hand from the
specification and checked against an independent reimplementation of the rules _before_
any test consumed them — a baseline recorded from the application would have agreed with
the application's own mistakes.

**Assertions on values, not presence.** `expect(total).toHaveText('KSh 4,150.00')`, never
`toBeVisible()`. Half the seeded defects render a perfect page showing the wrong number.

**Knowing when a test cannot prove what it claims.** Two cases came up where a
browser-level guard fired before the server check the test was aiming at, so the test
could not fail. Both moved to the API layer. One case had a helper submitting a form
bound to nothing — six green tests exercising nothing. That helper now reports whether it
actually submitted, and the test asserts that first.

**Flakiness treated as a defect.** Running the suite with `--repeat-each=2` turned 11
green tests red. All 11 were my fault. Two fixes were tried and rejected for narrowing
the race rather than removing it, before the right one.

**Layers chosen for a reason.** `docs/TEST_STRATEGY.md` argues why the weight sits at the
end-to-end layer for an application whose logic is server-side arithmetic, rather than
reciting the pyramid.

---

## Setup

```bash
npm install
cp .env.example .env          # then set AUTH_SECRET to 32+ random characters
npx prisma migrate dev        # creates the SQLite database and applies migrations
npm run seed                  # deterministic catalogue, users and promo codes
npm run dev                   # http://localhost:3000
```

### Running the tests

```bash
npx playwright install --with-deps   # once
npm run test                         # the parallel suite
npm run test:serial                  # the specs that need the app to themselves
npm run test:ui                      # interactive runner
npx playwright show-report           # the HTML report
```

Expect **60 failures on `main`**: the tests that catch the seeded defects, plus those that
catch `SK-BUG-011`. To compare, revert the ten seeding commits in your working tree:

```bash
git revert --no-commit beab256^..1916851 && npm run test
git revert --abort                           # put the seeded defects back
```

Two tests still fail, each for a documented open defect: `SK-CAT-060` (`SK-BUG-011`) and
`SK-CAT-008` (`SK-BUG-018`).

### What the CI badge means

A plain pass or fail can't describe a branch that fails on purpose, so CI compares each run
with [`tests/expected-failures.json`](./tests/expected-failures.json), on all four browsers
and on the reverted baseline. The badge is green when **exactly** the recorded tests fail.
A new failure turns it red, and so does a recorded failure that starts passing.

The browser matrix runs over local HTTPS, because a production build mints `Secure`
cookies and WebKit on Linux doesn't keep them over plain `http://localhost`.

### Seeded accounts

| Role     | Email                | Password        |
| -------- | -------------------- | --------------- |
| Admin    | `admin@sokoni.co.ke` | `AdminPass2026` |
| Customer | `asha@example.com`   | `Customer2026`  |
| Customer | `brian@example.com`  | `Customer2026`  |

### Test cards

The gateway is an internal mock at `POST /api/mock-payment`. The outcome is a pure
function of the card number, so every branch is reachable without a sandbox account.

| Card number           | Outcome                               |
| --------------------- | ------------------------------------- |
| `4242 4242 4242 4242` | approved                              |
| `4000 0000 0000 0002` | declined — card declined              |
| `4000 0000 0000 0069` | declined — expired card               |
| `4000 0000 0000 9995` | declined — insufficient funds         |
| `4000 0000 0000 0119` | gateway error, after a 3 second delay |
| anything else         | declined — invalid card               |

### Promo codes

| Code        | Effect        | Notes                                                   |
| ----------- | ------------- | ------------------------------------------------------- |
| `SAVE10`    | 10% off       | no minimum                                              |
| `SAVE25`    | 25% off       | minimum spend KSh 3,000                                 |
| `FLAT500`   | KSh 500 off   | minimum spend KSh 2,000                                 |
| `EXPIRED20` | 20% off       | expired yesterday — must be rejected                    |
| `ENDSTODAY` | 15% off       | expires 23:59:59 UTC today — **must still be accepted** |
| `ONESHOT`   | KSh 1,000 off | single use                                              |
| `DEAD5`     | 5% off        | inactive — must be rejected                             |

---

## Architecture

```
┌─────────────────────── Test layer (the deliverable) ───────────────────────┐
│  tests/e2e       214 specs — journeys, by data-testid only                 │
│  tests/api        34 specs — gateway contract, route-level authorisation   │
│  tests/a11y       14 specs — axe-core, keyboard traversal, focus           │
│  tests/visual     10 baselines — desktop and mobile                        │
│  tests/pages       8 page objects — the only place a locator is written    │
│  tests/fixtures      auth storageState, database helpers, worker scoping   │
└────────────────────────────────┬───────────────────────────────────────────┘
                                 │ drives a production build
┌────────────────────────────────▼───────────────────────────────────────────┐
│  Application (the system under test)                                       │
│                                                                            │
│  src/app          App Router pages, route handlers, proxy                  │
│  src/components   Server and Client Components                             │
│  src/actions      Server Actions — every one authorises and validates      │
│  src/schemas      Zod schemas, shared between client and server            │
│  src/lib          pricing, money, promo, cart, auth, rate limiting         │
│  prisma           schema, migrations, deterministic seed                   │
└────────────────────────────────────────────────────────────────────────────┘
```

Next.js 16 (App Router) · React 19 · TypeScript `strict` · Tailwind CSS 4 ·
Prisma 6 with SQLite · Auth.js v5 with argon2id · Zod · Playwright · GitHub Actions

### Conventions worth knowing

- **Money is always an integer count of cents.** No floats touch a monetary value
  anywhere. All display goes through one formatter in `src/lib/money.ts`.
- **The pricing engine is pure.** `src/lib/pricing.ts` has no database access and no
  clock reads. Order of operations is fixed: subtotal, discount against the subtotal
  only, shipping assessed on the post-discount subtotal, total.
- **Totals are recomputed server-side** at order creation. A client-submitted price or
  total is ignored entirely.
- **The suite runs against a production build.** Next.js streams dynamic routes
  differently in development, and several assertions are about HTTP status codes — a 404
  asserted against `next dev` can pass while the same route returns 200 in production.
  That is how two of the four unplanned application defects were found.
- **Every interactive element carries a `data-testid`**, and no spec file contains a
  locator. Checkable with `grep -r getByTestId tests/e2e` — it returns nothing.

---

## Security

The security layer is a functional requirement, not a place where defects were seeded.
Every item below is asserted by a test, listed in `docs/TRACEABILITY.md`:

- argon2id password hashing; an unknown email still performs a verification so response
  timing does not reveal which addresses are registered
- `HttpOnly`, `SameSite=Lax` session cookies, `Secure` in production
- rate limiting on login, registration and promo application — 10 per 15 minutes per IP
- authorisation resolved from the session inside every server action and route handler;
  the UI hiding a control is never the boundary, and `tests/api/authorization.spec.ts`
  asks the routes directly as every role
- ownership checks written into the query rather than applied afterwards; another user's
  order returns 404, not 403
- Zod validation on every action and route input — parsed, never cast
- Prisma only, no raw SQL; no `dangerouslySetInnerHTML` anywhere
- CSP, `X-Frame-Options: DENY`, `X-Content-Type-Options`, `Referrer-Policy` and HSTS
- environment validated with Zod at startup; the process refuses to boot if a variable
  is missing or malformed
- the mock gateway never logs, persists or echoes a card number

### The one piece of test-only code

`/api/test-support/reset-rate-limit` clears rate-limit buckets. It answers 404 unless
`TEST_SUPPORT_TOKEN` is set and matches, and no real deployment sets it. The reasoning —
and why weakening the limiter instead would have been worse — is in
`docs/TEST_STRATEGY.md`.

### Known advisory

`npm audit` reports a high-severity advisory in `deepmerge-ts`, reached only through the
Prisma **CLI's** config loader. It is a devDependency that never enters the application
bundle, and the automated fix downgrades Prisma to 6.12. Left as-is deliberately.

---

## Notes on the data model

`Order.shippingAddress` stores JSON in a `String` column rather than using Prisma's
`Json` type, because SQLite does not support `Json` and the schema has to stay
Postgres-compatible. Switching provider needs no change to any model body.

`Product.searchText` holds a lowercased copy of the name and description. It is
maintained on every write but — as a consequence of one of the seeded defects — no longer
read by search. See `SEEDED_DEFECTS.md` BUG-09.

---

## Out of scope

Real payment processing, email delivery (logged to console), reviews, wishlists,
recommendations, multi-currency, image upload, returns and refunds, deployment. Load
testing and penetration testing are out of scope with reasons given in
`docs/TEST_PLAN.md`.

---

Built by Felix Githure as a QA automation portfolio piece.
