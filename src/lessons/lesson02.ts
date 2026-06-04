import type { Lesson } from '../engine/types'
import {
  lastQuerySucceeded,
  lastQueryRowCountEquals,
  lastQueryContainsRow,
  lastQueryHasColumns,
} from '../engine/validators'
import { DATASHOP_SEEDS } from '../seeds'
import sketch from '../sketches/lesson02.svg?raw'

/**
 * Lesson 2 — Entities, events, column roles.
 *
 * Maps to notebook 02. Teaches the mental map that lessons 3 (dims) and 4
 * (facts) build on:
 *
 *   entity   →  dim       attribute  →  dim column
 *   event    →  fact      metric     →  fact column
 *
 * Three categories matter:
 *   - entity            (raw_customers, raw_products)
 *   - event             (raw_orders, raw_payments) — has a date
 *   - detail of event   (raw_order_items) — exists only because an event did
 *
 * The signup_date trick: it *looks* like an event but it's an attribute of
 * the customer. The heuristic "events have dates" needs the corollary
 * "but not every date is an event."
 */
const lesson02: Lesson = {
  id: 2,
  title: 'Entities, events, column roles',
  schemaSketch: { svg: sketch, alt: 'Two boxes side by side: raw_customers (an entity, no date column) and raw_payments (an event, with payment_date highlighted)' },
  concept: `Tables come in three kinds:

- **Entity** — a thing that *exists*: customers, products. A stable, small set of "things," with no "this happened on…" column.
- **Event** — a thing that *happened*: orders, payments. Every row is tied to a moment, so it always carries a date.
- **Detail of an event** — the line items on an order. Not an event itself, but it only exists because one happened.

A quick heuristic: events have a date, entities don't (but watch out — not every date column makes a table an event).

Inside each table, every column plays one of three roles:

- **Identifier** (PK or FK) — links rows together: \`customer_id\`, \`order_id\`.
- **Descriptive attribute** — tells you *about* the row: \`customer_name\`, \`payment_status\`. You group by it, filter by it; you never \`SUM\` it.
- **Metric** — something you measure: \`quantity\`, \`amount\`. You aggregate it.

Why does this matter? It's the mental map for the next three lessons: **entity → dim, event → fact, attribute → dim column, metric → fact column.**`,
  seeds: DATASHOP_SEEDS,
  steps: [
    {
      kind: 'sql',
      id: 'inspect-entity',
      prompt: `Start with an entity. Run the SELECT below and read the rows. Notice what's there — and, more importantly, what *isn't*.`,
      starterSql: `SELECT * FROM raw_customers;`,
      validate: (s) =>
        lastQuerySucceeded(s) && lastQueryRowCountEquals(s, 4),
      explanation: `Four rows, one per customer. There's a \`signup_date\` (we'll come back to it), but **no column that says "this row happened on…"** Customers just *exist*. That's an entity: a stable, small set of "things."`,
    },
    {
      kind: 'sql',
      id: 'inspect-event',
      prompt: `Now look at an event table. Same query, different table.`,
      starterSql: `SELECT * FROM raw_payments;`,
      validate: (s) =>
        lastQuerySucceeded(s) && lastQueryRowCountEquals(s, 7),
      explanation: `Seven rows, every one with a \`payment_date\`. Every row is *something that happened, at a time*. That's the defining shape of an event: dates aren't optional, they're the point.`,
    },
    {
      kind: 'checkpoint',
      id: 'classify-order-items',
      question: `In Lesson 1 you proved one row of \`raw_order_items\` is a **line item** — one (order, product) pair, with no date of its own. It carries an \`order_id\` but no \`item_date\`. Which of the three categories does that make it?`,
      options: [
        'An entity, like a catalog of all items that could be sold',
        'An event, because items get sold over time',
        'A detail of an event — line items on an order, which only exist because the order did',
        'A data quality bug; this table should have a date column',
      ],
      correctIndex: 2,
      explanation: `Order items are tied to an order *event* but carry no date of their own — they inherit it through the FK. That's the third category: **detail of event**. Lesson 4 (Facts) treats it the same way as an event, because the grain is "one line item of one order".`,
    },
    {
      kind: 'checkpoint',
      id: 'signup-date-trick',
      question: `Back to \`raw_customers\`: \`signup_date\` is a date column. So is the table actually an event, not an entity?`,
      options: [
        'Yes — anything with a date is an event',
        'No — `signup_date` is a descriptive attribute of the customer, like their name or city; it just happens to be a date',
        'Half-and-half — it\'s an entity with an event mixed in',
        'It depends on whether the signup is more recent than the order',
      ],
      correctIndex: 1,
      explanation: `A date column doesn't make a table an event. What matters is **what one row represents**. A \`raw_customers\` row is *the customer*, not "the customer's signup event." If you wanted signups as events, you'd have a \`raw_signups\` table with one row per signup. The heuristic "events have dates" is true; the reverse ("anything with a date is an event") isn't.`,
    },
    {
      kind: 'sql',
      id: 'distinct-statuses',
      prompt: `Time to classify column *roles*. List every distinct value of \`payment_status\` in \`raw_payments\`. You should see exactly 3.`,
      starterSql: `SELECT DISTINCT payment_status FROM raw_payments;`,
      validate: (s) =>
        lastQuerySucceeded(s) &&
        lastQueryHasColumns(s, ['payment_status']) &&
        lastQueryRowCountEquals(s, 3) &&
        lastQueryContainsRow(s, { payment_status: 'paid' }) &&
        lastQueryContainsRow(s, { payment_status: 'refunded' }) &&
        lastQueryContainsRow(s, { payment_status: 'failed' }),
      explanation: `Three values: \`paid\`, \`refunded\`, \`failed\`. A column with a small, closed set of text values is **categorical** — and categorical columns are descriptive attributes. You group by them, you filter on them, you never \`SUM\` them. That's the test for "attribute" in one sentence.`,
    },
    {
      kind: 'sql',
      id: 'sum-the-metric',
      prompt: `Last one: prove which column is the **metric** by actually using it. Group \`raw_payments\` by \`payment_status\` (the attribute) and \`SUM\` the \`amount\` (the metric) — one row per status, with a count and a total. Mentally swap \`amount\` for \`payment_id\` as you write it: \`SUM(payment_id)\` would be gibberish, and that's the tell.`,
      starterSql: `SELECT
    payment_status,
    COUNT(*) AS payments
    -- TODO: add SUM(amount) AS total_amount
FROM raw_payments
GROUP BY payment_status
ORDER BY payments DESC;`,
      hint: `Add \`, SUM(amount) AS total_amount\` after the count (mind the comma).`,
      solution: `SELECT
    payment_status,
    COUNT(*)    AS payments,
    SUM(amount) AS total_amount
FROM raw_payments
GROUP BY payment_status
ORDER BY payments DESC;`,
      validate: (s) =>
        lastQuerySucceeded(s) &&
        lastQueryRowCountEquals(s, 3) &&
        lastQueryHasColumns(s, ['payment_status', 'total_amount']) &&
        lastQueryContainsRow(s, { payment_status: 'paid', payments: 5, total_amount: 1060 }) &&
        lastQueryContainsRow(s, { payment_status: 'refunded', total_amount: -200 }),
      explanation: `**paid 1060, failed 0, refunded -200.** You just used the two roles together: you \`GROUP BY\` the **attribute** (\`payment_status\`) and \`SUM\` the **metric** (\`amount\`). Swap them and it breaks — \`SUM(payment_status)\` is meaningless, and \`GROUP BY amount\` would shatter the table into one group per distinct price. And it's the *role* that decides, not the datatype: \`payment_id\` here is text like \`PAY001\`, so SQL won't even let you \`SUM\` it — but even where a system stores IDs as plain integers, adding them is just as meaningless. The mental rule: **a metric is what you'd put on the y-axis of a chart; an attribute is what you'd put on the x-axis.**`,
    },
    {
      kind: 'checkpoint',
      id: 'numeric-id-trap',
      question: `Some payment systems store \`payment_id\` as a plain integer (1, 2, 3, …) instead of text like \`PAY001\`. If yours did, what would \`SUM(payment_id)\` tell you?`,
      options: [
        'Total revenue across all payments',
        'Nothing meaningful — `payment_id` is an identifier. It is a label that happens to be a number; adding labels together is gibberish. Revenue comes from `SUM(amount)`.',
        'The number of payments, since each has one id',
        'The id of the most recent payment',
      ],
      correctIndex: 1,
      explanation: `A column's **role** decides what you can do with it, not its datatype. Identifiers — numeric or text — are for counting, grouping, and joining, never summing. \`amount\` is the metric you aggregate; \`payment_id\` only points at a row. "Is it a number?" is the trap question; "what is its job?" is the real one.`,
    },
    {
      kind: 'checkpoint',
      id: 'entity-event-map',
      question: `Pulling it together with the map *entity → dim, event → fact*: which pair of raw tables becomes **dimensions**?`,
      options: [
        '`raw_orders` and `raw_payments`',
        '`raw_customers` and `raw_products`',
        '`raw_order_items` and `raw_payments`',
        '`raw_customers` and `raw_orders`',
      ],
      correctIndex: 1,
      explanation: `Entities (customers, products) describe things that *exist* → **dims**. Events (orders, payments) and the detail of an event (order_items) describe things that *happened* → **facts**. That mapping is exactly what the next lessons build: \`dim_customers\` / \`dim_products\` in Lesson 4, then \`fact_orders\` / \`fact_order_items\` / \`fact_payments\` in Lesson 5.`,
    },
  ],
}

export default lesson02
