import type { Lesson } from '../engine/types'
import {
  lastQuerySucceeded,
  lastQueryScalarEquals,
  lastQueryContainsRow,
  lastQueryHasColumns,
} from '../engine/validators'
import { DATASHOP_SEEDS } from '../seeds'
import sketch from '../sketches/lesson06.svg?raw'

/**
 * Lesson 6 — Metrics, fan-out, additivity.
 *
 * Maps to notebook 05. Opens with the duplicate-PK / broken-JOIN demo
 * (moved here from lesson 5): a non-unique key on the right multiplies a
 * 6-row join to 8. That sets up the headline aha: SUM(p.amount) JOIN items
 * returns 1800 instead of 1060, because each paid payment fans out across
 * the line items of its order. Five paid payments × the number of items in
 * their orders = 8 rows in the joined result, then SUM double-counts.
 *
 * The arc is row-count multiplication (you can see it) → the same
 * multiplication applied to a metric, where the damage hides in a number.
 *
 * Expected scalars (DataShop, payment_status = 'paid'):
 *   gross_sales (cancelled excluded)                              = 1060
 *   paid_revenue (SUM at payment grain)                           = 1060
 *   broken paid_revenue (SUM after JOIN to items, fan-out)        = 1800
 *   paid_orders (COUNT DISTINCT order_id at payment grain)        = 5
 *   AOV = 1060 / 5                                                = 212
 *
 * The fan-out math: PAY001 (180, O001=2 items), PAY002 (280, O002=2 items),
 * PAY004 (280, O004=2 items), PAY005 (120, O005=1 item), PAY006 (200,
 * O006=1 item) → 2×180 + 2×280 + 2×280 + 1×120 + 1×200 = 1800.
 */
const lesson06: Lesson = {
  id: 6,
  title: 'Metrics, fan-out, additivity',
  schemaSketch: { svg: sketch, alt: 'One payment row × two item rows = two joined rows, each carrying the payment amount $180. Caption: SUM(amount) = $360, not $180 — fan-out double-counts after a finer-grain JOIN' },
  concept: `A **metric** has three parts you commit to *before* writing SQL: a **definition** (in English: "revenue is the sum of paid payment amounts, excluding refunds"), a **formula** (the SUM/COUNT/etc.), and a **grain** (which fact, at what level). Skip any of them and the team will argue about whose number is right.

A join **multiplies rows** when the key it matches on isn't unique on the right side — each left row pairs with *several* right rows. You'll reproduce that in the first two steps (a duplicate dim row takes a 6-row join to 8), and nothing will error. **Fan-out** is what that same multiplication does to a *metric*: you \`SUM\` a value *after* a JOIN that duplicated its rows, and the SUM counts the same value once per duplicate. The row-count damage you can see; the money damage hides inside a number that still looks plausible.

The rule: **compute every metric at the grain of its own fact first.** If you need to combine multiple facts, aggregate each one to a shared grain, *then* join the rolled-up numbers — never the raw rows.

**Additivity** is the related discipline. A metric is *fully additive* if you can SUM it across any dimension (revenue, units sold). *Semi-additive* if it adds across some dimensions but not others (a daily balance — adds across customers, not across days). *Non-additive* if combining requires recomputing from ingredients — every ratio (AOV, conversion rate, AVG). Non-additive metrics don't belong in the mart as pre-computed values; their ingredients do.`,
  dbtBridge: `In dbt, metric definitions live in the **Semantic Layer** (MetricFlow): each metric declares its measure, filter, and grain once, so every query respects the grain automatically.`,
  seeds: DATASHOP_SEEDS,
  // L4 built these; L6 needs them to run metric queries against.
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
      prompt: `First, the join that *multiplies* rows — the mirror image of lesson 5, where every join *lost* them. To see it cleanly, rebuild \`dim_customers\` from the four real customers, then insert a duplicate Bruno (\`C002\`) — a classic data-quality slip. Run the lesson-1 grain check on the dim: do total rows and distinct \`customer_id\`s still match?`,
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
      explanation: `**5 rows, but only 4 distinct \`customer_id\`s** — they no longer match, so the lesson-1 grain test *fails*. \`customer_id\` is no longer unique in \`dim_customers\`: the PK is broken. Notice nothing errored. The table looks fine sitting there; the damage only shows up when something **joins** to it. That's the next step.`,
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
      explanation: `**8 rows, not 6.** Bruno has 2 orders (O002 and O006). Each one now matches *two* dim rows (the original + the duplicate), so Bruno contributes 4 rows instead of 2. The other 4 orders are unaffected: 4 + 4 = 8. This is the silent killer of analytics queries — your JOIN looked safe, but the dim's PK wasn't actually unique. **A JOIN is only as trustworthy as the \`unique\` constraint on its right side** — which is exactly what the lesson-1 grain test (\`COUNT(*) = COUNT(DISTINCT key)\`) protects. So far this only multiplied *rows*; the rest of this lesson shows what the same multiplication does to a metric you \`SUM\` — and that's **fan-out**.`,
    },
    {
      kind: 'sql',
      id: 'gross-sales',
      prompt: `Compute **gross sales** the right way: sum \`item_amount\` from \`fact_order_items\`, excluding cancelled orders. The grain of \`fact_order_items\` is "one line item" — and that's exactly the right grain for a revenue total from items.`,
      starterSql: `SELECT SUM(i.item_amount) AS gross_sales
FROM fact_order_items i
JOIN fact_orders o ON o.order_id = i.order_id
WHERE o.order_status <> 'cancelled';`,
      validate: (s) =>
        lastQuerySucceeded(s) &&
        lastQueryHasColumns(s, ['gross_sales']) &&
        lastQueryScalarEquals(s, 1060),
      explanation: `**1060.** That's the gross sales number, defined as: "sum the item amounts of every line item on a non-cancelled order." Notice the *definition* commits to including refunded orders (the sale happened; the refund is a separate metric) — and excluding cancelled orders (those never happened). The grain of the SUM is the grain of \`fact_order_items\`. No JOIN inflated it.`,
    },
    {
      kind: 'sql',
      id: 'paid-revenue',
      prompt: `Now compute **paid revenue** the right way: sum \`amount\` from \`fact_payments\` where \`payment_status = 'paid'\`. Different definition, different grain ("one payment"), and — interestingly for DataShop — the same number as gross sales. That's a coincidence of this curated dataset; in the wild they'd diverge.`,
      starterSql: `SELECT SUM(amount) AS paid_revenue
FROM fact_payments
WHERE payment_status = 'paid';`,
      validate: (s) =>
        lastQuerySucceeded(s) &&
        lastQueryHasColumns(s, ['paid_revenue']) &&
        lastQueryScalarEquals(s, 1060),
      explanation: `**1060 again.** Two metrics, two definitions, two facts — same number, this time. The lesson: a metric is *defined by where it lives*, not by what number it happens to produce. "Gross sales" comes from the items fact; "paid revenue" comes from the payments fact. They answer different business questions even when they agree numerically.`,
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
      explanation: `**1800, not 1060.** This is **fan-out**: each \`paid\` payment got JOINed once per line item on its order. PAY001 (\`amount=180\`) fanned out to 2 rows (O001 has 2 items), PAY002 (\`280\`) fanned to 2, PAY004 (\`280\`) fanned to 2, PAY005 (\`120\`) and PAY006 (\`200\`) stayed at 1 each. Sum: 2×180 + 2×280 + 2×280 + 120 + 200 = **1800**. The JOIN looked harmless; the SUM silently double-counted. This is the single most expensive mistake in analytics and the reason \`fact_payments\` and \`fact_order_items\` have to be aggregated separately *before* being combined.`,
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
      explanation: `The JOIN took \`fact_payments\` (5 paid rows) up to the *finer* grain of \`fact_order_items\` (which has multiple rows per order). Each payment was repeated once per matching item, and the SUM happily added the same payment value multiple times. **A SUM is only honest at the grain of the table it's summing from.** If you need product-level revenue, aggregate items to product first, *then* bring payments in — never the raw rows together.`,
    },
    {
      kind: 'sql',
      id: 'aov-ingredients',
      prompt: `**Average Order Value** is a ratio: paid revenue ÷ paid orders. Compute all three numbers in one query — \`paid_revenue\`, \`paid_orders\` (count distinct \`order_id\`, since a single order can have multiple payment rows), and the AOV itself.`,
      starterSql: `SELECT
    SUM(amount)              AS paid_revenue,
    COUNT(DISTINCT order_id) AS paid_orders,
    -- TODO: compute aov as paid_revenue / paid_orders
FROM fact_payments
WHERE payment_status = 'paid';`,
      hint: `\`SUM(amount) / COUNT(DISTINCT order_id) AS aov\``,
      solution: `SELECT
    SUM(amount)                              AS paid_revenue,
    COUNT(DISTINCT order_id)                 AS paid_orders,
    SUM(amount) / COUNT(DISTINCT order_id)   AS aov
FROM fact_payments
WHERE payment_status = 'paid';`,
      validate: (s) =>
        lastQuerySucceeded(s) &&
        lastQueryContainsRow(s, { paid_revenue: 1060, paid_orders: 5, aov: 212 }),
      explanation: `**1060 revenue ÷ 5 paid orders = 212 AOV.** Note the \`COUNT(DISTINCT order_id)\`: even though there are 5 paid *payments*, they map to 5 distinct *orders* — there's no shortcut like \`COUNT(*)\`. The crucial insight is what the *mart* stores: not the \`aov\` column directly, but the two ingredients (\`paid_revenue\` and \`paid_orders\`). The ratio is recomputed at query time, and that recomputation is what makes the next step's question survive.`,
    },
    {
      kind: 'checkpoint',
      id: 'aov-additivity',
      question: `March AOV was \\$200; April AOV was \\$250. What is the combined March-and-April AOV?`,
      options: [
        '\\$225 — the average of the monthly AOVs',
        '\\$450 — the sum',
        'Can\'t tell from the AOVs alone; you have to recompute from total paid_revenue and total paid_orders for the two months combined',
        'Depends on which month had more orders, but somewhere between \\$200 and \\$250',
      ],
      correctIndex: 2,
      explanation: `AOV is a **ratio**, and ratios are **non-additive**. Imagine March had 1 order at \\$200 and April had 1000 orders at \\$250 — the combined AOV is much closer to \\$250 than to \\$225 because April dominates the weighting. To get the right answer you need (March revenue + April revenue) ÷ (March orders + April orders). **This is why marts store the ingredients of ratios, not the ratios themselves.** Pre-computing AOV per month and then trying to combine those values is mathematically broken; storing \`paid_revenue\` and \`paid_orders\` per month lets any consumer recompute AOV at any grouping they care about.`,
    },
  ],
}

export default lesson06
