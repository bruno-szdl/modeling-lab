import type { Lesson } from '../engine/types'
import {
  lastQuerySucceeded,
  lastQueryRowCountEquals,
  lastQueryColumnsEqual,
  lastQueryHasColumns,
  lastQueryContainsRow,
  lastQueryScalarEquals,
  tableExists,
} from '../engine/validators'
import { DATASHOP_SEEDS } from '../seeds'

/**
 * Lesson 4 — Facts.
 *
 * Maps to notebook 04. Teaches:
 *   - a fact is one row per event: FKs + metrics, almost nothing else
 *   - two facts can share an entity but have different grains (orders vs
 *     order items) — and that's a feature, not a problem to merge away
 *   - the DUPLICATED-DIM DEMO (6 -> 8 rows) is the headline aha: a JOIN
 *     is only as safe as the PK on its right side
 *
 * dim_customers and dim_products are pre-materialized here (the learner
 * built them in lesson 3); this lesson focuses on the fact side.
 *
 * Reference data (DataShop):
 *   raw_orders        6 rows
 *   raw_order_items   9 rows  (3 orders carry multiple items)
 *   raw_payments      7 rows  (6 distinct order_ids — O006 has 2 payments)
 *   C002 (Bruno)      has 2 orders → duplicating his dim row inflates the
 *                     fact_orders×dim_customers JOIN from 6 to 8 rows.
 */
const lesson04: Lesson = {
  id: 4,
  title: 'Facts',
  concept: `A **fact** table is one row per **event** — an order placed, a line item, a payment received. It carries:

- **Foreign keys** to dims (\`customer_id\`, \`product_id\`).
- **Metrics** you'll aggregate (\`quantity\`, \`amount\`, \`item_amount\`).
- A few **event-level attributes** that belong to the event itself, not to an entity (\`order_date\`, \`order_status\`).
- **Almost nothing else.** No \`customer_name\` here — that lives in \`dim_customers\`. The fact carries the *foreign key*; the name comes back through a JOIN at query time.

Facts grow forever as events happen — that's their shape. The discipline is to keep them lean: clean grain, metrics ready to \`SUM\`, attributes pushed out to dims where they can be edited in one place.

Two facts can share an entity but live at **different grains**. \`fact_orders\` is "one order"; \`fact_order_items\` is "one line on an order". Don't merge them — different grains answer different questions.`,
  dbtBridge: `Facts live at \`models/marts/fact_*.sql\`. A \`unique\` + \`not_null\` test on the fact's PK locks the grain; a \`relationships\` test on each FK (pointing back to its dim) turns referential integrity from a hope into a query.`,
  seeds: DATASHOP_SEEDS,
  // dim_customers and dim_products were the work of lesson 3; pre-build
  // them here so this lesson can focus on facts (and so the duplicate-dim
  // demo has something to corrupt).
  preMaterialize: [
    `CREATE OR REPLACE TABLE dim_customers AS SELECT * FROM raw_customers`,
    `CREATE OR REPLACE TABLE dim_products AS SELECT * FROM raw_products`,
  ],
  steps: [
    {
      kind: 'sql',
      id: 'build-fact-orders',
      prompt: `Build \`fact_orders\`: keys, the event-level attributes (\`order_date\`, \`order_status\`) — and nothing else. Notice what's *not* there: \`customer_name\`, \`city\`, anything descriptive about the customer.`,
      starterSql: `CREATE OR REPLACE TABLE fact_orders AS
SELECT
    order_id,
    customer_id,
    order_date,
    order_status
FROM raw_orders;

SELECT * FROM fact_orders ORDER BY order_id;`,
      validate: (s) =>
        lastQuerySucceeded(s) &&
        tableExists(s, 'fact_orders') &&
        lastQueryRowCountEquals(s, 6) &&
        lastQueryColumnsEqual(s, ['order_id', 'customer_id', 'order_date', 'order_status']),
      explanation: `Six rows (one per order), four columns. \`fact_orders\` looks *skinny* on purpose. Every report that needs the customer's name will JOIN to \`dim_customers\` on \`customer_id\` — no need to carry the name around.`,
    },
    {
      kind: 'checkpoint',
      id: 'why-no-customer-name',
      question: `Why isn't \`customer_name\` a column on \`fact_orders\`?`,
      options: [
        'We forgot it; it should be there for convenience',
        'Facts can\'t hold text columns at all — only numbers',
        'It would duplicate the name onto every order row, and drift when the customer\'s name changes. The dim owns it; the fact looks it up via JOIN.',
        'Facts only hold metrics, never identifiers',
      ],
      correctIndex: 2,
      explanation: `If a customer has 50 orders, putting their name on \`fact_orders\` means storing the name 50 times. Then they email about a misspelling, you fix it in \`dim_customers\` — and \`fact_orders\` still has the old spelling on 50 rows. **One fact for what happened, one dim for who it happened to.** Connect them with the FK.`,
    },
    {
      kind: 'sql',
      id: 'build-fact-order-items',
      prompt: `Build \`fact_order_items\` at line-level grain — one row per (order, product) pair, with a derived \`item_amount\` (the metric you'll actually \`SUM\`). The raw table has \`quantity\` and \`unit_price\` but no pre-computed total; we derive it here so every downstream report uses the same definition.`,
      starterSql: `CREATE OR REPLACE TABLE fact_order_items AS
SELECT
    order_item_id,
    order_id,
    product_id,
    quantity,
    unit_price,
    -- TODO: add item_amount = quantity * unit_price
FROM raw_order_items;

SELECT * FROM fact_order_items ORDER BY order_item_id;`,
      hint: `\`quantity * unit_price AS item_amount\``,
      solution: `CREATE OR REPLACE TABLE fact_order_items AS
SELECT
    order_item_id,
    order_id,
    product_id,
    quantity,
    unit_price,
    quantity * unit_price AS item_amount
FROM raw_order_items;

SELECT * FROM fact_order_items ORDER BY order_item_id;`,
      validate: (s) =>
        lastQuerySucceeded(s) &&
        tableExists(s, 'fact_order_items') &&
        lastQueryRowCountEquals(s, 9) &&
        lastQueryHasColumns(s, ['item_amount']) &&
        lastQueryContainsRow(s, { order_item_id: 'OI008', item_amount: 120 }) &&
        lastQueryContainsRow(s, { order_item_id: 'OI001', item_amount: 100 }),
      explanation: `Nine rows — one per line item. \`fact_orders\` has 6 rows; \`fact_order_items\` has 9. Same entity (orders), **different grains.** That's by design: "how many orders did we ship in March?" is a \`fact_orders\` question; "how many units of P002 did we sell?" is a \`fact_order_items\` question. Don't try to answer both from one table.`,
    },
    {
      kind: 'sql',
      id: 'duplicated-dim-demo',
      prompt: `**Predict, then run.** \`fact_orders\` has 6 rows. Now imagine a data quality slip: a duplicate Bruno (\`C002\`) row gets inserted into \`dim_customers\`. What does \`COUNT(*)\` return for the JOIN below — 6, 7, or 8?`,
      starterSql: `-- Corrupt the dim: insert a duplicate of Bruno (C002).
INSERT INTO dim_customers
SELECT customer_id, customer_name || ' (dup)', city, state, signup_date
FROM dim_customers WHERE customer_id = 'C002';

-- Now COUNT the rows of the JOIN. Predict before running!
SELECT COUNT(*) AS join_row_count
FROM fact_orders f
JOIN dim_customers c ON f.customer_id = c.customer_id;`,
      validate: (s) =>
        lastQuerySucceeded(s) &&
        lastQueryScalarEquals(s, 8),
      explanation: `**8 rows.** Bruno has 2 orders (O002 and O006). Each one now matches *two* dim rows (the original + the duplicate), so Bruno contributes 4 rows instead of 2. The other 4 orders are unaffected. Total: 4 + 4 = 8. This is the silent killer of analytics queries — your JOIN looked safe, but the dim's PK wasn't actually unique. **A JOIN is only as trustworthy as the \`unique\` constraint on its right side.** The grain test from lesson 1 (\`COUNT(*) = COUNT(DISTINCT key)\`) is what catches this.`,
    },
    {
      kind: 'sql',
      id: 'fact-payments-grain',
      prompt: `One more fact: \`fact_payments\`. Build it (a simple copy works here — \`raw_payments\` already has the right shape), then prove its grain in the same SELECT: row count and distinct \`payment_id\`s should match; \`order_id\` distinct count should be one less.`,
      starterSql: `CREATE OR REPLACE TABLE fact_payments AS
SELECT * FROM raw_payments;

-- TODO: prove the grain — return total_rows, distinct_payment_ids, distinct_orders
SELECT
    COUNT(*)                   AS total_rows,
    COUNT(DISTINCT payment_id) AS distinct_payment_ids,
    COUNT(DISTINCT order_id)   AS distinct_orders
FROM fact_payments;`,
      validate: (s) =>
        lastQuerySucceeded(s) &&
        tableExists(s, 'fact_payments') &&
        lastQueryContainsRow(s, { total_rows: 7, distinct_payment_ids: 7, distinct_orders: 6 }),
      explanation: `7 rows, 7 distinct payments, but only 6 distinct orders — because order **O006** has two payment rows (a \`paid\` and a \`refunded\`). The grain of \`fact_payments\` is therefore "one payment", *not* "one order". If you were to count "orders that received any payment" by counting \`fact_payments\` rows, you'd over-count by one. Always check.`,
    },
    {
      kind: 'checkpoint',
      id: 'which-fact-for-units',
      question: `A product manager asks: **"how many *units* of each product did we sell?"** Which fact answers this?`,
      options: [
        '\`fact_orders\` — count rows per product',
        '\`fact_order_items\` — \`SUM(quantity)\` grouped by \`product_id\`',
        '\`fact_payments\` — divide \`amount\` by \`unit_price\`',
        '\`dim_products\` — it has all the products',
      ],
      correctIndex: 1,
      explanation: `Units sold means **summing the \`quantity\` metric** at the line-item grain — that's \`fact_order_items\`. \`fact_orders\` doesn't have a quantity column (the grain is wrong: one order can contain multiple products). \`fact_payments\` knows about money, not units. \`dim_products\` doesn't know about sales at all. **Always pick the fact whose grain matches the question.**`,
    },
  ],
}

export default lesson04
