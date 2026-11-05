# Traceability matrix

Every requirement in PRD sections 4, 5 and 7 mapped to the tests that cover it, and
every defect mapped to the test that caught it.

**Status key:** covered and passing · No covered, failing against a known defect ·
covered by a skipped test with a stated reason

---

## Part 1: Requirements to tests

### 4.1 Catalogue

| Requirement                                     | Covering tests                     | Status |
| ----------------------------------------------- | ---------------------------------- | ------ |
| Grid of active products with name, image, price | SK-CAT-020, SK-VIS-001             | Yes    |
| Lowest variant price shown when variants differ | SK-CAT-061, SK-BUG-011             | No     |
| Out-of-stock badge when every variant is zero   | SK-CAT-030                         | No     |
| Search by product name                          | SK-CAT-001, SK-CAT-002             | No     |
| Search by description                           | SK-CAT-003                         | No     |
| Search is case-insensitive                      | SK-CAT-004 (×3), SK-CAT-005        | No     |
| Search partial match                            | SK-CAT-002                         | No     |
| Search special characters handled safely        | SK-CAT-007, SK-CAT-008             | Yes    |
| Category filter, single                         | SK-CAT-020, SK-CAT-023             | Yes    |
| Category filter, multi-select                   | SK-CAT-021, SK-CAT-022             | Yes    |
| Price range, minimum bound inclusive            | SK-CAT-024                         | Yes    |
| Price range, maximum bound inclusive            | SK-CAT-025, SK-CAT-026             | No     |
| Price range, both bounds together               | SK-CAT-027                         | No     |
| In-stock-only filter                            | SK-CAT-029                         | Yes    |
| Sort by newest                                  | SK-CAT-063                         | No     |
| Sort by price ascending                         | SK-CAT-060                         | Yes    |
| Sort by price descending                        | SK-CAT-061, SK-CAT-064             | No     |
| Sort by name A–Z                                | SK-CAT-062                         | Yes    |
| Sort applies across the whole result set        | SK-CAT-067                         | Yes    |
| Pagination, 12 per page                         | SK-CAT-040, SK-CAT-042             | Yes    |
| Pagination, correct page count                  | SK-CAT-040                         | Yes    |
| Pagination, union is 25 distinct products       | SK-CAT-041, SK-CAT-044             | No     |
| Pagination, first and last page behaviour       | SK-CAT-043, SK-CAT-045, SK-CAT-046 | No     |
| Pagination, previous/next controls              | SK-CAT-046, SK-CAT-048             | No     |
| Filter and sort state in the URL                | SK-CAT-010, SK-CAT-023, SK-CAT-049 | No     |
| State survives reload                           | SK-CAT-009, SK-CAT-032, SK-CAT-065 | No     |
| Empty state when nothing matches                | SK-CAT-006, SK-CAT-028             | Yes    |
| Unparseable query params fall back              | SK-CAT-050, SK-CAT-068             | Yes    |

### 4.2 Product detail

| Requirement                                | Covering tests                      | Status |
| ------------------------------------------ | ----------------------------------- | ------ |
| Name, description, image, price rendered   | SK-CART-002, SK-VIS-002             | Yes    |
| Variant selector                           | SK-CART-009                         | Yes    |
| Stock indicator                            | SK-CART-011, SK-ADM-317, SK-ADM-318 | Yes    |
| Quantity bounded by selected variant stock | SK-CART-022                         | Yes    |
| Quantity minimum of 1                      | SK-CART-026, SK-CART-027            | Yes    |
| Add to cart                                | SK-CART-002                         | Yes    |
| Add to cart disabled when out of stock     | SK-CART-011, SK-ADM-318             | Yes    |
| 404 for unknown slug                       | SK-API-024                          | Yes    |
| 404 for inactive slug                      | SK-API-025, SK-ADM-316              | Yes    |

### 4.3 Cart

| Requirement                                                     | Covering tests                        | Status |
| --------------------------------------------------------------- | ------------------------------------- | ------ |
| Guest cart keyed by HttpOnly cookie                             | SK-API-031, SK-CART-010               | Yes    |
| User cart persisted against the account                         | SK-CART-045                           | No     |
| Guest cart merges into user cart on login                       | SK-CART-040                           | No     |
| Shared variant quantities summed                                | SK-CART-041                           | No     |
| Summed quantity capped at stock                                 | SK-CART-042                           | No     |
| Neither cart discarded                                          | SK-CART-040, SK-CART-043, SK-CART-044 | No     |
| Line items show product, variant, unit price, total             | SK-CART-004                           | Yes    |
| Quantity control                                                | SK-CART-005                           | Yes    |
| Remove item                                                     | SK-CART-006, SK-CART-007              | Yes    |
| Quantity never exceeds stock: add path                          | SK-CART-020, SK-CART-021, SK-CART-029 | Yes    |
| Quantity never exceeds stock: cart page path                    | SK-CART-023, SK-CART-024              | No     |
| Quantity boundaries 0, 1, stock, stock+1, negative, non-numeric | SK-CART-020, 025, 026, 027, 028       | Yes    |
| Live subtotal                                                   | SK-CART-005                           | Yes    |
| Promo code entry field                                          | SK-PROMO-001                          | No     |
| Empty state with catalogue link                                 | SK-CART-001                           | Yes    |
| Header count reflects total quantity                            | SK-CART-003                           | Yes    |

### 4.4 Promo codes

| Requirement                                   | Covering tests                           | Status |
| --------------------------------------------- | ---------------------------------------- | ------ |
| Case-insensitive entry, stored uppercase      | SK-PROMO-002 (×3)                        | No     |
| Unknown code rejected                         | SK-PROMO-003                             | Yes    |
| Inactive code rejected                        | SK-PROMO-006                             | Yes    |
| Expired code rejected                         | SK-PROMO-004, SK-PROMO-031               | Yes    |
| Below minimum spend rejected, threshold named | SK-PROMO-007                             | Yes    |
| At minimum spend accepted                     | SK-PROMO-008                             | No     |
| Usage limit enforced                          | SK-PROMO-020, SK-PROMO-021               | Yes    |
| Expiry exclusive, evaluated in UTC            | SK-PROMO-005, SK-PROMO-030, SK-PROMO-031 | No     |
| Discount applies to subtotal only             | SK-PRICE-100                             | No     |
| Percentage rounded once, half-up              | SK-PRICE-102, SK-PRICE-019 to 023        | No     |
| One code per order                            | SK-PROMO-009                             | Yes    |
| Code dropped if cart no longer qualifies      | SK-PROMO-011                             | Yes    |

### 4.5 Pricing rules

| Requirement                                 | Covering tests                           | Status |
| ------------------------------------------- | ---------------------------------------- | ------ |
| Subtotal is the sum of line totals          | SK-PRICE-001, 002, 017                   | Yes    |
| Discount capped at subtotal                 | SK-PRICE-015, SK-PRICE-016               | Info   |
| Free shipping at or above KSh 5,000         | SK-PRICE-003, SK-CART-012                | Yes    |
| KSh 350 shipping below the threshold        | SK-PRICE-001, SK-CART-013                | Yes    |
| Threshold boundary, one cent either side    | SK-PRICE-004, SK-PRICE-005               | Yes    |
| Shipping assessed on post-discount subtotal | SK-PRICE-101, SK-PRICE-008, SK-PRICE-009 | No     |
| Total = subtotal − discount + shipping      | all 25 SK-PRICE cases                    | No     |
| Values recomputed server-side               | SK-PRICE-110, SK-CHK-001                 | Yes    |
| Stock changes do not alter pricing          | SK-PRICE-111                             | Yes    |

### 4.6 Checkout

| Requirement                                         | Covering tests                              | Status |
| --------------------------------------------------- | ------------------------------------------- | ------ |
| Three steps, each addressable                       | SK-CHK-001, checkout page object navigation | Yes    |
| Guest supplies email plus address                   | SK-CHK-001                                  | Yes    |
| User may pick a saved address                       | SK-ACC-060, address form fixture            | Yes    |
| Server-side Zod validation on address               | SK-CHK-003, SK-ACC-062                      | Yes    |
| Review shows line items and totals                  | SK-CHK-005                                  | Yes    |
| Review has editable back-links                      | checkout page object, SK-CHK-005            | Yes    |
| Stock re-validated at order creation                | SK-CHK-021                                  | Yes    |
| Stock decremented only after approval               | SK-CHK-010 to 014, 016, 017                 | No     |
| Declined payment leaves stock untouched             | SK-CHK-010 to 013                           | No     |
| Gateway error leaves stock untouched                | SK-CHK-014                                  | No     |
| Approved payment decrements by the quantity ordered | SK-CHK-015                                  | Yes    |
| Order creation is idempotent                        | SK-CHK-020, SK-API-010, SK-API-011          | Yes    |
| Cart cleared on success                             | SK-CHK-002                                  | Yes    |
| Promo usedCount incremented                         | SK-CHK-018                                  | Yes    |
| Redirect to confirmation                            | SK-CHK-001                                  | Yes    |
| Order items snapshot name, variant, price           | SK-CHK-001                                  | Yes    |
| Concurrent purchase of the last unit                | SK-CHK-021                                  | Yes    |
| Checkout unreachable with an empty cart             | SK-CHK-004                                  | Yes    |

### 4.7 Accounts

| Requirement                                | Covering tests                     | Status |
| ------------------------------------------ | ---------------------------------- | ------ |
| Register with name, email, password        | SK-ACC-001                         | Yes    |
| Password minimum 10 characters             | SK-ACC-003, SK-ACC-006, SK-ACC-007 | Yes    |
| Password must contain a letter and a digit | SK-ACC-004, SK-ACC-005             | Yes    |
| Duplicate email returns a generic failure  | SK-ACC-002                         | Yes    |
| Email normalised to lowercase              | SK-ACC-008                         | Yes    |
| Login                                      | SK-ACC-020                         | Yes    |
| Failed login returns one generic message   | SK-ACC-021, 022, **023**           | Yes    |
| Logout                                     | SK-ACC-024                         | Yes    |
| Profile page                               | SK-ACC-050                         | Yes    |
| Change password requires the current one   | SK-ACC-051, SK-ACC-054             | Yes    |
| New password must meet the policy          | SK-ACC-052, SK-ACC-053             | Yes    |
| Address CRUD                               | SK-ACC-061, 062, 064               | Yes    |
| Exactly one default address                | SK-ACC-063, 065, 066               | Yes    |
| Order list and detail                      | SK-ACC-040, SK-ACC-042             | Yes    |
| Users see only their own orders            | SK-ACC-041                         | Yes    |
| Another user's order returns 404, not 403  | SK-ACC-043, SK-API-026             | Yes    |

### 4.8 Admin

| Requirement                                 | Covering tests              | Status |
| ------------------------------------------- | --------------------------- | ------ |
| Role-gated to ADMIN                         | SK-ADM-300, 301, 302, 310   | Yes    |
| Non-admin on an admin route gets 404        | SK-API-020, SK-API-021 (×4) | Yes    |
| Admin reaches every admin route             | SK-API-022 (×4)             | Yes    |
| Product list                                | SK-ADM-311                  | Yes    |
| Product create                              | SK-ADM-312, 313, 314        | Yes    |
| Product edit                                | SK-ADM-315                  | Yes    |
| Product deactivate                          | SK-ADM-316                  | Yes    |
| Stock adjustment                            | SK-ADM-317, 318, 319        | Yes    |
| Order list with status filter               | SK-ADM-330, 331, 332        | Yes    |
| Status transitions follow the state machine | SK-ADM-100 to 205           | No     |
| Legal transitions succeed                   | SK-ADM-001 to 034           | Yes    |
| Terminal statuses offer nothing             | SK-ADM-090, SK-ADM-091      | Yes    |

### 5 Non-functional

| Requirement                                       | Covering tests                                 | Status |
| ------------------------------------------------- | ---------------------------------------------- | ------ |
| Responsive from 360px                             | SK-VIS-001 to 005 at 390px                     | Yes    |
| Stable data-testid on every interactive element   | the whole suite; no locator uses anything else | Yes    |
| Semantic HTML, labelled controls                  | SK-A11Y-001 to 012                             | Yes    |
| Visible focus states                              | SK-A11Y-021                                    | Yes    |
| Alt text on images                                | SK-A11Y-024                                    | Yes    |
| Correct heading hierarchy                         | SK-A11Y-023                                    | Yes    |
| No critical or serious axe violations             | SK-A11Y-001 to 012                             | Yes    |
| Keyboard-only purchase journey                    | SK-A11Y-020, SK-A11Y-022                       | Yes    |
| One shared money formatter                        | every monetary assertion                       | Yes    |
| Loading and error states                          | route-loading testids, SK-CHK-003              | Yes    |
| Deterministic seed: 25 products, stock at 0 and 1 | SK-SMOKE-002                                   | Yes    |

### 6 Mock payment gateway

| Requirement                             | Covering tests                 | Status |
| --------------------------------------- | ------------------------------ | ------ |
| Approved card returns 200               | SK-API-001                     | Yes    |
| Card declined returns 402               | SK-API-002                     | Yes    |
| Expired card returns 402                | SK-API-003                     | Yes    |
| Insufficient funds returns 402          | SK-API-004                     | Yes    |
| Gateway error returns 500 after a delay | SK-API-008                     | Yes    |
| Any other card is declined              | SK-API-005                     | Yes    |
| Response shape                          | SK-API-006, SK-API-007         | Yes    |
| Card number never logged or returned    | SK-API-009                     | Yes    |
| Resilient to concurrent same-key calls  | SK-API-011                     | Yes    |
| Input validation                        | SK-API-012, 013, 014, 015, 016 | Yes    |

### 7 Security

| Requirement                                       | Covering tests                                 | Status |
| ------------------------------------------------- | ---------------------------------------------- | ------ |
| argon2id hashing, never plaintext                 | SK-ACC-001                                     | Yes    |
| Session cookie HttpOnly, SameSite=Lax             | SK-API-030                                     | Yes    |
| Guest cookie HttpOnly                             | SK-API-031                                     | Yes    |
| Rate limit on login                               | SK-ACC-030                                     | Yes    |
| No user enumeration on login                      | SK-ACC-023                                     | Yes    |
| No user enumeration on register                   | SK-ACC-002                                     | Yes    |
| Authorisation checked per route, not by hidden UI | SK-API-020 to 022, SK-ADM-302                  | Yes    |
| Ownership on orders                               | SK-API-026, SK-API-027, SK-ACC-041, SK-ACC-043 | Yes    |
| Ownership on addresses                            | SK-ACC-061 to 066                              | Yes    |
| Totals recomputed server-side                     | SK-PRICE-110, SK-CHK-001                       | Yes    |
| Stock changes inside a transaction                | SK-CHK-021                                     | Yes    |
| Security headers set                              | SK-API-028                                     | Yes    |
| Framework version not advertised                  | SK-API-029                                     | Yes    |
| No stack traces to the client                     | SK-API-014                                     | Yes    |
| SQL injection attempt handled as text             | SK-CAT-007                                     | Yes    |

---

## Part 2: Defects to catching tests

Filled in after the suite was written from the specification, not before. The order in
which things happened is recorded in `TRIAGE_NOTES.md`.

| Defect                                     | Area    | Catching test                                              | Written from spec, not from the defect list? |
| ------------------------------------------ | ------- | ---------------------------------------------------------- | -------------------------------------------- |
| BUG-01 discount includes shipping          | PRICE   | `SK-PRICE-100`, expected `-KSh 200.00`, got `-KSh 235.00`  | Yes                                          |
| BUG-02 cart update bypasses stock          | CART    | `SK-CART-023`, quantity 9 accepted against stock of 2      | Yes                                          |
| BUG-03 pagination off-by-one               | CAT     | `SK-CAT-041`, union is 13 distinct products, not 25        | Yes                                          |
| BUG-04 price filter exclusive bound        | CAT     | `SK-CAT-025`: 9 results where 10 expected                  | Yes                                          |
| BUG-05 cart overwrite on login             | CART    | `SK-CART-040`: the user's saved item is gone               | Yes                                          |
| BUG-06 stock decremented pre-payment       | CHK     | `SK-CHK-010`, stock 6 before a decline, 4 after            | Yes                                          |
| BUG-07 today-expiry promo rejected         | PROMO   | `SK-PROMO-005`: `ENDSTODAY` rejected as expired            | Yes                                          |
| BUG-08 per-line rounding drift             | PRICE   | `SK-PRICE-102`, expected `-KSh 555.58`, got `-KSh 555.60`  | Yes                                          |
| BUG-09 case-sensitive search               | CAT     | `SK-CAT-004`: `wallet` returns nothing, `Wallet` returns 1 | Yes                                          |
| BUG-10 unvalidated status transitions      | ADM     | `SK-ADM-200`: `DELIVERED` → `PENDING` accepted             | Yes                                          |
| **SK-BUG-011 sort key vs displayed price** | **CAT** | **`SK-CAT-061`, prices not monotonic under price-desc**    | **Unplanned find**                           |

### Secondary catches

Several defects are caught by more than one test, from different directions. That is
worth recording, because it shows which assertions are load-bearing and which are
corroborating.

| Defect | Also caught by                                                         |
| ------ | ---------------------------------------------------------------------- |
| BUG-01 | SK-PRICE-006, 010, 011, 012, 018, 023; SK-PROMO-001, 002 (×3), 008     |
| BUG-03 | SK-CAT-001, 002, 003, 004 (×3), 005, 009, 010, 030, 043, 045, 048, 063 |
| BUG-06 | SK-CHK-011, 012, 013, 014, 016, 017                                    |
| BUG-07 | SK-PROMO-030 (controlled expiry, rules out other explanations)         |
| BUG-08 | SK-PRICE-019, 020, 021, 022, 023                                       |
| BUG-10 | SK-ADM-100 to 111, 201 to 205 (18 transitions in total)                |

### Notes

- No test in this suite was written after reading PRD section 9. The defect list was
  consulted only to write `SEEDED_DEFECTS.md` and to confirm the mapping above.
- **BUG-03 inflates the failure count badly.** Thirteen specs across search,
  pagination and sort fail from one `skip` expression. Counting failures would suggest
  thirteen problems where there is one.
- **BUG-01 and BUG-08 interact.** Both affect the discount figure, and on a cart below
  the free-shipping threshold the larger error masks the smaller. Isolating BUG-08
  required a case where the post-discount subtotal stays above KSh 5,000.
- **SK-CHK-021 passes**, which is worth stating explicitly: concurrent purchase of the
  last unit is handled correctly even though BUG-06 is present, because the conditional
  decrement guard is intact. The two concerns are independent.
- Three pricing cases are skipped, with the reason recorded in the spec: they name
  promo codes the seed does not provide, so they exercise the rules rather than the
  storefront. The `100%` discount and over-cap cases are of that kind.
