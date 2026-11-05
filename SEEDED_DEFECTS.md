# Seeded defects

Ten defects were introduced into this application on purpose, each in its own commit,
so that the Playwright suite has real failures to find. This file is the complete
record. The last defect-free commit is tagged **`v1.0-clean`**, so the correct
behaviour stays available for diffing:

```bash
git diff v1.0-clean HEAD -- src/lib/pricing.ts     # what changed in the pricing engine
git log --oneline v1.0-clean..HEAD                 # the ten seeding commits
```

No `// BUG` or `// intentional` markers were left in the source. Each defect is
written the way the mistake would actually have been made, because a defect that
announces itself tests nothing.

**No defect was seeded in the security layer.** Authentication, authorisation,
ownership checks, input validation, rate limiting and the security headers are all
meant to be correct, and the suite asserts that they are.

---

## Summary

| ID     | Severity | Area      | Summary                                             | Commit    |
| ------ | -------- | --------- | --------------------------------------------------- | --------- |
| BUG-01 | High     | pricing   | Percentage discount computed on subtotal + shipping | `beab256` |
| BUG-02 | High     | cart      | Quantity update skips the stock check               | `2766bcc` |
| BUG-03 | Medium   | catalogue | Pagination skips a whole page                       | `47b34f5` |
| BUG-04 | Medium   | catalogue | Maximum price filter excludes the boundary          | `1559943` |
| BUG-05 | High     | cart      | Guest cart replaces the user cart on login          | `4380c4c` |
| BUG-06 | Critical | checkout  | Stock decremented before payment is confirmed       | `7436161` |
| BUG-07 | Medium   | promo     | Code expiring today rejected from midnight          | `b0ee2a0` |
| BUG-08 | Medium   | pricing   | Percentage discount rounded per line                | `f5c518f` |
| BUG-09 | Medium   | catalogue | Product search is case-sensitive                    | `efc43f5` |
| BUG-10 | Medium   | admin     | Order status transitions unvalidated                | `1916851` |

---

## BUG-01: Percentage discount applied to the total including shipping

**Severity:** High · **Commit:** `beab256`
**File:** `src/lib/pricing.ts` · **Function:** `priceCart`

A percentage discount is computed against `subtotal + shipping` rather than against
the subtotal alone, so the shopper receives a discount on their delivery charge.

**Manifests when** the order is below the free-shipping threshold of KSh 5,000, so
shipping is a non-zero KSh 350, and a percentage code is applied. It is completely
invisible above the threshold, because shipping is then zero and there is nothing
extra to discount, which is exactly what makes it easy to ship.

**Worked example.** One item at KSh 2,000 with `SAVE10`:

|           | Correct                   | Actual                    |
| --------- | ------------------------- | ------------------------- |
| Subtotal  | KSh 2,000.00              | KSh 2,000.00              |
| Discount  | KSh 200.00 (10% of 2,000) | KSh 235.00 (10% of 2,350) |
| Shipping  | KSh 350.00                | KSh 350.00                |
| **Total** | **KSh 2,150.00**          | **KSh 2,115.00**          |

**Expected behaviour.** The discount is computed against the subtotal only. Shipping
is never discounted. Shipping is then assessed on the post-discount subtotal.

---

## BUG-02: Cart quantity update bypasses the stock check

**Severity:** High · **Commit:** `2766bcc`
**File:** `src/actions/cart.ts` · **Function:** `updateQuantityAction`

`addToCartAction` validates the requested quantity against `stockQty` and refuses to
exceed it. `updateQuantityAction` looks the variant up, so a deleted variant is still
caught, but never compares the new quantity against available stock.

**Manifests when** an item already in the cart has its quantity raised from the cart
page, or by calling the action directly. Adding 3 of a variant with 2 in stock is
correctly refused; adding 1 and then editing the quantity to 3 succeeds.

**Worked example.** `ELEC-RN13-256B` (Redmi Note 13, 256GB Ice Blue) has
`stockQty = 1`. Add 1 to the cart, then set the cart quantity to 5. The line reads
5 × KSh 28,900.00 and checkout proceeds.

**Expected behaviour.** Every path that can change a quantity enforces the stock
ceiling, product page, cart page, and any route handler. A request above stock is
rejected with the available figure in the message.

---

## BUG-03: Pagination skips an entire page

**Severity:** Medium · **Commit:** `47b34f5`
**File:** `src/lib/catalogue.ts` · **Function:** `findProducts`

`skip` is computed as `page * PAGE_SIZE` instead of `(page - 1) * PAGE_SIZE`, so
page 1 begins at the thirteenth product.

**Manifests on** every catalogue view. With 25 products at 12 per page the page
count is correctly 3, but page 1 shows products 13–24, page 2 shows product 25, and
page 3 is empty. The first twelve products are unreachable through pagination.

**Worked example.** Walk `/products?page=1`, `?page=2`, `?page=3` and collect every
slug. The union contains 13 distinct products, not 25.

**Expected behaviour.** Page _n_ shows products `(n-1) × 12 + 1` through `n × 12`.
Walking every page yields exactly 25 distinct products with no repeats and no gaps.

---

## BUG-04: Maximum price filter excludes the boundary value

**Severity:** Medium · **Commit:** `1559943`
**File:** `src/lib/catalogue.ts` · **Function:** `buildWhere`

The upper bound uses `lt` where the specification requires both bounds to be
inclusive.

**Manifests when** a product's variant price is exactly equal to the filter maximum.

**Worked example.** The Oraimo 20000mAh Power Bank (`ELEC-OR20K-BLK`) has one variant
at exactly KSh 3,450.00, and it is the only variant at that price.

| Filter          | Matching products | Power bank in the set |
| --------------- | ----------------- | --------------------- |
| max = KSh 3,450 | 9                 | no                    |
| max = KSh 3,451 | 10                | yes                   |

The minimum bound is inclusive and correct, so the asymmetry between the two ends is
the tell.

Note that with BUG-03 also present the power bank does not appear on page 1 of the
filtered view even when it is in the result set, so this defect is cleanest to assert
against the result **count** rather than against the visible grid. Two defects
overlapping on one screen is itself a useful thing for the suite to have to separate.

**Expected behaviour.** Both bounds are inclusive: a product priced at exactly the
minimum or exactly the maximum appears in the results.

---

## BUG-05: Guest cart replaces the user cart on login

**Severity:** High · **Commit:** `4380c4c`
**File:** `src/lib/cart.ts` · **Function:** `mergeGuestCartIntoUserCart`

On login the guest cart is reassigned to the user and any cart the user already had is
deleted outright, rather than the two being combined.

**Manifests when** a signed-out shopper with items in their guest cart signs in to an
account that already has a saved cart. The saved items disappear with no message.

**Worked example.** User cart holds B and C. Guest cart holds A and B.

|             | Correct                                      | Actual                     |
| ----------- | -------------------------------------------- | -------------------------- |
| After login | A, B (quantities summed, capped at stock), C | A, B (guest quantity only) |

C is gone, and B has lost the quantity the user had saved.

**Expected behaviour.** The two carts merge. A variant present in both has its
quantities summed and then capped at available stock. Neither cart is discarded.

---

## BUG-06: Stock decremented before the payment is confirmed

**Severity:** Critical · **Commit:** `7436161`
**File:** `src/actions/checkout.ts` · **Function:** `placeOrderAction`

Stock is decremented as a "reservation" before the gateway is called, and is never
restored when the payment is declined or errors.

**Manifests on** every checkout that does not end in an approved payment. The
framing as a reservation is what makes it plausible, reserving stock during checkout
is a real pattern, but a real implementation releases the reservation on failure.

**Worked example.** `FASH-AVIA-GLD` (Aviator sunglasses) has `stockQty = 1`. Check
out with the declining card `4000 0000 0000 0002`. The payment fails and no order is
created, but stock is now 0 and the product shows as out of stock in the catalogue.
Repeating this against a variant with stock 5 drives it to 0 in five declined
attempts, with nothing sold.

**Expected behaviour.** Stock is re-validated, the gateway is charged, and only on an
approved payment does a transaction decrement stock and write the order. A declined or
errored payment leaves every stock level untouched.

---

## BUG-07: A promo code expiring today is rejected from midnight

**Severity:** Medium · **Commit:** `b0ee2a0`
**File:** `src/lib/promo.ts` · **Function:** `isExpired`

Both timestamps are truncated to midnight UTC before comparison and then compared
with `<=`, so a code whose expiry falls anywhere within today is treated as already
expired for the whole day.

**Manifests when** a code's `expiresAt` is on the current UTC date. The seed code
`ENDSTODAY` expires at 23:59:59 UTC today and is rejected from 00:00:00 onward.
`EXPIRED20` (yesterday) and `SAVE10` (+30 days) both behave correctly, which is why
the defect is easy to miss without a boundary case.

**Worked example.** Apply `ENDSTODAY` to any cart at any time today.
Expected: 15% discount applied. Actual: "That promo code has expired."

**Expected behaviour.** Expiry is exclusive and evaluated on the full UTC timestamp. A
code expiring at 23:59:59 today is valid until that instant and invalid from it.

---

## BUG-08: Percentage discount rounded per line rather than once

**Severity:** Medium · **Commit:** `f5c518f`
**File:** `src/lib/pricing.ts` · **Function:** `computeLineDiscounts`

Each line's share of a percentage discount is rounded individually and the rounded
shares are then summed, instead of the discount being computed once against the
subtotal and that single figure rounded.

**Manifests when** several lines each land on a half-cent boundary, so each rounds up
and the accumulated error shows in the total. Drift is one or two cents, small enough
to survive casual review, which is the point.

**Worked example, isolated from BUG-01.** Five lines at KSh 1,111.15 each, subtotal
KSh 5,555.75, with `SAVE10`. The _post-discount_ subtotal is still above the
free-shipping threshold, so shipping is zero and BUG-01 contributes nothing, any
difference here is attributable to per-line rounding alone.

|           | Correct                   | Actual                  |
| --------- | ------------------------- | ----------------------- |
| Subtotal  | KSh 5,555.75              | KSh 5,555.75            |
| Discount  | KSh 555.58 (rounded once) | KSh 555.60 (5 × 111.12) |
| Shipping  | KSh 0.00                  | KSh 0.00                |
| **Total** | **KSh 5,000.17**          | **KSh 5,000.15**        |

Isolating the two defects needs care: on a cart whose post-discount subtotal falls
_below_ KSh 5,000 the shipping charge reappears and BUG-01 dominates the difference.
Drift grows with the number of half-cent lines: six such lines drift 3 cents, ten
drift 5.

**Expected behaviour.** The percentage is applied to the subtotal and the result is
rounded exactly once, half-up. No per-line rounding.

---

## BUG-09: Product search is case-sensitive

**Severity:** Medium · **Commit:** `efc43f5`
**File:** `src/lib/catalogue.ts` · **Functions:** `matchesSearch`, `findProducts`

Search was moved from a database `contains` match to an in-memory filter over the
product name and description. `String.prototype.includes` compares case-sensitively,
so the search term must match the stored capitalisation exactly.

**Manifests when** the search term's case differs from the product copy. `Wallet`
finds the Leather Bifold Wallet; `wallet` and `WALLET` find nothing. `shirt` fails to
find the Premium Cotton Crew T-Shirt.

Some terms still appear to work: `kettle` and `headphones` match because those words
occur in lowercase inside the product descriptions. Partial success makes the defect
harder to spot than a search that fails outright, and is why the test for this needs
upper, lower and mixed case variations rather than a single happy-path query.

**Side note.** `Product.searchText`, a lowercased copy of the name and description, is
still maintained on every write but is no longer read by search. That dead column is
part of the defect's footprint, not a separate issue.

**Worked example.** `/products?q=shirt` returns "No products found".
`/products?q=Shirt` returns 1 result.

**Expected behaviour.** Search matches name and description case-insensitively on a
partial match. `shirt`, `Shirt` and `SHIRT` all return the same results.

---

## BUG-10: Admin order status transitions are not validated

**Severity:** Medium · **Commit:** `1916851`
**File:** `src/actions/admin.ts` · **Function:** `updateOrderStatusAction`

The action validates that the submitted status is a member of the `OrderStatus` enum
and then writes it, without checking whether the transition is legal from the order's
current status. `canTransition` in `src/lib/order-status.ts` still exists and is still
used to build the dropdown, so the UI only offers legal targets, but the UI is not
the enforcement point.

**Manifests when** the action is invoked with a target the state machine forbids.
Because the dropdown is filtered, this is not reachable by clicking through the
interface; it needs a direct action call, which is precisely why route-level and
action-level tests exist separately from UI tests.

**Worked example.** Take a `DELIVERED` order and invoke `updateOrderStatusAction`
with `status: 'PENDING'`. Expected: rejected with "An order cannot move from DELIVERED
to PENDING." Actual: the order is now `PENDING`.

**Expected behaviour.** Every transition is checked server-side against the state
machine:

```
PENDING    → PAID, CANCELLED
PAID       → PROCESSING, CANCELLED
PROCESSING → SHIPPED, CANCELLED
SHIPPED    → DELIVERED
DELIVERED  → (terminal)
CANCELLED  → (terminal)
```

Anything outside that table is rejected regardless of how the action was reached.

---

## Defects found during the build that were _not_ seeded

Two genuine bugs surfaced while building the application and were fixed before the
baseline was tagged. They are recorded here because they are more interesting than the
seeded ones, and because both came from framework behaviour rather than from
carelessness.

**`notFound()` returned HTTP 200.** A `loading.tsx` at the application root wrapped
every route in a Suspense boundary. Next.js streams suspended routes, which commits
the response status before the page body runs, so the not-found UI rendered correctly
while the status line had already gone out as `200`. A test asserting only on visible
text would have passed. Fixed by moving the catalogue's Suspense boundary inside the
page component, leaving `products/[slug]` free to set its own status. See the comment
in `src/app/(shop)/products/page.tsx`.

**`/admin` and `/account` leaked 200s.** The same streaming behaviour meant the
admin 404 and the account redirect never reached the client as real status codes.
Fixed with `src/middleware.ts`, which resolves both checks before the response begins.
The server-side checks in the pages and actions were left in place: the middleware
exists to make the HTTP semantics correct, not to replace the authorisation boundary.
