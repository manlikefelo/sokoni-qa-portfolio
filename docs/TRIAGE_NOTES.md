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
