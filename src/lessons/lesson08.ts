import type { Lesson } from '../engine/types'
import {
  lastQuerySucceeded,
  lastQueryScalarEquals,
  lastQueryContainsRow,
  lastQueryHasColumns,
} from '../engine/validators'
import { DATASHOP_SEEDS } from '../seeds'
import sketch from '../sketches/lesson08.svg?raw'

/**
 * Lesson 8 — Fan-out: the join that multiplies rows.
 *
 * The mechanism half of the old combined metrics lesson (notebook 05),
 * split out so it can be exactly one idea. Mirror image of Lesson 7: there,
 * joins silently LOSE rows; here, a non-unique key on the right side silently
 * MULTIPLIES them, and a SUM after that join double-counts. This is the
 * concrete proof of the prediction the learner made in Lesson 6
 * (what-breaks-the-join). Lesson 9 then takes the discipline — metric
 * definition, grain, additivity — that keeps it from happening.
 *
 * Expected scalars (DataShop, payment_status = 'paid'):
 *   broken dim grain check (after dup Bruno)   = 5 rows / 4 distinct
 *   broken JOIN row count (fact_orders x dim)  = 8
 *   paid_revenue (SUM at payment grain)        = 1060
 *   broken paid_revenue (SUM after JOIN items) = 1800
 *
 * The fan-out math: PAY001 (180, O001=2 items), PAY002 (280, O002=2 items),
 * PAY004 (280, O004=2 items), PAY005 (120, O005=1 item), PAY006 (200,
 * O006=1 item) -> 2x180 + 2x280 + 2x280 + 1x120 + 1x200 = 1800.
 */
const lesson08: Lesson = {
  id: 8,
  title: 'Fan-out: the join that multiplies rows',
  schemaSketch: { svg: sketch, alt: 'One payment row × two item rows = two joined rows, each carrying the payment amount $180. Caption: SUM(amount) = $360, not $180 — fan-out double-counts after a finer-grain JOIN' },
  concept: `Lesson 7 was about joins that silently **lose** rows. This is the mirror image: a join that silently **multiplies** them — and the damage hides inside a number that still looks plausible.

A join multiplies rows when the key it matches on **isn't unique on the right side**: each left row pairs with *several* right rows. That's exactly the guarantee Lesson 6 named — a FK → PK join is safe *only* while the PK is unique. Break that uniqueness and the join fans out.

You'll watch it happen twice. First on **row counts**, where you can see it: a duplicate dim row takes a 6-row join up to 8. Then on a **metric**, where you can't: \`SUM\` a value *after* a join that duplicated its rows, and the SUM counts the same value once per duplicate. That second one is **fan-out**, and it is the single most expensive mistake in analytics — a revenue number that's quietly 70% too high, with no error and no warning.

The rule that prevents it, which the next lesson builds on: **compute every metric at the grain of its own fact, and never \`SUM\` across a join to a finer grain.**`,
  dbtBridge: `A \`unique\` test on \`dim_customers.customer_id\` would have failed the build the instant that duplicate Bruno appeared — catching the broken PK *before* it ever reached a JOIN and silently doubled a number. It's the Lesson 1 grain check, run on every build so a human never has to remember to.`,
  seeds: DATASHOP_SEEDS,
  // The learner built these facts in L5; pre-build them so this lesson can run
  // metric queries against them.
  preMaterialize: [
    `CREATE OR REPLACE TABLE fact_orders AS
       SELECT order_id, customer_id, order_date, order_status FROM raw_orders`,
    `CREATE OR REPLACE TABLE fact_order_items AS
       SELECT order_item_id, order_id, product_id, quantity, unit_price,
              quantity * unit_price AS item_amount
       FROM raw_order_items`,
    `CREATE OR REPLACE TABLE fact_payments AS
       SELECT * FROM raw_payments`,
  ],
  steps: [
    {
      kind: 'sql',
      id: 'corrupt-the-dim',
      prompt: `In Lesson 6 you predicted what would break a clean join: a duplicate key on the dim side. Let's make it happen. Rebuild \`dim_customers\` from the four real customers, then insert a duplicate Bruno (\`C002\`) — a classic data-quality slip. Run the grain check on the dim: do total rows and distinct \`customer_id\`s still match?`,
      starterSql: `-- Rebuild a clean 4-customer dim first (so re-running never stacks dups),
-- then corrupt it with a duplicate Bruno (C002).
CREATE OR REPLACE TABLE dim_customers AS SELECT * FROM raw_customers;

INSERT INTO dim_customers
SELECT customer_id, customer_name || ' (dup)', city, state, signup_date
FROM dim_customers WHERE customer_id = 'C002';

-- Grain check: do total rows and distinct customer_ids still match?
SELECT
    COUNT(*)                    AS total_rows,
    COUNT(DISTINCT customer_id) AS distinct_ids
FROM dim_customers;`,
      validate: (s) =>
        lastQuerySucceeded(s) &&
        lastQueryContainsRow(s, { total_rows: 5, distinct_ids: 4 }),
      explanation: `**5 rows, but only 4 distinct \`customer_id\`s** — they no longer match, so the grain check *fails*. \`customer_id\` is no longer unique in \`dim_customers\`: the PK is broken, exactly the violation Lesson 6 warned about. Notice nothing errored. The table looks fine sitting there; the damage only shows up when something **joins** to it. That's the next step.`,
    },
    {
      kind: 'sql',
      id: 'count-the-broken-join',
      prompt: `**Predict, then run.** \`fact_orders\` has 6 rows, and \`dim_customers\` now carries that duplicate Bruno. When you JOIN them on \`customer_id\`, how many rows come back — 6, 7, or 8?`,
      starterSql: `SELECT COUNT(*) AS join_row_count
FROM fact_orders f
JOIN dim_customers c ON f.customer_id = c.customer_id;`,
      validate: (s) =>
        lastQuerySucceeded(s) &&
        lastQueryScalarEquals(s, 8),
      explanation: `**8 rows, not 6.** Bruno has 2 orders (O002 and O006). Each one now matches *two* dim rows (the original + the duplicate), so Bruno contributes 4 rows instead of 2. The other 4 orders are unaffected: 4 + 4 = 8. This is the silent killer: your JOIN looked safe, but the dim's PK wasn't actually unique. So far this only multiplied *rows* — the rest of the lesson shows what the same multiplication does to a metric you \`SUM\`.`,
    },
    {
      kind: 'sql',
      id: 'paid-revenue',
      prompt: `Set the honest baseline first. Compute **paid revenue** the right way: sum \`amount\` from \`fact_payments\` where \`payment_status = 'paid'\`, at its own grain ("one payment"). No joins.`,
      starterSql: `SELECT SUM(amount) AS paid_revenue
FROM fact_payments
WHERE payment_status = 'paid';`,
      validate: (s) =>
        lastQuerySucceeded(s) &&
        lastQueryHasColumns(s, ['paid_revenue']) &&
        lastQueryScalarEquals(s, 1060),
      explanation: `**1060.** That's the true paid-revenue figure, summed at the grain of \`fact_payments\` — one row per payment, no JOIN to inflate it. Hold onto that number: the next step computes what *looks* like the same thing, but through a JOIN.`,
    },
    {
      kind: 'sql',
      id: 'fan-out-trap',
      prompt: `**Predict before you run.** You know paid revenue is 1060. Now imagine someone writes the query below — SUMming \`amount\` from payments, but joined to items so they can also filter by product later. What does \`SUM(p.amount)\` return? 1060? 1800? Something else?`,
      starterSql: `-- Same paid_revenue number — but via a JOIN to items.
-- Predict the result BEFORE you run.
SELECT SUM(p.amount) AS paid_revenue_via_join
FROM fact_payments p
JOIN fact_order_items i ON i.order_id = p.order_id
WHERE p.payment_status = 'paid';`,
      validate: (s) =>
        lastQuerySucceeded(s) && lastQueryScalarEquals(s, 1800),
      explanation: `**1800, not 1060.** This is **fan-out**: each \`paid\` payment got JOINed once per line item on its order. PAY001 (\`amount=180\`) fanned out to 2 rows (O001 has 2 items), PAY002 (\`280\`) fanned to 2, PAY004 (\`280\`) fanned to 2, PAY005 (\`120\`) and PAY006 (\`200\`) stayed at 1 each. Sum: 2×180 + 2×280 + 2×280 + 120 + 200 = **1800**. The JOIN looked harmless; the SUM silently double-counted. This is why \`fact_payments\` and \`fact_order_items\` must be aggregated *separately* before being combined — the discipline you'll formalize in the next lesson.`,
    },
    {
      kind: 'checkpoint',
      id: 'why-1800',
      question: `Why did \`SUM(p.amount)\` jump from 1060 to 1800 after that JOIN?`,
      options: [
        'Refunded payments somehow crept in despite the filter',
        'The JOIN to `fact_order_items` duplicated each payment once per line item on its order, so SUM counted the same payment multiple times',
        'SUM is non-deterministic across different DuckDB versions',
        'The cancelled order O003 stopped being excluded',
      ],
      correctIndex: 1,
      explanation: `The JOIN took \`fact_payments\` (5 paid rows) up to the *finer* grain of \`fact_order_items\` (which has multiple rows per order). Each payment was repeated once per matching item, and the SUM happily added the same payment value multiple times. **A SUM is only honest at the grain of the table it's summing from.** If you need product-level revenue, aggregate items to product first, *then* bring payments in — never the raw rows together. The next lesson turns that habit into a checklist: define every metric by its grain.`,
    },
  ],
}

export default lesson08
