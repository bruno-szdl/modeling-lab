import type { Lesson } from '../engine/types'
import {
  lastQuerySucceeded,
  lastQueryRowCountEquals,
  lastQueryRowHasValue,
  lastQueryHasColumns,
  lastQueryContainsRow,
} from '../engine/validators'
import { DATASHOP_SEEDS } from '../seeds'
import sketch from '../sketches/lesson01.svg?raw'

/**
 * Lesson 1 — The grain of a table.
 *
 * Maps to notebook 01 ("o grão dos dados"). The anchor of the entire lab.
 * Mantra: "What does one row in this table represent?"
 *
 * Step structure: 8 steps in table-by-table order. Each table is SEEN with
 * SELECT * before the learner is asked anything about it. Tasks about the
 * same table sit next to each other so the editor stays in context.
 *
 * Reference numbers (DataShop):
 *   raw_orders         6 rows, PK order_id
 *   raw_order_items    9 rows, PK order_item_id  (3 orders carry multiple items)
 *   raw_payments       7 rows, PK payment_id     (O006 has 2 rows: paid + refunded)
 */
const lesson01: Lesson = {
  id: 1,
  title: 'The grain of a table',
  schemaSketch: {
    svg: sketch,
    alt: 'The full raw_orders table — six rows (O001 through O006) with order_id, customer_id, order_date, and order_status columns — with an arrow pointing up at the table asking "what does one row represent?"',
  },
  concept: `Every analytics question begins with one question of your own:

> **What does one row in this table represent?**

That answer is the **grain**. Get it wrong and your numbers will quietly drift — you'll count orders when you meant items, or sum revenue twice.

Look at \`raw_orders\` shown below — six rows, four columns. Before you read on, can you answer the question for *this* table? "One row in \`raw_orders\` represents…?"

You'll work through three tables this lesson — \`raw_orders\`, then \`raw_order_items\`, then \`raw_payments\` — and learn the one objective test that proves a column is a **primary key**: \`COUNT(*) = COUNT(DISTINCT key)\`.`,
  dbtBridge: `What you'll write below — \`COUNT(*) = COUNT(DISTINCT key)\` — is the operational definition of a primary key, and it's the same idea dbt formalizes as a \`unique\` test. dbt ships four such tests by convention: **\`not_null\`**, **\`unique\`**, **\`accepted_values\`**, and **\`relationships\`**, all declared in YAML. We don't dwell on them in this lab — testing is a discipline of its own and [transform-lab](https://transform-lab.datagym.io) is where you meet them properly.`,
  seeds: DATASHOP_SEEDS,
  steps: [
    // ── raw_orders ──────────────────────────────────────────────────────────
    {
      kind: 'sql',
      id: 'see-orders',
      prompt: `Start with the \`raw_orders\` table. Click **Load starter** to drop a \`SELECT *\` into the editor, then hit **Run**. Read the rows top to bottom — what does one row represent?`,
      starterSql: `SELECT * FROM raw_orders;`,
      validate: (s) =>
        lastQuerySucceeded(s) && lastQueryRowCountEquals(s, 6),
      explanation: `**6 rows**, one per order. Each row carries an \`order_id\`, the customer who placed it, an \`order_date\`, and a status. The grain looks like "one order" — let's prove it next.`,
    },
    {
      kind: 'sql',
      id: 'prove-orders-pk',
      prompt: `Prove that \`order_id\` is the primary key of \`raw_orders\`. Write a single \`SELECT\` that returns two numbers in one row: the total row count and the count of distinct \`order_id\` values. If they're equal, \`order_id\` is unique — combined with not-null, that's a PK.`,
      starterSql: `-- Goal: return two columns in one row — total_rows and distinct_order_ids.
SELECT
    COUNT(*) AS total_rows
    -- TODO: add another column for the count of distinct order_id values
FROM raw_orders;`,
      hint: `Add \`COUNT(DISTINCT order_id) AS distinct_order_ids\` after the first column (don't forget the comma).`,
      solution: `SELECT
    COUNT(*)                 AS total_rows,
    COUNT(DISTINCT order_id) AS distinct_order_ids
FROM raw_orders;`,
      validate: (s) =>
        lastQuerySucceeded(s) &&
        lastQueryHasColumns(s, ['total_rows', 'distinct_order_ids']) &&
        lastQueryRowHasValue(s, 'total_rows', 6, 'distinct_order_ids', 6),
      explanation: `Both are **6** — they match, so \`order_id\` is unique across all rows. Combined with not-null (an \`order_id\` always exists for an order), that's the operational definition of a primary key. The grain of \`raw_orders\` is confirmed: **one row = one order.**`,
    },

    // ── raw_order_items ─────────────────────────────────────────────────────
    {
      kind: 'sql',
      id: 'see-order-items',
      prompt: `Now meet \`raw_order_items\`. Same store, related concept — but the row count is going to surprise you. Run the \`SELECT *\` and skim the rows.`,
      starterSql: `SELECT * FROM raw_order_items;`,
      validate: (s) =>
        lastQuerySucceeded(s) && lastQueryRowCountEquals(s, 9),
      explanation: `**9 rows.** But there were only 6 orders — so this isn't "one row per order." Look at the \`order_id\` column: \`O001\` appears more than once (twice, actually — with two different products). The same business event is being represented at a *different* grain. The next step nails down exactly what.`,
    },
    {
      kind: 'checkpoint',
      id: 'grain-of-order-items',
      question: `\`raw_order_items\` has 9 rows, but \`raw_orders\` only has 6. What does **one row** in \`raw_order_items\` represent?`,
      options: [
        'One order (the 9 rows are duplicates from a bug in the data)',
        'One line on an order — a (order, product) pair with a quantity',
        'One product (across all the times it was sold)',
        'One customer order session',
      ],
      correctIndex: 1,
      explanation: `Each row is a **line item** on an order — one (order, product) pair. So three orders have more than one item, which is why 6 orders expand to 9 item rows. Different grain than \`raw_orders\`, same business event. **The PK here is \`order_item_id\`, not \`order_id\`** — \`order_id\` is the foreign key linking back to the order.`,
    },

    // ── raw_payments ────────────────────────────────────────────────────────
    {
      kind: 'sql',
      id: 'see-payments',
      prompt: `Last table for this lesson: \`raw_payments\`. Same drill — run the \`SELECT *\` and read what's there.`,
      starterSql: `SELECT * FROM raw_payments;`,
      validate: (s) =>
        lastQuerySucceeded(s) && lastQueryRowCountEquals(s, 7),
      explanation: `**7 rows.** Already odd — there are only 6 orders but 7 payment rows. Either an order has more than one payment, or there's a row we don't expect. The next step uncovers which.`,
    },
    {
      kind: 'sql',
      id: 'prove-payments-grain',
      prompt: `Run the same kind of grain check you did on \`raw_orders\`, but include a third count: distinct \`order_id\`. If two of the three numbers match and one doesn't — that's the story.`,
      starterSql: `-- Goal: return three columns in one row — total_rows,
-- distinct_payment_ids, and distinct_orders.
SELECT
    COUNT(*) AS total_rows
    -- TODO: add COUNT(DISTINCT payment_id) AS distinct_payment_ids
    -- TODO: add COUNT(DISTINCT order_id)   AS distinct_orders
FROM raw_payments;`,
      hint: `Add two more columns after \`total_rows\` (commas matter): \`COUNT(DISTINCT payment_id) AS distinct_payment_ids\` and \`COUNT(DISTINCT order_id) AS distinct_orders\`.`,
      solution: `SELECT
    COUNT(*)                   AS total_rows,
    COUNT(DISTINCT payment_id) AS distinct_payment_ids,
    COUNT(DISTINCT order_id)   AS distinct_orders
FROM raw_payments;`,
      validate: (s) =>
        lastQuerySucceeded(s) &&
        lastQueryContainsRow(s, { total_rows: 7, distinct_payment_ids: 7, distinct_orders: 6 }),
      explanation: `**7, 7, 6.** \`payment_id\` is unique (it's the PK — total matches distinct), but only **6** distinct \`order_id\` values appear across 7 rows. Meaning: **one of the orders has more than one payment row.** The grain of \`raw_payments\` is **one payment**, not "one order" — don't confuse them.`,
    },
    {
      kind: 'sql',
      id: 'find-multi-payment-order',
      prompt: `Find that one order with more than one payment row. \`GROUP BY order_id HAVING COUNT(*) > 1\` is the shape.`,
      starterSql: `-- TODO: which order has more than one payment row?
SELECT order_id, COUNT(*) AS payment_rows
FROM raw_payments
GROUP BY order_id;`,
      hint: `Add \`HAVING COUNT(*) > 1\` after the \`GROUP BY\` and you'll get a single row.`,
      solution: `SELECT order_id, COUNT(*) AS payment_rows
FROM raw_payments
GROUP BY order_id
HAVING COUNT(*) > 1;`,
      validate: (s) =>
        lastQuerySucceeded(s) &&
        lastQueryRowCountEquals(s, 1) &&
        lastQueryRowHasValue(s, 'order_id', 'O006', 'payment_rows', 2),
      explanation: `Order **O006** has two payment rows. (Re-run the \`SELECT *\` on \`raw_payments\` and you'll see them: PAY006 \`paid\`, PAY007 \`refunded\`.) This is why you can't assume \`order_id\` is unique in *every* table that mentions it — only in the one whose grain is "one order".`,
    },

    // ── synthesis ───────────────────────────────────────────────────────────
    {
      kind: 'checkpoint',
      id: 'count-orders-vs-units',
      question: `Now you've seen all three. You want to answer: **"How many orders did DataShop receive last month?"**. Which table do you query?`,
      options: [
        '`raw_order_items` — sum its row count, since each item is part of an order',
        '`raw_orders` — count its rows, since the grain is one row per order',
        '`raw_payments` — count distinct \`order_id\`, since every order gets paid',
        'Either, they all give the same number',
      ],
      correctIndex: 1,
      explanation: `**Grain matters.** \`raw_orders\` is one row per order — \`COUNT(*)\` is your answer. \`raw_order_items\` would over-count (multi-item orders show up as 2+ rows). \`raw_payments\` would under-count (cancelled orders may have no payment) AND over-count (O006 has two payment rows). All three tables "mention orders", but only one has the **right grain** for the question. From now on, every time you meet a new table the first reflex is: *what does one row represent?* — then prove it.`,
    },
  ],
  furtherReading: [
    { label: 'Kimball: declaring the grain', url: 'https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/dimensional-modeling-techniques/declare-the-grain/' },
  ],
}

export default lesson01
