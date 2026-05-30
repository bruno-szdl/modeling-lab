import type { Lesson } from '../engine/types'
import {
  lastQuerySucceeded,
  lastQueryRowCountEquals,
  lastQueryContainsRow,
} from '../engine/validators'
import { DATASHOP_SEEDS } from '../seeds'
import sketch from '../sketches/lesson05.svg?raw'

/**
 * Lesson 5 — Joins that don't break grain.
 *
 * Maps to notebook 04b. Teaches the "joins that LOSE rows" half of join
 * correctness:
 *   - LEFT JOIN is the analytics default (keeps "everyone")
 *   - INNER JOIN silently drops the unmatched
 *   - WHERE vs ON for right-side filters — the silent-collapse bug
 *   - COALESCE to clean NULLs from LEFT JOIN output
 *   - anti-join via `LEFT JOIN ... WHERE right IS NULL`
 *
 * The mirror image — a non-unique key on the RIGHT side that MULTIPLIES
 * rows (6 -> 8) — opens lesson 6, where that same multiplication lands on
 * a metric and becomes fan-out. Keeping "lose rows" here and "multiply
 * rows" there makes each lesson exactly one idea.
 *
 * The DataShop dataset is too tidy on its own — every customer has at
 * least one order, every product has sold at least once — so anti-joins
 * and LEFT/INNER contrasts would be empty. We pre-materialize a phantom
 * customer "Eve" (C999) with no orders. She's the demonstration target:
 * she vanishes under INNER JOIN and under misplaced WHERE filters,
 * survives under LEFT JOIN with the filter in ON.
 *
 * Expected revenue numbers (no filter):
 *   Ana   380 (O001 + O003)
 *   Bruno 480 (O002 + O006)
 *   Clara 280 (O004)
 *   Diego 120 (O005)
 *   Eve     0 (no orders)
 *
 * With `order_status <> 'cancelled'` excluded (in ON):
 *   Ana   180 (O003 was cancelled; she keeps O001 = 100 + 80)
 *   Bruno 480 (his refunded order O006 is NOT cancelled, still counts)
 *   Clara 280
 *   Diego 120
 *   Eve     0
 */
const lesson05: Lesson = {
  id: 5,
  title: `Joins that don't break grain`,
  schemaSketch: { svg: sketch, alt: 'Two Venn-style diagrams side by side: LEFT JOIN (all of set A plus the intersection with B, highlighted in accent) and INNER JOIN (only the intersection of A and B, highlighted)' },
  concept: `**\`LEFT JOIN\` is the default for analytics.** It keeps every row on the left, even when nothing matches on the right. \`INNER JOIN\` is the special case — reserved for "the row is useless without a match" (e.g. an item must have a product).

Three patterns to internalize:

1. **\`LEFT JOIN\` to keep "everyone".** Useful whenever "no activity" is itself a valid answer — customers with zero spend, products that never sold, days with no sales.
2. **\`WHERE\` vs \`ON\` for filters on the right side.** A right-side filter in \`WHERE\` silently turns your LEFT JOIN into an INNER (NULL rows from non-matches fail the filter and disappear). Move it to \`ON\` and the row survives the join with NULLs where the match didn't happen.
3. **Anti-join** — \`LEFT JOIN ... WHERE right.column IS NULL\` finds the rows on the left that didn't match anything. "Find the missing" is the most common shape this takes.

A join can break grain in *two* directions. This lesson is about the first: keeping rows you'd otherwise **lose**. The mirror image — a join that silently **multiplies** rows, because the key isn't unique on the right side — opens the next lesson, where that same multiplication lands on a metric and becomes **fan-out**. A JOIN is only ever as trustworthy as the grain of the table on each side of it.`,
  dbtBridge: `dbt doesn't change JOIN syntax — it's plain SQL. But a \`relationships\` test catches *referential* slips (an FK pointing at a row that no longer exists) before they show up as silent JOIN bugs. And almost every \`models/marts/*.sql\` starts with a LEFT JOIN from a "spine" (a dim or a calendar), so dashboards don't silently lose days or customers.`,
  seeds: DATASHOP_SEEDS,
  // The DataShop is too tidy for an honest LEFT-vs-INNER demo: every
  // customer has at least one order. Add Eve (C999) with no orders so the
  // contrasts produce visibly different row counts.
  preMaterialize: [
    `CREATE OR REPLACE TABLE dim_customers AS
       SELECT * FROM raw_customers
       UNION ALL
       SELECT 'C999', 'Eve Phantom', 'Recife', 'PE', DATE '2024-05-01'`,
    `CREATE OR REPLACE TABLE fact_orders AS
       SELECT order_id, customer_id, order_date, order_status FROM raw_orders`,
    `CREATE OR REPLACE TABLE fact_order_items AS
       SELECT order_item_id, order_id, product_id, quantity, unit_price,
              quantity * unit_price AS item_amount
       FROM raw_order_items`,
  ],
  steps: [
    {
      kind: 'sql',
      id: 'inner-join-loses-eve',
      prompt: `Total spent per customer, **\`INNER JOIN\`** through dim → fact_orders → fact_order_items. There are **5** customers in \`dim_customers\` (Ana, Bruno, Clara, Diego, and a new one named Eve who joined last week and hasn't ordered yet). Run the query and count the rows.`,
      starterSql: `SELECT
    c.customer_name,
    SUM(i.item_amount) AS total_spent
FROM dim_customers c
INNER JOIN fact_orders      o ON o.customer_id = c.customer_id
INNER JOIN fact_order_items i ON i.order_id    = o.order_id
GROUP BY c.customer_name
ORDER BY total_spent DESC;`,
      validate: (s) =>
        lastQuerySucceeded(s) &&
        lastQueryRowCountEquals(s, 4),
      explanation: `**4 rows, not 5.** Eve is missing — she has no row in \`fact_orders\`, so the INNER JOIN drops her silently. This is the killer: the query *worked*, no error, no warning. But "customers with no spend" is a perfectly valid bucket, and INNER JOIN can't represent it. If your dashboard says you have 4 customers when you actually have 5, you'll explain that gap to a stakeholder later.`,
    },
    {
      kind: 'sql',
      id: 'left-join-coalesce',
      prompt: `Fix it. Switch both joins to \`LEFT JOIN\`, and wrap the \`SUM\` in \`COALESCE(..., 0)\` so Eve shows 0 instead of NULL. You should now see **5** rows.`,
      starterSql: `SELECT
    c.customer_name,
    SUM(i.item_amount) AS total_spent
FROM dim_customers c
INNER JOIN fact_orders      o ON o.customer_id = c.customer_id
INNER JOIN fact_order_items i ON i.order_id    = o.order_id
GROUP BY c.customer_name
ORDER BY total_spent DESC NULLS LAST;`,
      hint: `Change both \`INNER JOIN\`s to \`LEFT JOIN\`. Then replace \`SUM(i.item_amount)\` with \`COALESCE(SUM(i.item_amount), 0)\`.`,
      solution: `SELECT
    c.customer_name,
    COALESCE(SUM(i.item_amount), 0) AS total_spent
FROM dim_customers c
LEFT JOIN fact_orders      o ON o.customer_id = c.customer_id
LEFT JOIN fact_order_items i ON i.order_id    = o.order_id
GROUP BY c.customer_name
ORDER BY total_spent DESC NULLS LAST;`,
      validate: (s) =>
        lastQuerySucceeded(s) &&
        lastQueryRowCountEquals(s, 5) &&
        lastQueryContainsRow(s, { customer_name: 'Eve Phantom', total_spent: 0 }) &&
        lastQueryContainsRow(s, { customer_name: 'Bruno Costa', total_spent: 480 }),
      explanation: `**5 rows.** Eve appears with \`total_spent = 0\`. The two changes do different things: \`LEFT JOIN\` keeps Eve in the result set; \`COALESCE\` turns the resulting NULL into a 0 so it reads cleanly. Without COALESCE, Eve would still appear — just with a NULL — which is honest, but ugly in a dashboard.`,
    },
    {
      kind: 'checkpoint',
      id: 'when-inner-when-left',
      question: `When *should* you actually use \`INNER JOIN\` in an analytics query?`,
      options: [
        'Never — `LEFT JOIN` is always safer',
        'When the right-side table is smaller than the left',
        'When a row with no match on the right is genuinely meaningless to the question (e.g. an order item with no product)',
        'When you want results faster — INNER is more performant',
      ],
      correctIndex: 2,
      explanation: `\`INNER JOIN\` is right exactly when an unmatched left row is *not* an interesting answer. An order item without a product can't sell anything — drop it. A customer without orders **is** an interesting answer (zero spend is a number) — keep them with LEFT. The trap is using INNER by reflex; the win is using it *deliberately*.`,
    },
    {
      kind: 'sql',
      id: 'where-vs-on',
      prompt: `Now exclude **cancelled** orders from the calculation. The starter has the filter in \`WHERE\` — run it first and notice that **Eve disappears again** (down to 4 rows). Then move the filter into \`ON\` so Eve survives. Ana's number should drop from 380 to 180 (her cancelled order O003 stops counting), while Eve stays at 0.`,
      starterSql: `SELECT
    c.customer_name,
    COALESCE(SUM(i.item_amount), 0) AS total_spent
FROM dim_customers c
LEFT JOIN fact_orders      o ON o.customer_id = c.customer_id
LEFT JOIN fact_order_items i ON i.order_id    = o.order_id
WHERE o.order_status <> 'cancelled'
GROUP BY c.customer_name
ORDER BY total_spent DESC NULLS LAST;`,
      hint: `Delete the \`WHERE\` clause and add \` AND o.order_status <> 'cancelled'\` to the first \`LEFT JOIN\`'s \`ON\` clause.`,
      solution: `SELECT
    c.customer_name,
    COALESCE(SUM(i.item_amount), 0) AS total_spent
FROM dim_customers c
LEFT JOIN fact_orders      o
       ON o.customer_id = c.customer_id
      AND o.order_status <> 'cancelled'
LEFT JOIN fact_order_items i ON i.order_id    = o.order_id
GROUP BY c.customer_name
ORDER BY total_spent DESC NULLS LAST;`,
      validate: (s) =>
        lastQuerySucceeded(s) &&
        lastQueryRowCountEquals(s, 5) &&
        lastQueryContainsRow(s, { customer_name: 'Eve Phantom', total_spent: 0 }) &&
        lastQueryContainsRow(s, { customer_name: 'Ana Lima', total_spent: 180 }),
      explanation: `Why did Eve drop with \`WHERE\`? After the LEFT JOIN, Eve's \`order_status\` was \`NULL\` (she has no order). \`NULL <> 'cancelled'\` evaluates to \`NULL\` — which fails the WHERE filter — so the row is dropped. Move the filter to \`ON\` and it now decides "does this right row match?" — Eve's right row simply doesn't match, but the LEFT JOIN still keeps her with NULLs. **Rule of thumb: any filter that references the right-side table of a LEFT JOIN belongs in \`ON\`, not \`WHERE\`.**`,
    },
    {
      kind: 'checkpoint',
      id: 'where-or-on',
      question: `You \`LEFT JOIN\` customers to payments. You want to exclude \`payment_status = 'failed'\`. Where does the filter go to keep customers with no payments at all?`,
      options: [
        '`WHERE p.payment_status <> \'failed\'`',
        '`ON ... AND p.payment_status <> \'failed\'`',
        'Either works — the LEFT JOIN protects either way',
        'In a `HAVING` clause after the GROUP BY',
      ],
      correctIndex: 1,
      explanation: `Same shape as the previous step. A right-side filter in \`WHERE\` drops the NULL rows (the customers who *have* no payments at all) along with the failed ones, silently collapsing your LEFT JOIN into an INNER. Put the filter in \`ON\` — failed payments don't match, the customer survives the join, and "no payments" stays a legitimate result.`,
    },
    {
      kind: 'sql',
      id: 'anti-join',
      prompt: `Last pattern: the **anti-join**. Find every customer in \`dim_customers\` who has *no* row in \`fact_orders\` — i.e. has never ordered. The trick: \`LEFT JOIN\`, then \`WHERE\` on the *right* side being NULL.`,
      starterSql: `SELECT c.customer_id, c.customer_name
FROM dim_customers c
LEFT JOIN fact_orders o ON o.customer_id = c.customer_id
-- TODO: keep only rows where the right side didn't match
;`,
      hint: `Add \`WHERE o.order_id IS NULL\` (or any non-nullable column from \`fact_orders\`).`,
      solution: `SELECT c.customer_id, c.customer_name
FROM dim_customers c
LEFT JOIN fact_orders o ON o.customer_id = c.customer_id
WHERE o.order_id IS NULL;`,
      validate: (s) =>
        lastQuerySucceeded(s) &&
        lastQueryRowCountEquals(s, 1) &&
        lastQueryContainsRow(s, { customer_id: 'C999' }),
      explanation: `One row: Eve. The pattern reads "give me every left row that *didn't* match anything on the right." Read it once and it's obvious; the first time you see it, it looks like magic. Anti-joins are the backbone of "find the missing" queries: products that never sold, customers who churned, days with no traffic. Whenever a stakeholder asks "what *isn't* happening?" — this is your shape.

That's the "lose rows" half of join correctness. The opposite failure — a join that silently *multiplies* rows — opens the next lesson, and from there it's a short step to the most expensive bug in analytics.`,
    },
  ],
}

export default lesson05
