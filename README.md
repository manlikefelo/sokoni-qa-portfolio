# Sokoni — e-commerce platform and QA automation suite

A working Next.js storefront, built to be tested. The application is the system under
test; the Playwright suite in `tests/` and the write-ups in `docs/` are the point of
the repository.

> **This application contains ten deliberately seeded defects.** They are documented
> in [`SEEDED_DEFECTS.md`](./SEEDED_DEFECTS.md), each introduced in its own commit, and
> the last defect-free commit is tagged `v1.0-clean`. The defects exist so the test
> suite has something real to catch. Everything outside that list is meant to be
> correct — including the whole security layer, where no defect was seeded.

---

## What this demonstrates

| Area                                                | Where to look                                      |
| --------------------------------------------------- | -------------------------------------------------- |
| Test strategy and the reasoning behind it           | [`docs/TEST_STRATEGY.md`](./docs/TEST_STRATEGY.md) |
| Test plan: scope, entry and exit criteria, risks    | [`docs/TEST_PLAN.md`](./docs/TEST_PLAN.md)         |
| Defect reports with concrete expected/actual values | [`docs/DEFECTS.md`](./docs/DEFECTS.md)             |
| Requirement-to-test traceability                    | [`docs/TRACEABILITY.md`](./docs/TRACEABILITY.md)   |
| Page Object Model, fixtures, data isolation         | `tests/pages/`, `tests/fixtures/`                  |
| Boundary analysis on money and pagination           | `tests/e2e/pricing/`, `tests/e2e/catalogue/`       |
| API-level testing independent of the UI             | `tests/api/`                                       |
| Accessibility automation                            | `tests/a11y/`                                      |

---

## Setup

```bash
npm install
cp .env.example .env          # then set AUTH_SECRET to 32+ random characters
npx prisma migrate dev        # creates the SQLite database and applies migrations
npm run seed                  # deterministic catalogue, users and promo codes
npm run dev                   # http://localhost:3000
```

### Seeded accounts

| Role     | Email                | Password        |
| -------- | -------------------- | --------------- |
| Admin    | `admin@sokoni.co.ke` | `AdminPass2026` |
| Customer | `asha@example.com`   | `Customer2026`  |
| Customer | `brian@example.com`  | `Customer2026`  |

### Test card numbers

The payment gateway is an internal mock at `POST /api/mock-payment`. The outcome is
driven entirely by the card number, so every branch is reachable without a sandbox
account.

| Card number           | Outcome                               |
| --------------------- | ------------------------------------- |
| `4242 4242 4242 4242` | approved                              |
| `4000 0000 0000 0002` | declined — card declined              |
| `4000 0000 0000 0069` | declined — expired card               |
| `4000 0000 0000 9995` | declined — insufficient funds         |
| `4000 0000 0000 0119` | gateway error, after a 3 second delay |
| anything else         | declined — invalid card               |

### Promo codes

| Code        | Effect        | Notes                                               |
| ----------- | ------------- | --------------------------------------------------- |
| `SAVE10`    | 10% off       | no minimum                                          |
| `SAVE25`    | 25% off       | minimum spend KSh 3,000                             |
| `FLAT500`   | KSh 500 off   | minimum spend KSh 2,000                             |
| `EXPIRED20` | 20% off       | expired yesterday — must be rejected                |
| `ENDSTODAY` | 15% off       | expires 23:59:59 UTC today — must still be accepted |
| `ONESHOT`   | KSh 1,000 off | single use                                          |
| `DEAD5`     | 5% off        | inactive — must be rejected                         |

---

## Running the tests

```bash
npx playwright install --with-deps   # once
npm run test                         # the whole suite
npm run test:ui                      # interactive runner
npx playwright test tests/e2e/pricing          # one area
npx playwright test --project=chromium         # one browser
npx playwright show-report                     # the HTML report
```

---

## Architecture

```
┌─────────────────────── Test layer (the deliverable) ───────────────────────┐
│  tests/e2e      journeys through the UI, by data-testid only               │
│  tests/api      gateway contract and route-level authorisation             │
│  tests/a11y     axe-core on six pages, keyboard traversal                  │
│  tests/visual   screenshot baselines, desktop and mobile                   │
│  tests/pages    Page Objects — the only place a locator is written          │
│  tests/fixtures auth storageState, database reset, factories               │
└────────────────────────────────┬───────────────────────────────────────────┘
                                 │ drives
┌────────────────────────────────▼───────────────────────────────────────────┐
│  Application (the system under test)                                       │
│                                                                            │
│  src/app          App Router pages, route handlers, middleware             │
│  src/components   Server and Client Components                             │
│  src/actions      Server Actions — every one authorises and validates      │
│  src/schemas      Zod schemas, shared between client and server            │
│  src/lib          pricing, money, promo, cart, auth, rate limiting         │
│  prisma           schema, migrations, deterministic seed                   │
└────────────────────────────────────────────────────────────────────────────┘
```

### Technology

Next.js 16 (App Router) · React 19 · TypeScript `strict` · Tailwind CSS 4 ·
Prisma 6 with SQLite · Auth.js v5 with argon2id · Zod · Playwright · GitHub Actions

### Conventions worth knowing

- **Money is always an integer count of cents.** No floats touch a monetary value
  anywhere — not in the database, not in the pricing engine, not in transport. All
  display goes through one formatter in `src/lib/money.ts`.
- **The pricing engine is pure.** `src/lib/pricing.ts` has no database access and no
  clock reads. Order of operations is fixed: subtotal, then discount against the
  subtotal only, then shipping assessed on the post-discount subtotal, then total.
- **Totals are always recomputed server-side** at order creation. A client-submitted
  price or total is ignored entirely.
- **Stock moves only after payment is approved**, inside a transaction, with a
  conditional decrement so two shoppers cannot both buy the last unit.
- **Every interactive element carries a `data-testid`.** The suite never selects on a
  CSS class, a text string, or a DOM position.

---

## Security

The security layer is a functional requirement, not a place where defects were
seeded. Implemented and manually verified:

- argon2id password hashing; a login attempt against an unknown email still performs a
  verification so response timing does not reveal which emails are registered
- `HttpOnly`, `SameSite=Lax` session cookies, `Secure` in production
- rate limiting on login, registration and promo application — 10 attempts per 15
  minutes per IP
- authorisation resolved from the session inside every server action and route
  handler; the UI hiding a control is never the boundary
- ownership checks on orders, addresses and carts, written into the query rather than
  applied as an afterthought; another user's order returns 404, not 403
- Zod validation on every action and route input — parsed, never cast
- Prisma only, no raw SQL; no `dangerouslySetInnerHTML` anywhere
- `Content-Security-Policy`, `X-Frame-Options: DENY`, `X-Content-Type-Options`,
  `Referrer-Policy`, `Strict-Transport-Security` set in `next.config.ts`
- environment validated with Zod at startup; the process refuses to boot if a variable
  is missing or malformed
- the mock gateway never logs, persists or echoes a card number

### Known advisory

`npm audit` reports a high-severity advisory in `deepmerge-ts`, reached only through
the Prisma **CLI's** config loader. It is a devDependency that never enters the
application bundle, and the automated fix downgrades Prisma to 6.12. Left as-is
deliberately.

---

## Notes on the data model

`Order.shippingAddress` stores JSON in a `String` column rather than using Prisma's
`Json` type, because SQLite does not support `Json` and the schema has to stay
Postgres-compatible. Switching the provider to Postgres needs no change to any model
body.

`Product.searchText` holds a lowercased copy of the name and description. SQLite's
Prisma connector has no case-insensitive `contains`, so search compares a lowercased
needle against this column. It is maintained on every write.

---

## Out of scope

Real payment processing, email delivery (logged to console), reviews, wishlists,
recommendations, multi-currency, image upload, returns and refunds, deployment.

---

Built by Felix Githure as a QA automation portfolio piece.
