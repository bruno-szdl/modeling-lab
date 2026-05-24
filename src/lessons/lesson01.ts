import type { Lesson } from '../engine/types'
import {
  lastQuerySucceeded,
  lastQueryRowHasValue,
  lastQueryHasColumns,
} from '../engine/validators'
import { DATASHOP_SEEDS } from '../seeds'

/**
 * Lesson 1 — The grain of a table.
 *
 * Maps to notebook 01 ("o grão dos dados"). The anchor of the entire lab.
 * Mantra: "What does one row in this table represent?"
 *
 * Reference numbers (DataShop):
 *   raw_customers      4 rows, PK customer_id
 *   raw_products       4 rows, PK product_id
 *   raw_orders         6 rows, PK order_id
 *   raw_order_items    9 rows, PK order_item_id  (3 orders carry multiple items)
 *   raw_payments       7 rows, PK payment_id     (O006 has 2 rows: paid + refunded)
 */
const lesson01: Lesson = {
  id: 1,
  title: 'The grain of a table',
  concept: `Every analytics question begins with one question of your own:

> **What does one row in this table represent?**

That answer is the **grain**. Get it wrong and your numbers will quietly drift — you'll count orders when you meant items, or sum revenue twice.

In this lesson you'll inspect the DataShop e-commerce dataset, find the grain of each raw table, and learn the one objective test that proves a column is a **primary key**: \`COUNT(*) = COUNT(DISTINCT key)\`.`,
  dbtBridge: `What you just wrote (\`COUNT(*) = COUNT(DISTINCT key)\`) is the operational definition of a primary key — and it's the same idea dbt formalizes as a \`unique\` test. dbt ships four such tests by convention: **\`not_null\`**, **\`unique\`**, **\`accepted_values\`**, and **\`relationships\`**, all declared in YAML. We don't dwell on them in this lab — testing is a discipline of its own and [transform-lab](https://transform-lab.datagym.io) is where you meet them properly.`,
  seeds: DATASHOP_SEEDS,
  steps: [
    {
      kind: 'sql',
      id: 'inspect-orders',
      prompt: `Start with the \`raw_orders\` table. Run the SELECT below to see what's in it. Read the rows: what does one row represent?`,
      starterSql: `SELECT * FROM raw_orders;`,
      validate: (s) => lastQuerySucceeded(s) && (s.lastQuery?.result?.rowCount ?? 0) === 6,
      explanation: `Six rows, one per **order**. Each row carries an \`order_id\`, the customer who placed it, a date, and a status. The grain is "one order".`,
    },
    {
      kind: 'checkpoint',
      id: 'grain-of-order-items',
      question: `\`raw_order_items\` has **9 rows**, but \`raw_orders\` only has 6. What does one row in \`raw_order_items\` represent?`,
      options: [
        'One order (the 9 rows are duplicates from a bug in the data)',
        'One line on an order — a (order, product) pair with a quantity',
        'One product (across all the times it was sold)',
        'One customer order session',
      ],
      correctIndex: 1,
      explanation: `Each row is a **line item** on an order — one (order, product) pair. So three orders have more than one item, which is why 6 orders expand to 9 item rows. Different grain than \`raw_orders\`, same business event.`,
    },
    {
      kind: 'sql',
      id: 'count-vs-distinct',
      prompt: `Prove that \`order_id\` is the primary key of \`raw_orders\`. Write a single SELECT that returns two numbers: the total row count, and the count of distinct \`order_id\` values. If they're equal, \`order_id\` is a PK.`,
      starterSql: `SELECT
    COUNT(*)                 AS total_rows,
    COUNT(DISTINCT order_id) AS distinct_order_ids
FROM raw_orders;`,
      hint: `\`COUNT(*) = COUNT(DISTINCT col)\` is the test. If they're equal, the column is unique.`,
      solution: `SELECT
    COUNT(*)                 AS total_rows,
    COUNT(DISTINCT order_id) AS distinct_order_ids
FROM raw_orders;`,
      validate: (s) =>
        lastQuerySucceeded(s) &&
        lastQueryHasColumns(s, ['total_rows', 'distinct_order_ids']) &&
        lastQueryRowHasValue(s, 'total_rows', 6, 'distinct_order_ids', 6),
      explanation: `Both are **6** — they match, so \`order_id\` is unique across all rows. Combined with \`not null\`, that's the operational definition of a primary key. The grain is confirmed: one row = one order.`,
    },
    {
      kind: 'sql',
      id: 'find-multi-payment-order',
      prompt: `\`raw_payments\` has **7** rows but only **6** unique \`order_id\`s. One order has two payment rows. Find it. (Hint: \`GROUP BY order_id HAVING COUNT(*) > 1\`.)`,
      starterSql: `-- TODO: which order has more than one payment row?
SELECT order_id, COUNT(*) AS payment_rows
FROM raw_payments
GROUP BY order_id;`,
      hint: `Add \`HAVING COUNT(*) > 1\` and you'll get a single row.`,
      solution: `SELECT order_id, COUNT(*) AS payment_rows
FROM raw_payments
GROUP BY order_id
HAVING COUNT(*) > 1;`,
      validate: (s) =>
        lastQuerySucceeded(s) &&
        (s.lastQuery?.result?.rowCount ?? 0) === 1 &&
        lastQueryRowHasValue(s, 'order_id', 'O006', 'payment_rows', 2),
      explanation: `Order **O006** has two payment rows — one \`paid\`, one \`refunded\`. So the grain of \`raw_payments\` is "**one payment**", not "one order". This is why you can't assume \`order_id\` is unique in every table that mentions it.`,
    },
    {
      kind: 'checkpoint',
      id: 'count-orders-vs-items',
      question: `You want to answer: **"How many orders did DataShop sell last month?"**. Which table do you query?`,
      options: [
        '`raw_order_items` — sum its row count',
        '`raw_orders` — count its rows',
        '`raw_payments` — count distinct order_id',
        'Either, they give the same number',
      ],
      correctIndex: 1,
      explanation: `Grain matters. \`raw_orders\` is one row per order — \`COUNT(*)\` is your answer. \`raw_order_items\` would over-count (multi-item orders), \`raw_payments\` would over-count (some orders have multiple payment rows). Even though they "all mention orders", only one of them has the right **grain**.`,
    },
    {
      kind: 'sql',
      id: 'grain-of-payments',
      prompt: `Confirm the grain of \`raw_payments\` the same way you confirmed \`raw_orders\`. Return the total rows and the distinct count of \`payment_id\`. They should match.`,
      starterSql: `-- TODO: prove payment_id is the PK of raw_payments
`,
      hint: `Same COUNT(*) vs COUNT(DISTINCT …) trick — different table and column.`,
      solution: `SELECT
    COUNT(*)                   AS total_rows,
    COUNT(DISTINCT payment_id) AS distinct_payment_ids
FROM raw_payments;`,
      validate: (s) =>
        lastQuerySucceeded(s) &&
        (s.lastQuery?.result?.rowCount ?? 0) === 1 &&
        lastQueryScalarEqualsAnyOf(s, 7),
      explanation: `7 and 7. \`payment_id\` is the PK; the grain of \`raw_payments\` is one **payment**. From now on, every time you meet a new table the first reflex is: *"what is one row?"* — then prove it.`,
    },
  ],
  furtherReading: [
    { label: 'Kimball: declaring the grain', url: 'https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/dimensional-modeling-techniques/declare-the-grain/' },
  ],
}

/**
 * Helper for the last step — accept either {7,7} (two columns) or a scalar 7
 * (if the learner wrote a single COUNT). Keeps the validator forgiving while
 * still confirming they hit the right table.
 */
function lastQueryScalarEqualsAnyOf(s: import('../engine/types').LessonState, n: number): boolean {
  const r = s.lastQuery?.result
  if (!r || r.rowCount !== 1) return false
  // Accept any single row that has at least one cell equal to n.
  return r.rows[0].some((c) => String(c) === String(n))
}

export default lesson01
