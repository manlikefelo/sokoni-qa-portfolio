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
