# Defect reports

Every defect the suite found, in a form that could be pasted into a tracker. Expected
and actual carry concrete values throughout: "the total was wrong" is not a defect
report.

Eleven defects are recorded. Ten were seeded deliberately and are documented in
`SEEDED_DEFECTS.md`; **SK-BUG-011 was not**, and was found by a test written from the
specification. Two further genuine defects were found and fixed during the build rather
than being left in; they are recorded at the end for completeness.

**Environment for every report below:** local, production build of commit `98f6281`,
Chromium, SQLite with the standard seed, single worker unless stated.

---

## SK-BUG-001: Percentage discount calculated on subtotal plus shipping

**Severity:** High **Priority:** P1 **Component:** pricing
**Status:** open (seeded: BUG-01, commit `beab256`)

**Preconditions:** An order below the KSh 5,000 free-shipping threshold, so shipping is
a non-zero KSh 350. Promo code `SAVE10` available.

**Steps to reproduce:**

1. Add one item priced at exactly KSh 2,000.00 to the cart.
2. Open `/cart` and confirm subtotal KSh 2,000.00 and shipping KSh 350.00.
3. Enter `SAVE10` in the promo field and apply it.

**Expected:** Discount KSh 200.00, being 10% of the KSh 2,000.00 subtotal. Shipping
unchanged at KSh 350.00. Total **KSh 2,150.00**.

**Actual:** Discount **KSh 235.00**, being 10% of KSh 2,350.00: the subtotal plus
shipping. Total **KSh 2,115.00**, under-charging by KSh 35.00.

**Evidence:** `tests/e2e/pricing/pricing.spec.ts::SK-PRICE-100`, plus SK-PRICE-006,
010, 011, 018, 023 and SK-PROMO-001, 002, 008. Trace attached.

**Root cause:** `priceCart` in `src/lib/pricing.ts` computes a base shipping figure and
passes `subtotalCents + baseShippingCents` to `computeDiscount`.

**Suggested fix:** Pass `subtotalCents` alone. Shipping is assessed after the discount
and is never itself discountable.

**Note on detectability:** invisible above the free-shipping threshold, because shipping
is then zero and there is nothing extra to discount. An order that happened to qualify
for free delivery would price correctly, which is how this would reach production.

---

## SK-BUG-002: Cart quantity update does not check available stock

**Severity:** High **Priority:** P1 **Component:** cart
**Status:** open (seeded: BUG-02, commit `2766bcc`)

**Preconditions:** A variant with `stockQty = 2`, one unit already in the cart.

**Steps to reproduce:**

1. Add 1 of the variant to the cart. (Adding 3 directly is correctly refused.)
2. Open `/cart`.
3. Change the line quantity to 9 and leave the field.

**Expected:** Rejected, with a message naming the 2 units available. The stored quantity
stays at 1.

**Actual:** Accepted. The line reads 9, the subtotal reflects 9 units, and the quantity
survives a page reload, so it reached the database. Checkout can be reached with a
quantity seven units beyond what exists.

**Evidence:** `tests/e2e/cart/cart-operations.spec.ts::SK-CART-023`, confirmed
persistent by SK-CART-024.

**Root cause:** `updateQuantityAction` in `src/actions/cart.ts` loads the variant, so a
deleted variant is still caught, but never compares the requested quantity against
`stockQty`. `addToCartAction` does.

**Suggested fix:** Apply the same check in `updateQuantityAction`. Better, extract it so
both paths share one implementation and a third path cannot be added without it.

---

## SK-BUG-003: Pagination skips the first page of results

**Severity:** Medium **Priority:** P1 **Component:** catalogue
**Status:** open (seeded: BUG-03, commit `47b34f5`)

**Preconditions:** The standard seed of 25 active products, 12 per page.

**Steps to reproduce:**

1. Open `/products?page=1` and record every product slug shown.
2. Repeat for `?page=2` and `?page=3`.
3. Combine the three sets.

**Expected:** 3 pages. Page 1 holds products 1–12, page 2 holds 13–24, page 3 holds the
remaining 1. The union is **25 distinct products**.

**Actual:** 3 pages, correctly. But page 1 holds products 13–24, page 2 holds product
25, and page 3 is **empty**. The union is **13 distinct products**. The first twelve
products in any ordering are unreachable.

**Evidence:** `tests/e2e/catalogue/pagination.spec.ts::SK-CAT-041`, with SK-CAT-043 and
045 confirming the last-page and first-product symptoms.

**Root cause:** `findProducts` in `src/lib/catalogue.ts` computes
`skip: page * PAGE_SIZE` instead of `(page - 1) * PAGE_SIZE`.

**Suggested fix:** `skip: (page - 1) * PAGE_SIZE`.

**Secondary impact worth noting:** this also breaks _search_. Any query matching a single
product shows "Showing 1–1 of 1 products" with an empty grid, because the one match is
skipped. Eight search specs failed for this reason, not because search itself is broken:
a good illustration of why a failure count overstates the number of problems.

---

## SK-BUG-004: Maximum price filter excludes the boundary value

**Severity:** Medium **Priority:** P2 **Component:** catalogue
**Status:** open (seeded: BUG-04, commit `1559943`)

**Preconditions:** Oraimo 20000mAh Power Bank, one variant at exactly KSh 3,450.00, the
only variant at that price.

**Steps to reproduce:**

1. Open `/products` with a maximum price of KSh 3,450 and read the result count.
2. Change the maximum to KSh 3,451 and read it again.

**Expected:** Both bounds are inclusive per PRD 4.1, so a maximum of 3,450 includes the
product priced at exactly 3,450. Both queries return the same **10** products.

**Actual:** A maximum of 3,450 returns **9**; a maximum of 3,451 returns **10**. The
minimum bound is inclusive and correct, so the two ends behave differently.

**Evidence:** `tests/e2e/catalogue/filters.spec.ts::SK-CAT-025`, with SK-CAT-026 showing
the one-product difference and SK-CAT-024 confirming the minimum bound is correct.

**Root cause:** `buildWhere` in `src/lib/catalogue.ts` uses `lt` for the upper bound.

**Suggested fix:** `lte`.

---

## SK-BUG-005: Guest cart replaces the user cart on sign-in

**Severity:** High **Priority:** P1 **Component:** cart
**Status:** open (seeded: BUG-05, commit `4380c4c`)

**Preconditions:** Customer `asha@example.com` with a saved cart containing
`FASH-CREW-L-WHT` × 2 and `HOME-NX18-STL` × 1. A signed-out session with
`FASH-WALL-BRN` × 1 and `FASH-CREW-L-WHT` × 3 in the guest cart.

**Steps to reproduce:**

1. While signed out, add the two guest items.
2. Sign in as `asha@example.com`.
3. Open `/cart`.

**Expected:** Three lines. `FASH-WALL-BRN` × 1 from the guest cart, `HOME-NX18-STL` × 1
from the saved cart, and `FASH-CREW-L-WHT` × **5**: the two quantities summed and then
capped at available stock.

**Actual:** Two lines. `FASH-WALL-BRN` × 1 and `FASH-CREW-L-WHT` × **3**.
`HOME-NX18-STL` is **gone**, and the shared line carries only the guest quantity. The
user's saved cart was deleted with no message.

**Evidence:** `tests/e2e/cart/cart-merge.spec.ts::SK-CART-040`. The assertion message
reads "the user's previously saved item must not be discarded".

**Root cause:** `mergeGuestCartIntoUserCart` in `src/lib/cart.ts` deletes the user's
cart and reassigns the guest cart to the user, rather than combining the two.

**Suggested fix:** Iterate the guest items, upsert each into the user's cart summing any
existing quantity, cap at `stockQty`, then delete only the guest cart.

---

## SK-BUG-006: Stock is consumed by declined payments

**Severity:** Critical **Priority:** P0 **Component:** checkout
**Status:** open (seeded: BUG-06, commit `7436161`)

**Preconditions:** A product with `stockQty = 6`.

**Steps to reproduce:**

1. Add 2 units to the cart.
2. Complete the address and review steps.
3. Pay with the declining card `4000 0000 0000 0002`.
4. Read the variant's stock from the database.

**Expected:** The payment is declined, no order is created, and stock remains **6**.
PRD 4.6: "Stock is decremented only AFTER the payment is confirmed approved. A declined
or errored payment must leave all stock untouched."

**Actual:** The payment is declined and no order is created, but stock is **4**. Two
units have left inventory without being sold, and nothing restores them.

**Steps to reproduce the full impact:**

1. Take a product with `stockQty = 3`.
2. Attempt checkout with the declining card three times.
3. View the product in the catalogue.

**Expected:** Still 3 in stock, still purchasable.
**Actual:** Stock 0, badged "Out of stock". Three units written off having sold nothing.

**Evidence:** `tests/e2e/checkout/checkout.spec.ts::SK-CHK-010` through `014` cover each
declining card and the gateway error; `SK-CHK-016` demonstrates the cumulative drain;
`SK-CHK-017` shows a shopper losing the last unit of an item after one declined attempt
and then being unable to buy it.

**Root cause:** `placeOrderAction` in `src/actions/checkout.ts` decrements stock as a
"reservation" before calling the gateway, and has no release path for a non-approved
payment.

**Suggested fix:** Move the decrement inside the post-approval transaction, keeping the
conditional `updateMany` guard that prevents a concurrent checkout from driving stock
negative. If a reservation model is genuinely wanted, it needs an explicit release on
every failure path and a timeout for abandoned checkouts, materially more work than
re-ordering two calls.

**Why P0:** this is silent inventory loss proportional to declined-payment volume. A
card-testing attack against the storefront would empty the catalogue without placing a
single order.

---

## SK-BUG-007: Promo code expiring today is rejected all day

**Severity:** Medium **Priority:** P2 **Component:** promo
**Status:** open (seeded: BUG-07, commit `b0ee2a0`)

**Preconditions:** Seeded code `ENDSTODAY`, 15% off, expiring at 23:59:59 UTC today.

**Steps to reproduce:**

1. Build a cart worth KSh 3,000.00.
2. Apply `ENDSTODAY` at any time during the current UTC day.

**Expected:** Accepted. Expiry is exclusive and evaluated on the full timestamp per PRD
4.4, so the code is valid until 23:59:59. Discount KSh 450.00.

**Actual:** Rejected with "That promo code has expired." from 00:00:00 onward.

**Second reproduction, isolating the cause:** create a code expiring sixty seconds from
now and apply it immediately. Expected: accepted. Actual: rejected. This rules out any
explanation other than the comparison discarding the time component.

**Evidence:** `tests/e2e/promo/promo-codes.spec.ts::SK-PROMO-005` for the seeded code and
`SK-PROMO-030` for the controlled-expiry case. `SK-PROMO-031` confirms a code that
expired a second ago is correctly rejected, so the operator is wrong only at the
boundary.

**Root cause:** `isExpired` in `src/lib/promo.ts` truncates both timestamps to midnight
UTC via `startOfUtcDay` and compares with `<=`, making any code expiring today expired
from the start of that day.

**Suggested fix:** Compare the full timestamps: `promo.expiresAt.getTime() <= now.getTime()`.

**Business impact:** every last-day redemption of a time-limited campaign fails. That is
the day such campaigns get the most traffic.

---

## SK-BUG-008: Percentage discount rounded per line rather than once

**Severity:** Medium **Priority:** P3 **Component:** pricing
**Status:** open (seeded: BUG-08, commit `f5c518f`)

**Preconditions:** Five cart lines at KSh 1,111.15 each, subtotal KSh 5,555.75. The
post-discount subtotal stays above the free-shipping threshold, so shipping is KSh 0.00
and SK-BUG-001 contributes nothing to this case.

**Steps to reproduce:**

1. Add five items at KSh 1,111.15 each.
2. Confirm subtotal KSh 5,555.75 and shipping KSh 0.00.
3. Apply `SAVE10`.

**Expected:** Discount **KSh 555.58**: 10% of KSh 5,555.75 is KSh 555.575, rounded
half-up once. Total **KSh 5,000.17**.

**Actual:** Discount **KSh 555.60**: each line's share of KSh 111.115 rounded to
KSh 111.12, then summed. Total **KSh 5,000.15**. Two cents over-discounted.

**Evidence:** `tests/e2e/pricing/pricing.spec.ts::SK-PRICE-102`, with SK-PRICE-019 to
023 covering other quantity and price combinations. Drift scales with the number of
half-cent lines: six lines drift 3 cents, ten drift 5.

**Root cause:** `computeLineDiscounts` in `src/lib/pricing.ts` rounds each line's share
and sums the rounded figures.

**Suggested fix:** Compute the discount once against the subtotal and round that single
figure, which is what `computeDiscount` already does correctly.

**Note on isolating this:** it was initially hard to attribute, because a cart whose
post-discount subtotal falls below KSh 5,000 brings SK-BUG-001 into play and the
larger error masks this one. The reproduction above is chosen so shipping is zero.

---

## SK-BUG-009: Product search is case-sensitive

**Severity:** Medium **Priority:** P2 **Component:** catalogue
**Status:** open (seeded: BUG-09, commit `efc43f5`)

**Steps to reproduce:**

1. Open `/products?q=shirt`.
2. Open `/products?q=Shirt`.

**Expected:** Both return the Premium Cotton Crew T-Shirt. PRD 4.1 requires
case-insensitive partial matching.

**Actual:** `?q=shirt` returns **no products found**. `?q=Shirt` returns **1**. Likewise
`Wallet` finds the Leather Bifold Wallet while `wallet` and `WALLET` find nothing.

**Evidence:** `tests/e2e/catalogue/search.spec.ts::SK-CAT-004`, parametrised over
`wallet`, `WALLET` and `WaLLeT`; `SK-CAT-005` asserts the three case variants return
identical result sets.

**Root cause:** `matchesSearch` in `src/lib/catalogue.ts` filters with
`String.prototype.includes`, which is case-sensitive.

**Suggested fix:** Compare lowercased on both sides. The `Product.searchText` column
already holds a lowercased copy of the name and description and is maintained on every
write; it is simply no longer read.

**Note on detectability:** partial success makes this worse than an outright failure.
`kettle` and `headphones` do match, because those words appear lowercase inside the
product descriptions. A smoke test using one lucky search term would pass.

---

## SK-BUG-010: Order status transitions are not validated

**Severity:** Medium **Priority:** P2 **Component:** admin
**Status:** open (seeded: BUG-10, commit `1916851`)

**Preconditions:** Admin session. An order in any status.

**Steps to reproduce:**

1. Open a `DELIVERED` order at `/admin/orders/{id}`. The page correctly shows
   "DELIVERED is a final status: no further changes are possible."
2. Submit a status update naming that order with target `PENDING`.
3. Reload the order.

**Expected:** Rejected with "An order cannot move from DELIVERED to PENDING." The order
stays `DELIVERED`.

**Actual:** Accepted. The order is now `PENDING`.

**Expected and actual across the whole lifecycle:** 18 transitions are forbidden by
PRD 4.8. All 18 are accepted. Examples:

| Transition               | Expected | Actual                 |
| ------------------------ | -------- | ---------------------- |
| `DELIVERED` → `PENDING`  | refused  | stored as `PENDING`    |
| `CANCELLED` → `PAID`     | refused  | stored as `PAID`       |
| `PENDING` → `SHIPPED`    | refused  | stored as `SHIPPED`    |
| `SHIPPED` → `PROCESSING` | refused  | stored as `PROCESSING` |

**Evidence:** `tests/e2e/admin/order-status.spec.ts::SK-ADM-100` to `SK-ADM-205`,
parametrised across every illegal pair. The nine legal transitions all pass, so the
lifecycle is not merely broken. It is unenforced.

**Root cause:** `updateOrderStatusAction` in `src/actions/admin.ts` validates that the
submitted value is a member of the `OrderStatus` enum and then writes it. The
`canTransition` helper in `src/lib/order-status.ts` still exists and is still used to
build the dropdown, but is never consulted on the write path.

**Suggested fix:** Call `canTransition(order.status, target)` before updating and reject
when it returns false.

**Note on reachability:** not reproducible by clicking through the interface, because
the dropdown only offers legal targets. That is exactly why it needs an action-level
test: the UI filtering its own options is not a server-side guarantee.

---

## SK-BUG-011: Price sort disagrees with the price displayed on the card

**Severity:** Low **Priority:** P3 **Component:** catalogue
**Status:** open, **unplanned; not one of the ten seeded defects**

**Preconditions:** Tefal Non-Stick Frying Pan, with variants at KSh 2,450.00 (24cm) and
KSh 2,950.00 (28cm), and `basePriceCents` of 295000.

**Steps to reproduce:**

1. Open `/products?sort=price-desc`.
2. Read the prices shown on the cards, in order.

**Expected:** Prices descend monotonically down the grid.

**Actual:** The sequence reads … KSh 3,200.00, **From KSh 2,450.00**, KSh 2,850.00 …
The frying pan's card shows KSh 2,450.00, its cheapest variant, but the query ordered it
by its `basePriceCents` of KSh 2,950.00. The card appears two positions out of place.

**Evidence:** `tests/e2e/catalogue/sort.spec.ts::SK-CAT-061`, which reads the rendered
prices and compares them against a sorted copy. `SK-CAT-064` and `066` fail for the same
reason.

**Root cause:** `buildOrderBy` orders on `Product.basePriceCents`, while `ProductCard`
renders `lowestVariantPrice(product)`. The two agree for 24 of the 25 seeded products,
which is why this is subtle, only the frying pan has a variant cheaper than its base
price.

**Suggested fix:** Order by the lowest variant price so the sort key and the displayed
figure are the same value. On Postgres that is a lateral join or a maintained
denormalised column; on SQLite via Prisma it likely needs the column. Alternatively,
display `basePriceCents`, but showing a price higher than the cheapest purchasable
variant is worse for the shopper.

**Why this is the interesting one:** it was not planted. It came from a test that read
the actual displayed values and compared them, rather than checking that the sort
control had the right label selected. A presence-style assertion would have passed.

---

## Defects found during development and fixed before the baseline

Recorded for completeness. Both were fixed before `v1.0-clean` was tagged, so neither
is reproducible on any committed revision.

### SK-BUG-012: `notFound()` returned HTTP 200 _(fixed)_

A `loading.tsx` at the application root wrapped every route in a Suspense boundary.
Next.js streams suspended routes, which commits the response status before the page body
runs, so an unknown product slug rendered the not-found page correctly while the status
line had already gone out as `200`.

A test asserting only on visible text would have passed. Found because the status code
was asserted explicitly. Fixed by moving the catalogue's Suspense boundary inside the
page component, leaving `products/[slug]` free to set its own status.

### SK-BUG-013: Admin and account routes leaked 200 responses _(fixed)_

The same streaming behaviour meant `/admin` returned 200 to a non-admin while rendering
the not-found page, and `/account` returned 200 to an anonymous visitor while rendering
the login redirect. The gating worked; the HTTP semantics did not.

Fixed with `src/proxy.ts`, which resolves both checks before the response begins. The
server-side checks in the pages and actions were left in place: the proxy exists to make
the status codes honest, not to replace the authorisation boundary.

### SK-BUG-014: Promo rate limiter counted successful applications _(fixed)_

`applyPromoAction` counted every attempt against the ten-per-fifteen-minutes limit,
including successful ones, while `loginAction` already cleared its bucket on success. A
shopper who legitimately applied a valid code on ten separate orders was refused the
eleventh with "Too many attempts."

Found while investigating why the test suite was being rate limited: the investigation
turned up a customer-facing bug rather than a test problem. Fixed by calling
`resetRateLimit` after a successful application, matching the login path.

### SK-BUG-015: Inline auth links distinguishable by colour alone _(fixed)_

The "Register" and "Sign in" links embedded in sentences on the auth pages carried
`hover:underline`, so at rest they differed from the surrounding text only in colour.
axe-core flags this as a serious violation of WCAG 1.4.1; a shopper who cannot
distinguish the brand green from body grey cannot see that the text is a link.

Found by `tests/a11y/accessibility.spec.ts::SK-A11Y-005`. Fixed by giving those links a
permanent underline.

---

## Defects found by the clean baseline and the browser matrix

These came later, from running the suite with the seeding commits reverted and comparing
the browsers against each other. Unlike the section above, they postdate `v1.0-clean`.

### SK-BUG-016: No way to sign out on a phone _(fixed)_

The sign-out button sat in the desktop header, which is hidden below the `md` breakpoint,
and the mobile menu didn't offer one. A shopper on a phone stayed signed in with no way
out from the navigation.

Found by `SK-ACC-024` and `SK-ACC-054` failing only on Mobile Chrome. Fixed by adding the
button to the mobile menu.

### SK-BUG-017: A good card was refused after one decline _(fixed)_

`PaymentForm` reused one idempotency key for every attempt, and the gateway retains its
result per key. After a decline, retrying with a valid card replayed the stored "Your card
was declined" without ever evaluating the new card, until the shopper reloaded the page.

`SK-CHK-017` found it, but BUG-06 made that test fail on `main` for a different reason, so
the defect stayed hidden until the test also failed with the seeds reverted. Fixed by
issuing a new key after a refused attempt.

### SK-BUG-018: A percent sign in search matches every product _(open, clean code only)_

**Severity:** Low **Priority:** P3 **Component:** catalogue

With the seeding commits reverted, searching for `%` returns all 25 products instead of
the empty state, which `SK-CAT-008` requires. `buildWhere` passes the term to a Prisma
`contains` filter, which appears to leave the wildcard unescaped on SQLite.

BUG-09 replaces that query with an in-memory match, so `main` doesn't show the defect. It
stays open because the affected code exists only when BUG-09 is reverted. **Suggested
fix:** escape `%` and `_` in the term, or match with `instr`.
