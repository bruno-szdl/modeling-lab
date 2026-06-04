import type { Lesson } from '../engine/types'
import {
  lastQuerySucceeded,
  lastQueryContainsRow,
  lastQueryRowCountEquals,
} from '../engine/validators'
import { DATASHOP_SEEDS } from '../seeds'
import sketch from '../sketches/lesson09.svg?raw'

/**
 * Lesson 9 — Metrics & additivity.
 *
 * The discipline half of the old combined metrics lesson (notebook 05),
 * split out from fan-out (L8) so each idea gets room. Lesson 8 showed the
 * mechanism (a finer-grain join double-counts a SUM); this lesson is the
 * discipline that prevents it: define every metric by its grain, and know
 * which metrics survive aggregation (additive) and which don't (ratios).
 *
 * Expected scalars (DataShop, payment_status = 'paid'):
 *   gross_sales (SUM item_amount, cancelled excluded, items grain) = 1060
 *   paid_revenue (SUM amount, payments grain)                      = 1060
 *   paid_orders (COUNT DISTINCT order_id)                          = 5
 *   AOV = 1060 / 5                                                 = 212
 *   per-month AOV: 2024-03 = 460/2 = 230, 2024-04 = 600/3 = 200
 *     -> averaging the two (215) != true blended AOV (212): the
 *     non-additivity demo (step aov-per-month + aov-additivity).
 */
const lesson09: Lesson = {
  id: 9,
  title: 'Metrics & additivity',
  schemaSketch: {
    svg: sketch,
    alt: 'Three metrics stacked: "revenue" marked fully additive (sum across anything), "account balance" marked semi-additive (sum across customers, not across days), and "AOV = revenue / orders" marked non-additive (recompute from ingredients, never sum).',
  },
  concept: `Lesson 8 showed *how* a number goes wrong. This lesson is the discipline that keeps it right.

A **metric** has three parts you commit to *before* writing SQL: a **definition** in English ("revenue is the sum of paid payment amounts, excluding refunds"), a **formula** (the \`SUM\`/\`COUNT\`/…), and a **grain** (which fact, at what level). Skip any of them and the team will argue about whose number is correct. The first rule follows straight from fan-out: **compute every metric at the grain of its own fact.**

Then there's **additivity** — whether a metric survives being summed across dimensions:

- **Fully additive**: sum it across *any* dimension and the total is right. Revenue, units sold. These are safe to pre-compute and roll up.
- **Semi-additive**: adds across some dimensions but not others. An account balance adds across customers (everyone's balance today) but *not* across days (you don't sum Monday's and Tuesday's balance to get a two-day balance).
- **Non-additive**: combining requires recomputing from ingredients. Every ratio — AOV, conversion rate, average price. You cannot sum or average them.

The practical consequence, which the report in Lesson 10 depends on: **a report stores the *ingredients* of a ratio, never the ratio itself.** Keep \`paid_revenue\` and \`paid_orders\`; let every consumer recompute AOV at whatever grouping they need.`,
  seeds: DATASHOP_SEEDS,
  // The learner built these facts in L5; pre-build them so this lesson can run
  // metric queries against clean facts (no corrupt dim here).
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
      id: 'two-metrics',
      prompt: `Compute two *different* metrics side by side. **gross_sales** is "sum the item amounts of every line on a non-cancelled order" — its home is \`fact_order_items\` (grain: one line item). **paid_revenue** is "sum \`amount\` where \`payment_status = 'paid'\`" — its home is \`fact_payments\` (grain: one payment). The starter computes each as its own subquery; run it and compare the two numbers.`,
      starterSql: `SELECT
    (SELECT SUM(i.item_amount)
       FROM fact_order_items i
       JOIN fact_orders o ON o.order_id = i.order_id
       WHERE o.order_status <> 'cancelled') AS gross_sales,
    (SELECT SUM(amount)
       FROM fact_payments
       WHERE payment_status = 'paid')        AS paid_revenue;`,
      validate: (s) =>
        lastQuerySucceeded(s) &&
        lastQueryContainsRow(s, { gross_sales: 1060, paid_revenue: 1060 }),
      explanation: `**Both land on 1060 — and that coincidence is the whole point.** They are not the same metric. \`gross_sales\` lives in \`fact_order_items\` and answers *"what did we sell?"*; \`paid_revenue\` lives in \`fact_payments\` and answers *"what did we collect?"*. Each is pinned down by its **definition, formula, and grain** — by where it lives — never by the number it happens to print. (gross_sales deliberately *includes* refunded orders, since the sale happened, and *excludes* cancelled ones, which never did.) In this curated dataset the two match; the day a sale goes unpaid or one payment covers two orders, they diverge — and a team that had conflated them by their equal value would ship the wrong number.`,
    },
    {
      kind: 'checkpoint',
      id: 'classify-additivity',
      question: `You're deciding what to pre-compute in a report. Which of these is **non-additive** — combining it requires recomputing from ingredients, so it must NOT be stored as a finished number?`,
      options: [
        'Total revenue — `SUM` of paid amounts',
        'Units sold — `SUM` of quantity',
        'Conversion rate — orders ÷ visits',
        'All three are safe to pre-compute',
      ],
      correctIndex: 2,
      explanation: `Revenue and units are **fully additive** — sum them across product, region, or month and the total is always right, so they're safe to store and roll up. **Conversion rate is a ratio**, and ratios are non-additive: you can't sum or average monthly conversion rates to get the year's (a high-traffic month dominates the real figure). Store its *ingredients* — orders and visits — and recompute. (The in-between case is **semi-additive**, like an account balance: add it across customers, never across days.)`,
    },
    {
      kind: 'sql',
      id: 'aov-ingredients',
      prompt: `**Average Order Value** is a ratio: paid revenue ÷ paid orders. Compute all three numbers in one query — \`paid_revenue\`, \`paid_orders\` (count distinct \`order_id\`, since one order can have several payment rows), and the AOV itself.`,
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
      explanation: `**1060 revenue ÷ 5 paid orders = 212 AOV.** Note the \`COUNT(DISTINCT order_id)\`: there are 5 paid *payments* mapping to 5 distinct *orders*, so \`COUNT(*)\` would be wrong the moment an order had two payment rows. The crucial habit is what a report *stores*: not the \`aov\` column, but the two **ingredients** (\`paid_revenue\` and \`paid_orders\`). The ratio gets recomputed at query time — which is exactly what makes the next step possible.`,
    },
    {
      kind: 'sql',
      id: 'aov-per-month',
      prompt: `Now *watch* a ratio break when you slice it. Compute AOV **per month**: \`paid_revenue\`, \`paid_orders\`, and their ratio, grouped by month. Two rows come back — notice how far apart the two monthly AOVs are.`,
      starterSql: `SELECT
    strftime(payment_date, '%Y-%m')        AS month,
    SUM(amount)                            AS paid_revenue,
    COUNT(DISTINCT order_id)               AS paid_orders,
    SUM(amount) / COUNT(DISTINCT order_id) AS aov
FROM fact_payments
WHERE payment_status = 'paid'
GROUP BY strftime(payment_date, '%Y-%m')
ORDER BY month;`,
      validate: (s) =>
        lastQuerySucceeded(s) &&
        lastQueryRowCountEquals(s, 2) &&
        lastQueryContainsRow(s, { month: '2024-03', paid_revenue: 460, paid_orders: 2, aov: 230 }) &&
        lastQueryContainsRow(s, { month: '2024-04', paid_revenue: 600, paid_orders: 3, aov: 200 }),
      explanation: `**March AOV 230, April AOV 200.** Now the trap springs: the *overall* AOV is **not** the average of these two. Average them — (230 + 200) / 2 = **215** — and you get the wrong answer. The real figure is total revenue over total orders: 1060 / 5 = **212**, the number from the step before. 215 ≠ 212 because April's 3 orders deserve more weight than March's 2, and a plain average ignores that. A ratio is **non-additive**: you cannot sum or average it across a dimension. Store its ingredients and recompute — every time.`,
    },
    {
      kind: 'checkpoint',
      id: 'aov-additivity',
      question: `You just saw it: averaging March's 230 and April's 200 gives 215, but the true combined AOV is 212. Why can averaging monthly ratios be *wildly* wrong, not just a little off?`,
      options: [
        'It can\'t — 215 is close enough to 212 to treat them as equal',
        'Because months can have very different order *counts*: a month with 1 order at \\$200 and a month with 1000 orders at \\$250 average to \\$225, but the true blended AOV is nearly \\$250. The bigger the imbalance, the bigger the error.',
        'Because DuckDB rounds division differently each month',
        'Because revenue itself is non-additive',
      ],
      correctIndex: 1,
      explanation: `AOV is a **ratio**, and ratios are **non-additive** — and the error isn't fixed, it scales with how lopsided the weighting is. Here March and April are close in size, so 215 vs 212 is a small gap; with a 1-vs-1000 order split the gap blows up. The only correct combination is (sum of revenue) ÷ (sum of orders), never the average of the ratios. **This is why a report stores the ingredients of ratios, not the ratios themselves** — the design decision you'll make concrete when you build the monthly report next.`,
    },
  ],
}

export default lesson09
