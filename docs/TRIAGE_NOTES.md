# Triage notes

Working record kept while running each newly written spec for the first time. Every
failure is classified as a genuine application defect or a bad test before anything is
changed. Kept in the repository because the reasoning is the interesting part, and
because a bad test found this way is worth as much as a bug.

## Catalogue specs — first run

22 of 46 failed. Triage:

| Failure                                     | Verdict            | Cause                                                                                                                                                                                                                                                |
| ------------------------------------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SK-CAT-001/002/003, 004 (×3), 005, 009, 010 | defect             | The result count reads "1 of 1" but no card renders. Pagination skips the only match. Traced to the `skip` arithmetic, not to search.                                                                                                                |
| SK-CAT-030                                  | defect             | Same pagination cause — a single-result filtered view renders nothing.                                                                                                                                                                               |
| SK-CAT-025/026/027                          | defect             | Maximum price bound is exclusive; a product at exactly the ceiling is missing.                                                                                                                                                                       |
| SK-CAT-041/043/045/048                      | defect             | Page walk surfaces 13 distinct products, not 25. Pagination arithmetic.                                                                                                                                                                              |
| SK-CAT-061/064/066                          | defect (unplanned) | Price sort uses `basePriceCents`; the card displays the lowest variant price. The two disagree for `tefal-non-stick-frying-pan`. Logged as SK-BUG-011.                                                                                               |
| SK-CAT-062                                  | **bad test**       | My oracle used `localeCompare`, which ignores case. The database orders by byte value, so `TP-Link` precedes `Tefal`. The application is self-consistent; the assertion was wrong. Fixed to compare against the same collation the application uses. |
| SK-CAT-063                                  | defect             | "Newest" shows the wrong product first — pagination again, page 1 is not the first page.                                                                                                                                                             |

Note how many distinct-looking failures share one root cause. Eight search failures,
four pagination failures and a sort failure all trace back to the same `skip`
expression. Counting failures would overstate the number of problems by a wide margin.

## Cart specs — first run

| Failure     | Verdict      | Cause                                                                                                                                                         |
| ----------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SK-CART-040 | defect       | The user's previously saved item is gone after login. The guest cart replaced the user cart rather than merging into it. Exactly the case PRD 4.3 spells out. |
| SK-CART-021 | **bad test** | See below.                                                                                                                                                    |

### SK-CART-021 — a test that could not reach the thing it was testing

The test set stock to 4, typed 5 into the quantity field, clicked add, and waited for
either a success or an error banner. Neither ever appeared.

The cause is not the application. The quantity input carries `max="4"`, so the
browser's own constraint validation refuses to submit the form and reports "Value must
be less than or equal to 4." The server action is never called, so it has no chance to
return the error the test was waiting for.

That is correct behaviour — two independent layers, the input bound and the server
check, and the outer one caught it first. But it means the server-side rule is
**unreachable through the UI on this path**, and a UI test cannot prove it holds.
Asserting on the browser's refusal instead would be testing the browser, not Sokoni.

Resolved two ways:

- SK-CART-021 now asserts what is actually observable at this layer: the form does not
  submit, and nothing is added to the cart.
- The server-side rule it was trying to reach is asserted in `tests/api/`, which posts
  the over-limit quantity directly to the action and has no browser in the way.

This is the argument for having an API layer in the suite at all. A defect sitting
behind a correct client-side guard is invisible to every UI test, and would stay
invisible until someone removed the guard.

## Pricing specs — first run

All 25 data-driven cases plus the scope and rounding specs. 12 failed, and every
failure carries an exact expected-versus-actual pair:

| Failure                                                            | Verdict | Evidence                                                                                                                          |
| ------------------------------------------------------------------ | ------- | --------------------------------------------------------------------------------------------------------------------------------- |
| SK-PRICE-100 and the percentage cases below the shipping threshold | defect  | Expected `-KSh 200.00`, received `-KSh 235.00`. The discount is 10% of subtotal plus shipping rather than of the subtotal.        |
| SK-PRICE-102 and the rounding cases                                | defect  | Expected `-KSh 555.58`, received `-KSh 555.60`. Two cents, from rounding each line's share instead of rounding the subtotal once. |

### Two infrastructure problems found on the way, both real

**The rate limiter was counting successful promo applications.** The suite applies
codes dozens of times from one IP and started getting "Too many attempts" — correct
behaviour from the limiter, at first glance.

Reading the code, though, `applyPromoAction` counted every attempt including the
successful ones, while `loginAction` already cleared its bucket on success. The
limiter exists to stop someone grinding through candidate codes; a shopper who
successfully applies a valid code on ten separate orders is not doing that, and under
the old behaviour was locked out of the eleventh. Fixed in the application, not worked
around in the test — `resetRateLimit` on success, matching the login path.

This is the more valuable of the two findings. The test run surfaced it, but it is a
defect a real customer would hit, and nothing in the PRD's own test list would have
caught it.

**Test-support route needed for the rest.** Even with that fixed, specs that
deliberately exercise _rejected_ codes still accumulate against the limit. Weakening
the limiter would mean no longer testing a security requirement, so the suite clears
the buckets between specs through `/api/test-support/reset-rate-limit`, gated on a
`TEST_SUPPORT_TOKEN` that is absent in any real deployment — where the route answers
404 and does not advertise itself.

The first version of that route also checked `NODE_ENV !== 'production'` and therefore
404'd during the run, because the suite deliberately tests against a production build.
The environment variable is the honest control; NODE_ENV was the wrong gate.

## Promo specs — first run

8 of 16 failed.

| Failure                     | Verdict      | Evidence                                                                                                                                                     |
| --------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| SK-PROMO-001, 002 (×3), 008 | defect       | Discount comes out `-KSh 335.00` where `-KSh 300.00` is correct — the same subtotal-plus-shipping error the pricing specs found.                             |
| SK-PROMO-005                | defect       | `ENDSTODAY`, which expires at 23:59:59 UTC today, is rejected outright.                                                                                      |
| SK-PROMO-030                | defect       | A code created by the test to expire sixty seconds from now is also rejected, confirming the comparison truncates to a date rather than using the timestamp. |
| SK-PROMO-011                | **bad test** | See below.                                                                                                                                                   |

### SK-PROMO-011 — a race of my own making

The test applied a code, reduced the cart quantity so the order fell below the code's
minimum spend, then navigated and asserted the code had been dropped. It failed, and
the page snapshot showed the quantity still at 2 — the reduction had not happened yet.

The quantity commit fires on blur and the server action behind it is asynchronous.
`setQuantity` returned as soon as the field lost focus, so the following navigation
outran the update and loaded a cart that had not changed.

This is the exact failure mode the suite's reliability rules exist to prevent, and it
would have been intermittent rather than consistent — the worst kind. The fix is in the
page object, not the test: `setQuantity` now waits for the line total to move, or for a
rejection message to appear, before returning. No call site needed changing and no
sleep was added anywhere.

Worth noting the shape of it. The assertion was right, the application was right, and
the test was still wrong. A retry would have "fixed" this and hidden a real race in the
suite — which is the argument for `retries: 0`.

## Checkout specs — first run

10 of 16 failed.

| Failure                     | Verdict      | Evidence                                                                                                                                             |
| --------------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| SK-CHK-010 to 014, 016, 017 | defect       | Stock recorded at 6, declined payment attempted, stock read back as 4. A declined payment consumes inventory. The most serious finding in the suite. |
| SK-CHK-001, 005             | **bad test** | Email never filled — see below.                                                                                                                      |
| SK-CHK-003                  | **bad test** | Tested through a guard that fires first — see below.                                                                                                 |

### SK-CHK-001 and 005 — a conditional on a non-waiting check

`fillAddress` filled the guest email field only `if (await emailInput.isVisible())`.
`isVisible()` resolves immediately rather than waiting, so while the client component
was still hydrating it returned false, the email fill was skipped silently, and the
form then failed server-side validation for a missing email. The symptom — "review step
never appeared" — pointed nowhere near the cause.

Two fixes in the page object. `fillAddress` now waits for a field common to every
variant of the form before branching, and uses `count()` rather than `isVisible()` to
decide whether an optional field exists at all. `submitAddress` now waits for the
review step or a validation message instead of returning on the click.

The general lesson: `isVisible()` inside an `if` is a race wearing a disguise. It reads
like a wait and is not one.

### SK-CHK-003 — the native-validation trap, again

The test supplied `not-an-email@` to a `type="email"` input. The browser refused to
submit, so the server-side Zod validation never ran and no field error appeared —
exactly the shape of the SK-CART-021 problem, in a different place.

Rewritten to use a phone number that is syntactically fine to the browser (`type="tel"`
has no format constraint) but is not a Kenyan number, so only the server can reject it.
The email is now left valid on purpose. That makes the test genuinely about server-side
validation, which is what it claimed to be about.

Having hit this twice, it is worth stating as a rule: if a browser-level constraint can
reject the input first, a UI test cannot prove the server also rejects it. Pick input
the browser accepts, or move the test to the API layer.

## Account specs — first run

17 of 32 passed first time; the rest exposed one infrastructure mistake of mine and
nothing wrong with the application.

| Failure                            | Verdict      | Cause                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ---------------------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SK-ACC-066 and everything after it | **bad test** | The address-book reset helper removed every address _except_ the seeded one, assuming it was still present. SK-ACC-065 deliberately deletes the default to prove another is promoted, so after that spec ran the account had no addresses at all and every later spec failed for an unrelated reason. Now the helper deletes everything and recreates the seeded address, which is idempotent regardless of what ran before. |

Everything else passed, including the two assertions worth calling out: registration
stores an argon2id hash and never the plaintext, and the wrong-password and
unknown-email messages are byte-identical.

## Admin specs — first run

| Failure                                      | Verdict                        | Evidence                                                                                                                                      |
| -------------------------------------------- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 18 illegal transitions, SK-ADM-100 to 205    | defect                         | Every transition the lifecycle forbids is accepted. `PENDING` to `SHIPPED` stored as `SHIPPED`; `DELIVERED` to `PENDING` stored as `PENDING`. |
| 7 legal transitions to a terminal status     | **bad test**                   | See below.                                                                                                                                    |
| DELIVERED and CANCELLED cases, first attempt | **bad test, and a false pass** | See below.                                                                                                                                    |

### A test that could not fail

The first version of `forceStatus` handled terminal statuses by building a fresh
`<form>` in the page and submitting it. That form was never bound to a server action,
so it posted nowhere — and the test then read the order back, found it unchanged, and
reported a pass.

Six tests were green while testing nothing at all. That is worse than a failing test
and worse than no test, because it is indistinguishable from real coverage on a report.
It surfaced only because its neighbours were failing and the contrast looked wrong: the
seeded defect accepts every illegal transition, so `DELIVERED → PENDING` passing while
`PENDING → SHIPPED` failed made no sense.

Rewritten so `forceStatus` returns whether it actually submitted, and the test asserts
on that before asserting anything else. Terminal statuses are now handled by borrowing
the form from a non-terminal order and retargeting its hidden order id, so a real,
action-bound request reaches the server naming a terminal order.

The general lesson: a negative assertion needs proof that the thing being refused was
genuinely attempted. "Nothing changed" is not evidence when nothing was sent.

### Legal transitions into a terminal status

These waited for the success banner, which is unmounted along with the status form when
the page re-renders showing "no further changes are possible". The transition had
succeeded; the witness had disappeared. Now asserted against the persisted status, with
the banner check replaced by a check that no _error_ is shown.

## Reliability pass — `--repeat-each=2`

The suite was green across every area before this, so running each test twice was
expected to be a formality. It was not: 11 tests failed that had passed consistently in
a single run. All 11 were the suite's fault, not the application's.

### The rate limiter under parallelism

Every failure traced to one cause. Login, registration and promo application allow ten
attempts per fifteen minutes **per IP**, and every worker in the suite presents the same
address. Doubling the test count doubled the attempts, and the specs started refusing
each other.

Three attempts at fixing it, and the first two were wrong in instructive ways.

**Attempt one — reset in `beforeEach`.** Worked in a single run and failed under repeat.
A parallel worker can consume the whole allowance between one test's reset and its
submission. The window is small, which is exactly what makes it a bad fix: it converts a
consistent failure into an intermittent one.

**Attempt two — reset immediately before the action, inside the page object.** Narrower
window, same race. Still failing. At this point the pattern was clear: no amount of
resetting fixes contention over a shared counter, it only makes the collision rarer.
That is the shape of a fix that will come back as flakiness later.

**Attempt three — give each worker its own bucket.** The application already keys the
limiter on `x-forwarded-for`, which it reads as untrusted input used only as a bucket
key. A worker-scoped fixture now sets that header to `10.0.0.{workerIndex}`, so each
worker has its own allowance and there is no contention to race over. No application
change, no resets in the page objects, and the limiter stays at production strength.

`SK-ACC-030`, which deliberately exhausts the limiter, still needs a single shared
bucket and must not run beside anything that signs in. It is tagged `@serial-global`,
excluded from the parallel run, and executed as its own CI step afterwards.

### A bad assertion the repeat run exposed

`SK-ACC-023` asserts that a wrong password and an unknown email produce identical
messages. Under repeat it failed comparing:

```
Expected: "Too many attempts. Try again in 734 seconds."
Received: "Too many attempts. Try again in 733 seconds."
```

Both messages were correct. The test was comparing two rate-limit notices rather than
two credential failures, and those carry a live countdown. The assertion now checks it is
looking at a credential failure before comparing, so it cannot silently pass or fail on
the wrong pair of strings.

### A filter that silently ran nothing

Tagging the rate-limit spec and excluding it with `grepInvert` in the config broke the
command that was supposed to run it: a `grepInvert` in the config takes precedence over
`--grep` on the command line, so `--grep @serial-global` matched nothing and Playwright
reported "No tests found".

That is the `forceStatus` problem again in a different guise — a command that appears to
run a test and runs none. Both filters are now driven by a `SERIAL_ONLY` environment
variable so the two modes are mutually exclusive by construction, and the script was run
to confirm it selects exactly one test rather than zero.

## Cross-browser CI — a collision that looked like a browser problem

The suite ran green locally and red in CI, and it was red in a way that pointed at the
browsers. WebKit failed 163 specs against Chromium's 122; whole files went down at once
— all of `admin-products`, most of `cart-operations`, all of `account-area`. The shared
symptom was a cart that stayed empty after an add, and `sokoni.guest` coming back
`undefined` from `context.cookies()`. That reads unmistakably like a cookie policy
difference between engines.

Three things had to be separated before any of it made sense, because two of them were
environment faults that had nothing to do with the application or the suite.

### Two faults in the CI environment, not in the code

`TEST_SUPPORT_TOKEN` was never set in the workflow. The rate-limit reset route is gated
behind it, so the route answered 404, `resetRateLimits` threw in `beforeEach`, and
roughly 77 account and auth specs per job died before asserting anything.

The visual specs were running inside the browser matrix, comparing Linux screenshots
against the committed Windows baselines. They already had their own job. They cannot
pass in the matrix and never could.

Neither is a defect in anything the suite is meant to test, and together they accounted
for most of the noise. With both fixed, Chromium failed **exactly the 62 specs that
catch the ten seeded defects** — the number the test plan predicts. That is the
measurement everything else had been hiding.

### The engine theory, and why it was wrong

The remaining suspicion was `secure: isProduction` in `src/lib/cart.ts`. CI builds with
`NODE_ENV=production`, so the guest cookie is minted `Secure`, and the suite drives the
app over plain `http://localhost:3000`. Chromium and Firefox treat localhost as a
trustworthy origin; if WebKit did not, every cookie would be dropped and precisely these
files would fail.

It was a clean theory and it was wrong. A direct probe — one local HTTP server issuing a
`Secure` cookie, read back through all three engines — showed Chromium, Firefox **and**
WebKit all storing it. Running `SK-API-031` alone under WebKit passed as well.

The theory was cheap to test and would have been expensive to assume. Had it gone in as
a fix, `secure` would have been weakened in the application to satisfy a test
environment, the real cause would have remained, and a security attribute would have
been quietly downgraded for no reason.

### The actual cause: two specs sharing a namespace

The failure only appears under parallelism. `SK-API-031` passes alone and fails at
`--workers=2`, which is the CI setting.

`account-area.spec.ts` hardcoded its fixtures:

```ts
const MINE = 'SK-2026-910001';
const THEIRS = 'SK-2026-910002';
```

`order-status.spec.ts` minted its own at random, with a comment explaining that this was
specifically to avoid collisions:

```ts
const suffix = Math.floor(Math.random() * 900_000) + 100_000; // SK-2026-100000..999999
```

`910001` and `910002` are inside that range. When a worker drew either, the create in
`account-area`'s `beforeAll` hit `Unique constraint failed on the fields: (orderNumber)`,
the orders were never written, and every spec in the file then waited out its timeout
looking for a row that did not exist. The cart failures were the same story through the
guest cookie: the token is minted _by_ the add-to-cart action, so a failed setup meant no
token, and the absent cookie was a symptom being read as the cause.

Two details made this expensive. The collision is probabilistic — about two draws in
900,000 — so it surfaced as a different handful of specs on each job and looked like
flakiness. And the loudest symptom was three layers downstream of the fault.

### The fix

Uniqueness is now the fixture's job rather than each spec's. `uniqueOrderNumber()` in
`tests/fixtures/db.ts` composes the worker index, a timestamp and a per-worker counter,
so it is unique by construction rather than probably unique. All four call sites use it,
and no spec hardcodes an order number.

The one literal left is `SK-2026-000000` in `SK-ACC-044`, which asserts a 404 for an
order that does not exist. That one has to be a literal, and the `SK-T-` prefix the
helper now produces can never collide with it.

Verified at `--workers=2` across the three affected files: no constraint errors, every
account and authorisation spec green, and the only remaining failures the thirteen
`SK-ADM` illegal-transition specs — which is BUG-10 being caught, exactly as intended.

### What this is worth

A random suffix is not isolation. It was documented as the safe choice, the comment
explaining it was right about the risk, and it still collided the moment another spec
picked a literal from the same range. Test data has to be unique by construction, and
"unique enough" fails at a rate low enough to look like something else entirely — in
this case, like a browser bug in a browser that was behaving correctly.

## A read that could observe the list in two states

`SK-CAT-048` failed in CI on a timeout rather than an assertion:

```
TimeoutError: locator.getAttribute: Timeout 10000ms exceeded.
  - waiting for locator('[data-testid^="product-card-"]').nth(1)
    at pages/catalogue.page.ts:181
```

The page object read the grid in two steps — a `count()`, then a `getAttribute()` per
index:

```ts
const count = await cards.count();
for (let index = 0; index < count; index += 1) {
  const testId = await cards.nth(index).getAttribute('data-testid');
```

Every one of those is a separate round trip to the browser. `SK-CAT-048` clicks through
to the next page, so the grid re-renders in the middle of the loop: the count was taken
from the old set of cards, and the indexed read then addressed an element that had
already been replaced. Playwright waited the full timeout for a node that was never
coming back.

Two things about this are worth stating plainly. It is a **bad test, not a defect** —
the application paginated correctly throughout. And it was _masking_ a real one: while
the helper was timing out, `SK-CAT-048` was counted among the 62 expected failures, so
the assertion it exists to make — that paging forward changes the products shown — was
never actually evaluated. A test failing for the wrong reason is indistinguishable from
a test failing for the right one when all you read is the count.

`visibleSlugs` and `visiblePricesInCents` now read the whole list in a single
evaluation, so there is no window in which the grid can change underneath them.
`visibleNames` already did this with `allInnerTexts()`, which is why it never failed.

Verified with `--repeat-each=2`: `SK-CAT-048` passes on both runs, and every remaining
failure in the pagination and sort specs is an assertion rather than a timeout — BUG-03
and SK-BUG-011, caught on their merits.

## The WebKit theory, revisited

The section above rejected the `Secure` cookie theory, and that was wrong. The namespace
collision was real, but WebKit still failed 146 specs after it was fixed. The pattern was
sharp: public pages and the API layer passed, and almost everything that needed a cookie
failed, including a plain valid sign-in.

The earlier probe had read cookies back from storage on a developer machine. It never
exercised WebKit on Linux, where CI runs. Serving the same build over real TLS took WebKit
to 62 failures, with one test separating it from Chromium, and left the cookie attribute
untouched. The lesson is narrower than "the theory was right": a probe only rules out a
cause in the environment it ran in.

## What the clean baseline exposed

The README used to promise a green suite at `v1.0-clean`, but that tag predates the tests,
so nobody had ever seen it. Reverting the seeding commits on top of the current suite gave
the first real answer, and five tests failed:

| Spec         | Verdict            | Reasoning                                                                    |
| ------------ | ------------------ | ---------------------------------------------------------------------------- |
| SK-PRICE-012 | **bad test**       | The shared runner required "promo applied" for a code correctly refused.     |
| SK-CART-028  | **bad test**       | `fill('abc')` throws on a number input. Keystrokes are what a shopper sends. |
| SK-CHK-017   | defect (unplanned) | SK-BUG-017, hidden on `main` because BUG-06 fails the same test.             |
| SK-CAT-008   | defect (unplanned) | SK-BUG-018, in query code that BUG-09 replaces.                              |
| SK-CAT-060   | defect (unplanned) | SK-BUG-011 again. Which sort test catches it depends on what is on page 1.   |

`SK-PRICE-012` also failed on `main`, where it had been counted as catching a seeded
defect. A failing test isn't evidence until you know why it fails, which is the same lesson
as `SK-CAT-048`, learned twice.

The browser comparison and later runs turned up six more bad tests: `SK-ACC-054` opened
`/login` before the sign-out redirect finished, `SK-ADM-310` looked for a desktop link at
phone width, and four read the page once before it had updated: `SK-CAT-023` the URL,
`SK-CART-003` the cart badge, `SK-CAT-048` the grid, and `SK-CAT-033` the result count.

CI now enforces both records through `tests/expected-failures.json`, so a green badge means
the failures are exactly the known ones, not merely that the job ran.
