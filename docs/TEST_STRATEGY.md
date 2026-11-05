# Test strategy

Why this suite is shaped the way it is. The test plan says what gets tested; this says
why, and what was deliberately left out.

---

## What this application actually is

Sokoni is a storefront whose interesting behaviour is almost entirely server-side
arithmetic and state transitions. Money, stock, promo validity, order lifecycle. There
is very little client-side logic worth testing in isolation, and a great deal of
behaviour that only exists once a request has crossed into the database and come back.

That shapes everything below. A conventional pyramid (thousands of unit tests, a
handful of integration tests, a few end-to-end smoke tests) would be the wrong answer
here, because the units are mostly trivial and the bugs live in the seams.

## The shape of the suite, and why it is not a pyramid

```
         ┌───────────────────────────────┐
         │  visual        10 baselines   │  layout regressions only
         ├───────────────────────────────┤
         │  a11y          14 specs       │  axe + keyboard traversal
         ├───────────────────────────────┤
         │  API           34 specs       │  contract + authorisation
         ├───────────────────────────────┤
         │  E2E          214 specs       │  the bulk of the value
         └───────────────────────────────┘
```

Most of the weight sits at the end-to-end layer. That is a deliberate choice, not an
absence of discipline, and it rests on three things about this application:

**The pricing engine is already pure.** `lib/pricing.ts` takes line items and a promo
and returns a breakdown. No database, no clock, no request context. I could have
written a hundred unit tests against it, and they would have passed against a pricing
engine that was never wired into the cart. What matters to a shopper is the figure on
the cart page, so the pricing cases drive the real cart and read the rendered total.
The arithmetic is checked where it is _used_, not where it is defined.

**The defects that matter are integration defects.** A discount computed against the
wrong base, stock decremented in the wrong order, a cart replaced instead of merged:
every one of these lives at a boundary between two correct-looking pieces. No unit test
of either piece would find them.

**The UI is thin.** Server Components render data and Server Actions mutate it. There is
almost no client state to test in isolation; the components are nearly all pass-through.

### Where the API layer earns its place

Two kinds of thing are genuinely unreachable from the browser, and both came up during
the build rather than being anticipated:

- **Behaviour behind a correct client-side guard.** The quantity input carries
  `max="4"`, so the browser refuses to submit a larger value and the server's own stock
  check never runs. A UI test cannot prove that check exists. It is asserted at the API
  layer instead.
- **Authorisation, as distinct from hidden controls.** The navigation does not render an
  admin link for a customer. A UI test that finds no link has learnt nothing about
  whether the server would refuse the request. `tests/api/authorization.spec.ts` asks
  the routes directly, as every role.

Both cases are written up in `TRIAGE_NOTES.md` with the failing test that exposed them.

## Why boundary analysis is weighted toward money and pagination

Eight of the ten seeded defects are boundary errors, and that proportion is not
accidental. It reflects where this kind of application actually breaks.

**Money.** Every monetary value is an integer count of cents, and there are exactly
three places a boundary can hide: the free-shipping threshold, the rounding of a
percentage, and the minimum-spend gate. So:

- the threshold is tested at exactly KSh 5,000, one cent below, and one cent above
- and again where the _discount_ drags the post-discount subtotal across it, because
  shipping is assessed after the discount
- minimum spend is tested at exactly the threshold and one cent under
- rounding is tested with quantity and price combinations that land on a half cent,
  deliberately chosen so the free-shipping rule is _not_ also in play, otherwise one
  defect masks the other, which is exactly what happened on the first attempt at the
  BUG-08 case

The 25 pricing cases in `tests/data/pricing-cases.json` were derived by hand from the
specification and then checked against an independent reimplementation of PRD 4.5
before any test consumed them. A baseline captured from the running application would
have agreed with the application's own mistakes, which is the whole problem with
recorded expectations.

**Pagination.** 25 products at 12 per page is three pages where the last holds one
item. The PRD chose those numbers precisely because they divide badly. The central
assertion walks every page, collects every slug, and checks the union is exactly 25
distinct products. "Page 2 shows 12 products" would pass against several broken
implementations; the walk does not.

## Why `retries: 0`

Retries are off locally and in CI, and this is the decision I would most expect to be
asked about.

A test that passes on the second attempt has told you something is wrong and you have
chosen not to listen. The failure is either in the application, in which case retrying
hides a real intermittent bug, or in the suite, in which case retrying hides a race in
the test. Neither is something I want averaged away.

This is not theoretical here. Three of the test defects found during the build would
have been silently absorbed by a single retry:

- `SK-PROMO-011` changed a cart quantity and navigated before the server action had
  landed. Intermittent by nature, and a retry would have made it green.
- `SK-CHK-001` skipped filling the guest email because `isVisible()` returned false
  during hydration. Also timing-dependent.
- `SK-VIS-001` failed only in a full parallel run, because another spec's fixture
  product was in the catalogue at the time.

Every one was a genuine defect in the suite, and each is now fixed at the page-object
layer where it belongs. Retries would have bought a green report and left three races
in place.

The cost of this policy is real: a genuinely flaky environment makes the whole suite
look broken. I accept that, because the alternative is a suite nobody can reason about.

## Test data isolation

Two approaches, chosen per case rather than applied uniformly.

**Read the shared seed** where the assertion is _about_ the seeded dataset. Pagination
arithmetic, sort ordering and filter boundaries all depend on having exactly 25 products
with known prices, and creating a parallel dataset to assert the same thing would be
both slower and less faithful to what the PRD specifies.

**Create scoped fixtures** where the spec mutates anything. Every spec that consumes
stock, completes an order or needs a specific price creates its own product under a
prefix carrying the worker index, and removes it in a `finally` block.

### The mistake that taught me to separate them properly

The first version of this let fixture products land in the ordinary categories. That
broke the first rule from the second direction: a pricing spec creating a product in
"Fashion" changed the catalogue size underneath a pagination assertion running in
another worker at the same moment.

The symptom was nasty. `SK-VIS-001` and `SK-CAT-023` passed in isolation and failed in
a full run, order-dependent failure, the thing the suite is explicitly required not to
have. The diagnosis was only possible because the full run and the isolated run
disagreed; a retry would have made the whole thing look fine.

Fixture products now live in a dedicated `qa-fixtures` category, and every
whole-catalogue assertion excludes it. The shared dataset is genuinely immutable from
the test suite's point of view, and the scoped data genuinely cannot touch it.

### Why not reset the database between files

Tempting, and I chose against it. A reset between spec files would serialise the suite
around the reset, turning a two-minute parallel run into something much longer, and it
would hide exactly the class of bug that concurrent access produces: two shoppers
racing for the last unit of stock is a real scenario with a real test
(`SK-CHK-021`), and it cannot exist in a suite where only one thing happens at a time.

Where a spec genuinely needs exclusive access to shared state: the cart-merge specs all
operate on one account, the stock-ceiling specs all set the stock of one variant. It
declares `mode: 'serial'` and says why in a comment. That is a local admission
of a constraint rather than a global policy that removes the constraint by removing the
parallelism.

## The rate limiter, and the one piece of test-only code

Login, registration and promo application are limited to ten attempts per fifteen
minutes per IP. Every spec in a run shares one IP, so a suite that applies promo codes
dozens of times trips the limiter and starts failing for reasons unrelated to what it
is testing.

The wrong fix is to weaken the limiter, because then a PRD 7 security requirement is no
longer tested. What the suite does instead is clear the buckets between specs through
`/api/test-support/reset-rate-limit`, which answers 404 unless `TEST_SUPPORT_TOKEN` is
set and matches. No real deployment sets it.

This is the only test-only code path in the application and I would defend it as the
lesser evil. The limiter is tested at its boundary by `SK-ACC-030`, which deliberately
exhausts it.

It also surfaced a real defect. Working out why the limiter was firing showed that
`applyPromoAction` counted _successful_ applications, while `loginAction` already
cleared its bucket on success. A shopper who legitimately used a valid code on ten
separate orders was refused the eleventh. That is a customer-facing bug that nothing in
the PRD's test list would have caught, found by investigating test infrastructure
rather than by testing a requirement.

## Locators, and why none appear in a spec

Every locator lives in a page object under `tests/pages/`. No spec file contains a
`getByTestId` call, that is enforced by review and is easy to check with a grep.

The reason is not tidiness. It is that the page object is the only place a _waiting
strategy_ can live consistently. When `setQuantity` needed to stop returning before the
server action landed, the fix went in one method and every call site was correct
immediately. Had those locators been spread across specs, the same race would have
needed fixing a dozen times and would have been reintroduced by the next person.

Locators are `data-testid` only. No CSS class chains, no positional XPath, no text
selectors. A copy change should never fail a functional test, and a restyle should
never fail anything.

## What is deliberately not automated

**Cross-browser visual baselines.** Screenshots are Chromium-only. Font rasterisation
differs between engines and between operating systems, so per-browser baselines produce
failures that mean nothing, and a suite that cries wolf gets ignored. The functional
specs run across Chromium, Firefox, WebKit and Mobile Chrome; only the pixel comparison
is narrowed. CI generates its own Linux baselines per run rather than pretending the
committed Windows set is portable.

**Moderate and minor accessibility findings.** axe-core runs with all four WCAG tag
sets, but only critical and serious violations fail the build. The lower tiers are
frequently contextual, and failing on them makes the gate noisy enough that people stop
reading it. They are printed on every run, so they are visible rather than silently
dropped.

**Load and performance.** Out of scope per the brief, and genuinely out of scope for
this application: a SQLite-backed demonstration storefront tells you nothing useful
about production throughput.

**Email delivery.** The application logs instead of sending, so there is nothing to
assert beyond the log line.

**Penetration testing.** The security specs assert that the PRD 7 controls hold,
headers present, cookies flagged, ownership enforced, failure messages identical. They
do not attempt to defeat those controls, which is a different discipline needing
different tools and explicit authorisation.

**Unit tests of trivial code.** `formatMoney` has no dedicated unit test because every
monetary assertion in the suite goes through it; a bug in the formatter fails dozens of
specs with clear messages. Adding a unit test for it would add maintenance without
adding information.

## Assertions carry values, not presence

`expect(total).toHaveText('KSh 4,150.00')`, never `expect(total).toBeVisible()`.

Half the seeded defects produce a page that renders perfectly and shows the wrong
number. A presence assertion passes against all of them. Every monetary assertion in
this suite names the exact figure to the cent, and where a figure is derived the comment
above it shows the arithmetic.

The same applies to negative assertions, with an extra requirement: proof that the
thing being refused was actually attempted. The first version of the illegal-transition
tests submitted a form that was bound to nothing, found the order unchanged, and
reported six passes while testing nothing at all. `forceStatus` now returns whether it
genuinely submitted, and the test asserts that before asserting anything else. "Nothing
changed" is not evidence when nothing was sent.
