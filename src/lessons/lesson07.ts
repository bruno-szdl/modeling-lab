import type { Lesson } from '../engine/types'
import {
  lastQuerySucceeded,
  lastQueryRowCountEquals,
  lastQueryContainsRow,
  tableExists,
} from '../engine/validators'
import { DATASHOP_SEEDS } from '../seeds'
import sketch from '../sketches/lesson07.svg?raw'

/**
 * Lesson 7 — Build the mart (the monthly mart).
 *
 * Maps to notebook 06. The first of the two marts. Each fact is
 * aggregated at month grain in its own CTE; the rolled-up CTEs are joined
 * on the month key. No fan-out because nothing is at a finer grain at the
 * join — the L6 lesson, applied. (The finale screen, <CourseComplete />,
 * is triggered by L8, not here — L8 is the last lesson and pre-materializes
 * this mart so both marts can be shown side by side.)
 *
 * Expected mart shape (mart_monthly_sales, 2 rows):
 *   month   | gross_sales | paid_revenue | paid_orders | refunded_amount | delivered_orders | cancelled_orders | refunded_orders
 *   2024-03 |     460     |     460      |      2      |        0        |        2         |        1         |        0
 *   2024-04 |     600     |     600      |      3      |       200       |        2         |        0         |        1
 *
 * Critical fan-out check: paid_orders is COUNT DISTINCT order_id WHERE
 * status='paid' in fact_payments. Two paid orders in March (PAY001/O001,
 * PAY002/O002) and three in April (PAY004/O004, PAY005/O005, PAY006/O006),
 * total 5. SUM(paid_revenue)/SUM(paid_orders) across the mart = 1060/5 =
 * 212 = the L6 AOV. Ingredients survive aggregation; ratios don't.
 *
 * Refunded amounts: PAY007 has amount=-200 (refunded); the mart expresses
 * the refunded_amount as a POSITIVE 200 via SUM(-amount) on refunded rows.
 */
const lesson07: Lesson = {
  id: 7,
  title: 'Build the mart',
  schemaSketch: { svg: sketch, alt: 'Three raw facts (order_items, payments, orders) flow into three pre-aggregated CTEs at month grain, which then merge into a single mart_monthly_sales table with 2 rows' },
  concept: `Everything you've practiced converges here — this is the top of the layering you've been climbing: \`raw → models (dims + facts) → mart\`. The mart is the **product**. The \`fact_*\` and \`dim_*\` model layer holds the *inputs* — designed for engineering correctness. The mart is designed for **answering business questions in one query**: a stakeholder writes \`SELECT * FROM mart_monthly_sales\` and the answer is right there.

Three properties of a good mart:

1. **Grain matches the question.** Stakeholders ask monthly questions → the mart has one row per month.
2. **Pre-aggregated at that grain.** No downstream JOINs needed. The mart is the answer, not the ingredients of an answer.
3. **Ingredients of ratios, not the ratios themselves.** Store \`paid_revenue\` and \`paid_orders\`; let consumers recompute AOV at whatever grouping they want. (Lesson 6's discipline, made concrete.)

Build strategy: **aggregate each fact at the mart's grain first, then join the rolled-up tables.** This is the only fan-out-proof shape for combining multiple facts. You'll build three CTEs (one per fact: items, payments, orders), each pre-aggregated to month grain, then \`LEFT JOIN\` them on \`month\`.`,
  dbtBridge: `Heads up on vocabulary: dbt's \`marts/\` folder is broader than this lab's word "mart" — your \`dim_*\` and \`fact_*\` models live there too. We've reserved "mart" for the final aggregated table a stakeholder queries; dbt would call this one a *report* or *aggregate* mart and keep it alongside the dims and facts. Either way it's materialized as a \`table\`, so a dashboard reads a pre-computed snapshot instead of re-running the whole CTE graph on every refresh.`,
  seeds: DATASHOP_SEEDS,
  // L4 built these; L7 aggregates them at month grain.
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
      id: 'items-monthly',
      prompt: `Step 1 of the mart build: aggregate \`fact_order_items\` to month grain. One row per month, with \`gross_sales\` = sum of \`item_amount\` for non-cancelled orders. You should see exactly **2 rows**.`,
      starterSql: `SELECT
    strftime(o.order_date, '%Y-%m') AS month,
    SUM(i.item_amount)              AS gross_sales
FROM fact_order_items i
JOIN fact_orders o ON o.order_id = i.order_id
WHERE o.order_status <> 'cancelled'
GROUP BY strftime(o.order_date, '%Y-%m')
ORDER BY month;`,
      validate: (s) =>
        lastQuerySucceeded(s) &&
        lastQueryRowCountEquals(s, 2) &&
        lastQueryContainsRow(s, { month: '2024-03', gross_sales: 460 }) &&
        lastQueryContainsRow(s, { month: '2024-04', gross_sales: 600 }),
      explanation: `**March 460, April 600** — gross sales per month, at the right grain (one row per month), with cancelled orders excluded. This is the first CTE of the mart. Note the JOIN to \`fact_orders\` is purely to filter; it doesn't change the grain because we're grouping by the month. (We derive \`month\` inline with \`strftime\` here. When a report needs richer calendar attributes — quarter, weekday — or has to show months with *zero* activity, you'd join \`dim_date\` instead: the calendar spine from the side quest. Inline is fine when every period already has data, as it does here.)`,
    },
    {
      kind: 'sql',
      id: 'payments-monthly',
      prompt: `Step 2: aggregate \`fact_payments\` to month grain. Three columns: \`paid_revenue\` (SUM where status='paid'), \`paid_orders\` (COUNT DISTINCT order_id where status='paid' — remember L6: payments and orders are 1:N), and \`refunded_amount\` (refund amounts expressed as positive numbers).`,
      starterSql: `SELECT
    strftime(payment_date, '%Y-%m') AS month,
    SUM(CASE WHEN payment_status = 'paid' THEN amount ELSE 0 END)              AS paid_revenue,
    COUNT(DISTINCT CASE WHEN payment_status = 'paid' THEN order_id END)        AS paid_orders,
    -- TODO: refunded_amount = SUM of -amount when status='refunded' (refunds
    -- are stored negative, so negating gives a positive total). Else 0.
FROM fact_payments
GROUP BY strftime(payment_date, '%Y-%m')
ORDER BY month;`,
      hint: `\`SUM(CASE WHEN payment_status = 'refunded' THEN -amount ELSE 0 END) AS refunded_amount\``,
      solution: `SELECT
    strftime(payment_date, '%Y-%m') AS month,
    SUM(CASE WHEN payment_status = 'paid'     THEN amount  ELSE 0 END) AS paid_revenue,
    COUNT(DISTINCT CASE WHEN payment_status = 'paid' THEN order_id END) AS paid_orders,
    SUM(CASE WHEN payment_status = 'refunded' THEN -amount ELSE 0 END) AS refunded_amount
FROM fact_payments
GROUP BY strftime(payment_date, '%Y-%m')
ORDER BY month;`,
      validate: (s) =>
        lastQuerySucceeded(s) &&
        lastQueryRowCountEquals(s, 2) &&
        lastQueryContainsRow(s, { month: '2024-03', paid_revenue: 460, paid_orders: 2, refunded_amount: 0 }) &&
        lastQueryContainsRow(s, { month: '2024-04', paid_revenue: 600, paid_orders: 3, refunded_amount: 200 }),
      explanation: `March: 460 revenue across 2 paid orders, 0 refunded. April: 600 across 3 paid orders, 200 refunded (PAY007 on O006). Notice \`paid_orders\` lives in the mart alongside \`paid_revenue\` — they're the two **ingredients** of AOV. The mart will store both; the AOV itself stays out.`,
    },
    {
      kind: 'sql',
      id: 'orders-monthly',
      prompt: `Step 3 (last pre-aggregation): aggregate \`fact_orders\` to month grain, with one column per status (delivered, cancelled, refunded). The \`FILTER (WHERE ...)\` clause is the clean way to count conditionally.`,
      starterSql: `SELECT
    strftime(order_date, '%Y-%m') AS month,
    COUNT(*) FILTER (WHERE order_status = 'delivered') AS delivered_orders,
    COUNT(*) FILTER (WHERE order_status = 'cancelled') AS cancelled_orders,
    COUNT(*) FILTER (WHERE order_status = 'refunded')  AS refunded_orders
FROM fact_orders
GROUP BY strftime(order_date, '%Y-%m')
ORDER BY month;`,
      validate: (s) =>
        lastQuerySucceeded(s) &&
        lastQueryRowCountEquals(s, 2) &&
        lastQueryContainsRow(s, { month: '2024-03', delivered_orders: 2, cancelled_orders: 1, refunded_orders: 0 }) &&
        lastQueryContainsRow(s, { month: '2024-04', delivered_orders: 2, cancelled_orders: 0, refunded_orders: 1 }),
      explanation: `March: 2 delivered, 1 cancelled (O003 — the one whose payment failed). April: 2 delivered, 1 refunded (O006). All three pre-aggregations are now defined; we have three "monthly" rectangles ready to be joined on the \`month\` key. None of them has finer-than-monthly grain anymore, so the join can't fan-out.`,
    },
    {
      kind: 'checkpoint',
      id: 'why-aggregate-first',
      question: `Why are we aggregating each fact (items, payments, orders) separately to month grain *before* joining them, instead of doing one big JOIN of the three raw facts and aggregating at the end?`,
      options: [
        'It\'s faster — DuckDB optimizes pre-aggregated CTEs better than raw joins',
        'To avoid fan-out: joining the raw facts together would multiply rows across grains and silently break every SUM. Pre-aggregating to a shared grain makes the join safe.',
        'Because the mart needs all three sources',
        'It makes the SQL more readable',
      ],
      correctIndex: 1,
      explanation: `This is the exact discipline you proved in Lesson 6: \`SUM(p.amount)\` after a JOIN to items returned 1800, not 1060, because the JOIN fanned each payment across line items. The cure is to **never combine facts at different grains**. Aggregate each one to the shared grain (\`month\`), and *then* combine the rectangles — at that point every table has one row per month and the JOIN can't multiply anything. This is the universal mart build pattern.`,
    },
    {
      kind: 'sql',
      id: 'build-the-mart',
      prompt: `**The final step.** Wrap your three monthly aggregations as CTEs, \`LEFT JOIN\` them all on \`month\`, and persist the result as \`mart_monthly_sales\`. The \`COALESCE\` wraps protect against months where one of the three sources happened to be empty (defensive — they all have data here, but the pattern generalizes).`,
      starterSql: `CREATE OR REPLACE TABLE mart_monthly_sales AS
WITH items_monthly AS (
    SELECT strftime(o.order_date, '%Y-%m') AS month,
           SUM(i.item_amount) AS gross_sales
    FROM fact_order_items i
    JOIN fact_orders o ON o.order_id = i.order_id
    WHERE o.order_status <> 'cancelled'
    GROUP BY strftime(o.order_date, '%Y-%m')
),
payments_monthly AS (
    SELECT strftime(payment_date, '%Y-%m') AS month,
           SUM(CASE WHEN payment_status = 'paid'     THEN amount  ELSE 0 END) AS paid_revenue,
           COUNT(DISTINCT CASE WHEN payment_status = 'paid' THEN order_id END) AS paid_orders,
           SUM(CASE WHEN payment_status = 'refunded' THEN -amount ELSE 0 END) AS refunded_amount
    FROM fact_payments
    GROUP BY strftime(payment_date, '%Y-%m')
),
orders_monthly AS (
    SELECT strftime(order_date, '%Y-%m') AS month,
           COUNT(*) FILTER (WHERE order_status = 'delivered') AS delivered_orders,
           COUNT(*) FILTER (WHERE order_status = 'cancelled') AS cancelled_orders,
           COUNT(*) FILTER (WHERE order_status = 'refunded')  AS refunded_orders
    FROM fact_orders
    GROUP BY strftime(order_date, '%Y-%m')
)
SELECT
    i.month,
    COALESCE(i.gross_sales,      0) AS gross_sales,
    COALESCE(p.paid_revenue,     0) AS paid_revenue,
    COALESCE(p.paid_orders,      0) AS paid_orders,
    COALESCE(p.refunded_amount,  0) AS refunded_amount,
    COALESCE(o.delivered_orders, 0) AS delivered_orders,
    COALESCE(o.cancelled_orders, 0) AS cancelled_orders,
    COALESCE(o.refunded_orders,  0) AS refunded_orders
FROM items_monthly i
LEFT JOIN payments_monthly p ON p.month = i.month
LEFT JOIN orders_monthly   o ON o.month = i.month
ORDER BY i.month;

SELECT * FROM mart_monthly_sales ORDER BY month;`,
      validate: (s) =>
        lastQuerySucceeded(s) &&
        tableExists(s, 'mart_monthly_sales') &&
        lastQueryRowCountEquals(s, 2) &&
        lastQueryContainsRow(s, {
          month: '2024-03',
          gross_sales: 460,
          paid_revenue: 460,
          paid_orders: 2,
          refunded_amount: 0,
          delivered_orders: 2,
          cancelled_orders: 1,
          refunded_orders: 0,
        }) &&
        lastQueryContainsRow(s, {
          month: '2024-04',
          gross_sales: 600,
          paid_revenue: 600,
          paid_orders: 3,
          refunded_amount: 200,
          delivered_orders: 2,
          cancelled_orders: 0,
          refunded_orders: 1,
        }),
      explanation: `**Two rows. That's the mart.** Every modeling decision from lessons 1-6 is now compressed into one query: grain (month), classification (orders → fact, customer → dim), data trust (\`unique\` on the PKs), join safety (pre-aggregated at the shared grain). The mart is the *product*; everything else was scaffolding. From here on, a stakeholder writes one SELECT and gets every monthly number that matters.`,
    },
    {
      kind: 'checkpoint',
      id: 'ytd-aov-from-mart',
      question: `Your mart has monthly \`paid_revenue\` and \`paid_orders\`. A stakeholder asks for **year-to-date AOV** across both months. What's the correct formula?`,
      options: [
        'Average the two monthly AOVs together: ((460/2) + (600/3)) / 2 = 215',
        'Sum the monthly revenues, sum the monthly order counts, then divide: SUM(paid_revenue) / SUM(paid_orders) = 1060 / 5 = 212',
        'The mart can\'t answer this — go back to `fact_payments`',
        'Take the larger of the two monthly AOVs (230) as a conservative estimate',
      ],
      correctIndex: 1,
      explanation: `**1060 / 5 = 212.** Averaging the monthly AOVs gives 215 — wrong, because AOV is a *ratio* and ratios are **non-additive**. The mart stores the ingredients (\`paid_revenue\` and \`paid_orders\`); any consumer recomputes the ratio at any grouping they need. This is exactly why we kept AOV *out* of the mart in the first place. Every discipline — grain, classification, join safety, additivity — converges into a mart any stakeholder can query in one line. One thing is still missing, though: this mart only slices by *time*. The last lesson puts the dims you built to work, slicing the same facts by any attribute you like.`,
    },
  ],
}

export default lesson07
