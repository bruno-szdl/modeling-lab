import type { Lesson } from '../engine/types'
import {
  lastQuerySucceeded,
  lastQueryRowCountEquals,
  lastQueryContainsRow,
  tableExists,
} from '../engine/validators'
import { DATASHOP_SEEDS } from '../seeds'
import sketch from '../sketches/lesson11.svg?raw'

/**
 * Lesson 11 — Slice by any dimension (the capstone payoff).
 *
 * Lesson 10 built mart_monthly_sales: the facts sliced by *time*. But the
 * whole point of building dims + facts (a star) is that the SAME facts can
 * be sliced by any *attribute* with a one-line GROUP BY swap. Until now the
 * dims the learner built in L4 were never used in a deliverable; this lesson
 * is where the star earns its keep.
 *
 * It ties the whole course together:
 *   - L5 star    : FK → PK join brings the dim attribute to the metric
 *   - L8 fan-out : that join is grain-safe *because* product_id is a unique PK
 *   - L7 / 7.5   : to keep a category that never sold, anchor on the dim (spine)
 *
 * Reference numbers (gross_sales = SUM(item_amount), cancelled O003 excluded):
 *   Course     780  (P001/P002)   units 5
 *   Accessory  280  (P003/P004)   units 6
 *   total     1060  = the Lesson 9 gross_sales — the dim join inflates nothing
 *
 * preMaterialize rebuilds the L4/L5 model layer AND the L10 monthly mart, so
 * the finale (<CourseComplete />) can show both marts side by side: same
 * star, two different business questions.
 */
const lesson11: Lesson = {
  id: 11,
  title: 'Slice by any dimension',
  schemaSketch: {
    svg: sketch,
    alt: 'fact_order_items joined to dim_products on product_id (FK to PK), then grouped by the category attribute into a two-row result: Course 780, Accessory 280. Caption: same facts, sliced by an attribute.',
  },
  concept: `The monthly mart answered one shape of question: *how are we doing over time?* But stakeholders ask just as often **what** is doing well — which products, which categories, which regions, which customer segments. This is the moment the star schema you built finally pays off.

The move is the FK→PK join from Lesson 5, now put to work: the **metric** lives once in the fact (\`item_amount\` in \`fact_order_items\`), the **attribute** lives once in the dim (\`category\` in \`dim_products\`), and you join the two on the key to slice the metric by the attribute. Want a different cut? Swap one column in the \`GROUP BY\`. You modeled the data once; now you can slice it forever, and every cut agrees because each attribute has exactly one home.

This is the return on every decision you've made: declare the grain, classify the columns, push attributes into dims, keep facts lean, join without breaking grain. Do that, and "revenue by category", "revenue by price band", "revenue by state" are all one \`GROUP BY\` away — no new modeling, no duplicated rules, no drift.`,
  dbtBridge: `This is *why* dims and facts are their own models in \`marts/\`: dozens of downstream reports join to the same \`dim_products\`, so "category" means one thing everywhere. Define the grain and the attribute once; let every consumer slice it however they need.`,
  seeds: DATASHOP_SEEDS,
  // Rebuild the full model layer the learner assembled across L4/L5, plus the
  // L10 monthly mart, so this lesson can slice the star and the finale can show
  // both marts. Order matters: facts before the mart that aggregates them.
  preMaterialize: [
    `CREATE OR REPLACE TABLE dim_products AS
       SELECT product_id, product_name, category, list_price,
              CASE WHEN list_price >= 100 THEN 'premium' ELSE 'basic' END AS price_band
       FROM raw_products`,
    `CREATE OR REPLACE TABLE fact_orders AS
       SELECT order_id, customer_id, order_date, order_status FROM raw_orders`,
    `CREATE OR REPLACE TABLE fact_order_items AS
       SELECT order_item_id, order_id, product_id, quantity, unit_price,
              quantity * unit_price AS item_amount
       FROM raw_order_items`,
    `CREATE OR REPLACE TABLE fact_payments AS
       SELECT * FROM raw_payments`,
    `CREATE OR REPLACE TABLE mart_monthly_sales AS
       WITH items_monthly AS (
         SELECT strftime(o.order_date, '%Y-%m') AS month, SUM(i.item_amount) AS gross_sales
         FROM fact_order_items i JOIN fact_orders o ON o.order_id = i.order_id
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
       SELECT i.month,
              COALESCE(i.gross_sales, 0)      AS gross_sales,
              COALESCE(p.paid_revenue, 0)     AS paid_revenue,
              COALESCE(p.paid_orders, 0)      AS paid_orders,
              COALESCE(p.refunded_amount, 0)  AS refunded_amount,
              COALESCE(o.delivered_orders, 0) AS delivered_orders,
              COALESCE(o.cancelled_orders, 0) AS cancelled_orders,
              COALESCE(o.refunded_orders, 0)  AS refunded_orders
       FROM items_monthly i
       LEFT JOIN payments_monthly p ON p.month = i.month
       LEFT JOIN orders_monthly   o ON o.month = i.month
       ORDER BY i.month`,
  ],
  steps: [
    {
      kind: 'sql',
      id: 'sales-by-category',
      prompt: `Slice gross sales by **product category**. \`item_amount\` lives in \`fact_order_items\`; \`category\` lives in \`dim_products\`. Join them on \`product_id\`, exclude cancelled orders, and \`GROUP BY\` the category. Two rows come back.`,
      starterSql: `SELECT
    p.category,
    SUM(i.item_amount) AS gross_sales
FROM fact_order_items i
JOIN fact_orders  o ON o.order_id   = i.order_id
JOIN dim_products p ON p.product_id = i.product_id
WHERE o.order_status <> 'cancelled'
GROUP BY p.category
ORDER BY gross_sales DESC;`,
      validate: (s) =>
        lastQuerySucceeded(s) &&
        lastQueryRowCountEquals(s, 2) &&
        lastQueryContainsRow(s, { category: 'Course', gross_sales: 780 }) &&
        lastQueryContainsRow(s, { category: 'Accessory', gross_sales: 280 }),
      explanation: `**Course 780, Accessory 280.** Notice where the pieces came from: the *number* is the metric from \`fact_order_items\`, and the *label* (\`category\`) came from \`dim_products\` via the FK→PK join — you never copied "category" onto the fact. That's the star doing its job. Change a product's category in \`dim_products\` and this slice updates with it; the rule has exactly one home. Swap \`GROUP BY p.category\` for \`GROUP BY p.price_band\` and you'd get premium-vs-basic with zero new modeling — same facts, different cut.`,
    },
    {
      kind: 'checkpoint',
      id: 'dim-join-is-safe',
      question: `You just joined \`fact_order_items\` to \`dim_products\`. In Lesson 8, a JOIN turned 1060 into 1800 (fan-out). Did *this* join inflate \`gross_sales\` the same way?`,
      options: [
        'Yes — any JOIN to another table risks fan-out, so this total is suspect too',
        'No — `product_id` is the primary key of `dim_products`, so each item matched exactly one product row. A FK→PK join into a clean dim can\'t multiply rows.',
        'No — fan-out only ever happens with payments, never with products',
        'Only if some product had been sold more than once',
      ],
      correctIndex: 1,
      explanation: `The Lesson 8 fan-out happened because the key on the *right* side wasn't unique — one payment matched many item rows. Here the right side is \`dim_products\`, keyed on \`product_id\`, and the Lesson 1 grain test proves that key is unique: each line item matches **exactly one** product. So nothing multiplies — the two categories sum to **780 + 280 = 1060**, the very same gross_sales you computed in Lesson 9. A FK→PK join into a dim whose PK is genuinely unique is always grain-safe, and that uniqueness is exactly what dbt's \`unique\` and \`relationships\` tests guard.`,
    },
    {
      kind: 'sql',
      id: 'build-category-mart',
      prompt: `Persist it as a mart. Build \`mart_sales_by_category\` with two metrics per category: \`gross_sales\` and \`units_sold\` (the total quantity). The starter has \`gross_sales\`; add \`units_sold\`.`,
      starterSql: `CREATE OR REPLACE TABLE mart_sales_by_category AS
SELECT
    p.category,
    SUM(i.item_amount) AS gross_sales
    -- TODO: add units_sold = SUM(i.quantity)
FROM fact_order_items i
JOIN fact_orders  o ON o.order_id   = i.order_id
JOIN dim_products p ON p.product_id = i.product_id
WHERE o.order_status <> 'cancelled'
GROUP BY p.category
ORDER BY gross_sales DESC;

SELECT * FROM mart_sales_by_category ORDER BY gross_sales DESC;`,
      hint: `Add \`, SUM(i.quantity) AS units_sold\` after the \`gross_sales\` line (mind the comma).`,
      solution: `CREATE OR REPLACE TABLE mart_sales_by_category AS
SELECT
    p.category,
    SUM(i.item_amount) AS gross_sales,
    SUM(i.quantity)    AS units_sold
FROM fact_order_items i
JOIN fact_orders  o ON o.order_id   = i.order_id
JOIN dim_products p ON p.product_id = i.product_id
WHERE o.order_status <> 'cancelled'
GROUP BY p.category
ORDER BY gross_sales DESC;

SELECT * FROM mart_sales_by_category ORDER BY gross_sales DESC;`,
      validate: (s) =>
        lastQuerySucceeded(s) &&
        tableExists(s, 'mart_sales_by_category') &&
        lastQueryRowCountEquals(s, 2) &&
        lastQueryContainsRow(s, { category: 'Course', gross_sales: 780, units_sold: 5 }) &&
        lastQueryContainsRow(s, { category: 'Accessory', gross_sales: 280, units_sold: 6 }),
      explanation: `\`mart_sales_by_category\` is the **dimension-sliced sibling** of \`mart_monthly_sales\` — same facts, a different cut. And it surfaces a real insight the monthly mart can't: **Accessory moves more units (6) but far less revenue (280)** than Course (5 units, 780). That's the kind of question the star answers in one query. Both marts came from the *same* \`fact_order_items\` and \`dim_products\` — you didn't remodel anything to ask a new question.`,
    },
    {
      kind: 'checkpoint',
      id: 'spine-keeps-empty-category',
      question: `Marketing launches a brand-new **Gift Cards** category next month, but nothing has sold yet. With the query you just wrote, when does *Gift Cards* first show up as a row in this mart?`,
      options: [
        'Immediately — `dim_products` already lists the category',
        'Only after its first sale — the query is anchored on `fact_order_items`, so a category with no items produces no row. To show it at 0 from day one, anchor on `dim_products` and `LEFT JOIN` the fact (the spine pattern from the calendar dim and from Eve in Lesson 7).',
        'Never — a mart can\'t represent a category with zero sales',
        'Immediately, as long as you wrap the SUM in `COALESCE`',
      ],
      correctIndex: 1,
      explanation: `Because the query starts \`FROM fact_order_items\`, it can only show categories that actually sold — the exact "INNER JOIN loses rows" trap from Lesson 7, one layer up. Flip the anchor: \`FROM dim_products p LEFT JOIN fact_order_items i ...\`, gate the metric so no-match rows contribute 0, and every category in the catalog appears whether or not it sold — the same calendar-spine move you made in the side quest, the same \`LEFT JOIN\` that kept Eve. **The dim is the spine; the fact fills it in.**

And that's the whole lab in one sentence: you modeled grain-honest dims and facts *once*, and now you slice the same numbers by **time** (Lesson 10) or by **any attribute** (here) — adding a new cut never means re-modeling. That is what the star bought you.`,
    },
  ],
}

export default lesson11
