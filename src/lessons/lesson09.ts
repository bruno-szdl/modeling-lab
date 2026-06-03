import type { Lesson } from '../engine/types'
import {
  lastQuerySucceeded,
  lastQueryScalarEquals,
  lastQueryContainsRow,
  lastQueryHasColumns,
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

The practical consequence, which the mart in Lesson 10 depends on: **a mart stores the *ingredients* of a ratio, never the ratio itself.** Keep \`paid_revenue\` and \`paid_orders\`; let every consumer recompute AOV at whatever grouping they need.`,
  dbtBridge: `In dbt, metric definitions live in the **Semantic Layer** (MetricFlow): each metric declares its measure, filter, and grain once, and the framework computes it at any grouping a query asks for — respecting the grain automatically, so fan-out can't sneak back in and a ratio is never accidentally summed.`,
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
      id: 'gross-sales',
      prompt: `Compute **gross sales**, defined as "sum the item amounts of every line on a non-cancelled order". Its home is \`fact_order_items\` (grain: one line item) — that's the right grain for a revenue total from items. The JOIN to \`fact_orders\` only filters; it can't fan out, because \`order_id\` is that table's unique PK.`,
      starterSql: `SELECT SUM(i.item_amount) AS gross_sales
FROM fact_order_items i
JOIN fact_orders o ON o.order_id = i.order_id
WHERE o.order_status <> 'cancelled';`,
      validate: (s) =>
        lastQuerySucceeded(s) &&
        lastQueryHasColumns(s, ['gross_sales']) &&
        lastQueryScalarEquals(s, 1060),
      explanation: `**1060.** The definition is deliberate: it *includes* refunded orders (the sale happened; a refund is a separate metric) and *excludes* cancelled ones (those never happened). The SUM runs at the grain of \`fact_order_items\`, and the FK → PK join to \`fact_orders\` matched one order per item — so nothing inflated. Definition, formula, grain: all three pinned down before the number existed.`,
    },
    {
      kind: 'sql',
      id: 'paid-revenue',
      prompt: `Now **paid revenue**: sum \`amount\` from \`fact_payments\` where \`payment_status = 'paid'\`. Different fact, different definition, grain of "one payment" — and, for this curated dataset, the same number as gross sales.`,
      starterSql: `SELECT SUM(amount) AS paid_revenue
FROM fact_payments
WHERE payment_status = 'paid';`,
      validate: (s) =>
        lastQuerySucceeded(s) &&
        lastQueryHasColumns(s, ['paid_revenue']) &&
        lastQueryScalarEquals(s, 1060),
      explanation: `**1060 again** — but don't be fooled by the coincidence. "Gross sales" comes from the items fact; "paid revenue" comes from the payments fact. **A metric is defined by where it lives, not by the number it happens to produce.** They answer different business questions ("what did we sell?" vs "what did we collect?") and in the wild they'd diverge the moment a sale goes unpaid or a payment covers multiple orders.`,
    },
    {
      kind: 'checkpoint',
      id: 'classify-additivity',
      question: `You're deciding what to pre-compute in a mart. Which of these is **non-additive** — combining it requires recomputing from ingredients, so it must NOT be stored as a finished number?`,
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
      explanation: `**1060 revenue ÷ 5 paid orders = 212 AOV.** Note the \`COUNT(DISTINCT order_id)\`: there are 5 paid *payments* mapping to 5 distinct *orders*, so \`COUNT(*)\` would be wrong the moment an order had two payment rows. The crucial habit is what a mart *stores*: not the \`aov\` column, but the two **ingredients** (\`paid_revenue\` and \`paid_orders\`). The ratio gets recomputed at query time — which is exactly what makes the next question answerable.`,
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
      explanation: `AOV is a **ratio**, and ratios are **non-additive**. Imagine March had 1 order at \\$200 and April had 1000 orders at \\$250 — the combined AOV is much closer to \\$250 than to \\$225 because April dominates the weighting. The only correct answer is (March revenue + April revenue) ÷ (March orders + April orders). **This is why marts store the ingredients of ratios, not the ratios themselves** — and it's the design decision you'll make concrete when you build the monthly mart next.`,
    },
  ],
}

export default lesson09
