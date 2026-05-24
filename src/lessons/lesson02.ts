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
  concept: `Some tables describe **things that exist** — customers, products. Those are **entities**. Others describe **things that happened** — orders, payments. Those are **events**. A third kind shows up too: tables that describe **details of an event** — the line items on an order. They aren't events themselves, but they only exist because one happened.

A quick heuristic: events have a date. Entities don't.

Inside each table, every column plays one of three roles:
- **Identifier** (PK or FK) — links rows together: \`customer_id\`, \`order_id\`.
- **Descriptive attribute** — tells you *about* the row: \`customer_name\`, \`payment_status\`. You group by it, filter by it; you never \`SUM\` it.
- **Metric** — something you measure: \`quantity\`, \`amount\`. You aggregate it.

Why does this matter? It's the mental map for the next three lessons: **entity → dim, event → fact, attribute → dim column, metric → fact column.**`,
  dbtBridge: `Column role drives which test you write in dbt: \`unique\` + \`not_null\` on identifiers, \`accepted_values\` on categorical attributes, \`relationships\` on foreign keys. Metrics are usually tested at the aggregated level (a singular test), not row-by-row.`,
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
      question: `\`raw_order_items\` has 9 rows. There's no \`item_date\` column — but there *is* an \`order_id\`. What is this table?`,
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
        'No — \`signup_date\` is a descriptive attribute of the customer, like their name or city; it just happens to be a date',
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
      hint: `\`SELECT DISTINCT col FROM table\` — that's the whole query.`,
      solution: `SELECT DISTINCT payment_status FROM raw_payments;`,
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
      kind: 'checkpoint',
      id: 'find-the-metric',
      question: `Looking at \`raw_payments\`, which column is the **metric** (the one you'd actually \`SUM\`)?`,
      options: [
        '`payment_id` — it\'s a number, so you can sum it',
        '`payment_status` — you can count rows per status, so it\'s a measurement',
        '`amount` — money paid; sums into total revenue',
        '`payment_date` — dates can be averaged',
      ],
      correctIndex: 2,
      explanation: `\`amount\` is the only column that makes sense to aggregate: \`SUM(amount)\` is paid revenue, \`AVG(amount)\` is the average payment size. \`payment_id\` is a *number* but summing IDs is meaningless. \`payment_status\` is categorical — counting per status is fine, but the column itself isn't a metric. \`payment_date\` is a *when*, not a *how much*. The mental rule: **a metric is what you'd put on the y-axis of a chart.**`,
    },
  ],
}

export default lesson02
