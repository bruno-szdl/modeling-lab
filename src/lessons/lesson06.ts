import type { Lesson } from '../engine/types'
import {
  lastQuerySucceeded,
  lastQueryRowCountEquals,
  lastQueryContainsRow,
} from '../engine/validators'
import { DATASHOP_SEEDS } from '../seeds'
import sketch from '../sketches/lesson06.svg?raw'

/**
 * Lesson 6 — Keys & relationships.
 *
 * New lesson, inserted between Facts (L5) and Joins (L7). It centers the
 * thing every join runs on — the key — and crystallizes the insight the old
 * combined metrics lesson buried inside fan-out: a unique PK on the dim side
 * is exactly what makes a FK->PK join grain-safe.
 *
 * Teaches:
 *   - the same column plays two roles: PK in its dim (unique), FK in a fact
 *     (repeats). The FK points at the PK.
 *   - natural vs surrogate keys (named, not built — type-2/surrogate stays v2)
 *   - the Lesson 1 grain check, reborn as the join-safety guarantee: a join
 *     into a dim whose PK is unique can never multiply the fact's rows
 *   - predict-the-row-count before you run (the lab's best device)
 *   - the deliberate bridge into Lesson 8: the ONE thing that breaks this is a
 *     non-unique key on the dim side — which is fan-out
 *
 * Reference data (DataShop):
 *   dim_customers  4 rows, customer_id unique (PK)
 *   fact_orders    6 rows, 4 distinct customer_id (FK repeats: Bruno has O002+O006)
 */
const lesson06: Lesson = {
  id: 6,
  title: 'Keys & relationships',
  schemaSketch: {
    svg: sketch,
    alt: 'fact_orders on the left with a customer_id column where C002 appears twice (a foreign key that repeats), an arrow labelled FK to PK pointing right to dim_customers, where customer_id is the unique primary key (each value appears once).',
  },
  concept: `You built the star in the last two lessons; this one is about the thing that holds it together. A star is just tables connected by **keys**, and a join is the act of following one.

Two roles, often the *same column*:

- A **primary key (PK)** identifies one row of a table. It's **unique** — that's the Lesson 1 grain check (\`COUNT(*) = COUNT(DISTINCT key)\`). \`customer_id\` is the PK of \`dim_customers\`.
- A **foreign key (FK)** is a column in one table that points at another table's PK. \`customer_id\` in \`fact_orders\` is an FK — it **repeats** (Bruno places two orders, so his \`customer_id\` shows up twice) and carries no description, just the pointer back to the dim.

A join matches **FK → PK**: every fact row reaches across to the *one* dim row its key points at, and brings back that dim's attributes.

Two flavours of key worth naming:

- A **natural key** comes from the source system — \`customer_id = 'C001'\` was assigned by the operational app. This lab uses natural keys throughout.
- A **surrogate key** is one the warehouse mints itself (often a plain integer), independent of the source. You reach for it when the natural key isn't stable, or when you need to keep history (type-2) so a fact can point at the *version* of an entity that was current when the event happened. We don't build surrogate keys here — type-2 history is a v2 topic — but you should know the word and why it exists.

The payoff is a single rule you'll lean on for the rest of the lab: **a FK → PK join into a dim whose PK is unique can never change the fact's row count.** Each fact row matches exactly one dim row. That uniqueness — the grain check, made permanent — *is* join safety. Lesson 7 is about joins that lose rows; Lesson 8 is about what happens when this guarantee breaks and a join starts multiplying them.`,
  seeds: DATASHOP_SEEDS,
  // The learner built these in L4 (dims) and L5 (facts); pre-build them so this
  // lesson can focus on the key that connects them.
  preMaterialize: [
    `CREATE OR REPLACE TABLE dim_customers AS SELECT * FROM raw_customers`,
    `CREATE OR REPLACE TABLE fact_orders AS
       SELECT order_id, customer_id, order_date, order_status FROM raw_orders`,
  ],
  steps: [
    {
      kind: 'sql',
      id: 'pk-vs-fk',
      prompt: `\`customer_id\` lives in *both* \`dim_customers\` and \`fact_orders\` — but it plays a different role in each. Run the grain check on both at once and read the two rows. Where is \`customer_id\` unique, and where does it repeat?`,
      starterSql: `SELECT 'dim_customers' AS tbl,
       COUNT(*)                    AS row_count,
       COUNT(DISTINCT customer_id) AS distinct_customer_ids
FROM dim_customers
UNION ALL
SELECT 'fact_orders',
       COUNT(*),
       COUNT(DISTINCT customer_id)
FROM fact_orders;`,
      validate: (s) =>
        lastQuerySucceeded(s) &&
        lastQueryRowCountEquals(s, 2) &&
        lastQueryContainsRow(s, { tbl: 'dim_customers', row_count: 4, distinct_customer_ids: 4 }) &&
        lastQueryContainsRow(s, { tbl: 'fact_orders', row_count: 6, distinct_customer_ids: 4 }),
      explanation: `In \`dim_customers\`: **4 rows, 4 distinct** \`customer_id\`s — it passes the grain check, so \`customer_id\` is the **primary key**, unique by design. In \`fact_orders\`: **6 rows, only 4 distinct** \`customer_id\`s — it *repeats*, because the same customer can place many orders. Here \`customer_id\` is a **foreign key**: a pointer back to the dim, not an identifier of the order. Same column name, two completely different jobs — and knowing which is which is what makes the next join safe.`,
    },
    {
      kind: 'checkpoint',
      id: 'natural-vs-surrogate',
      question: `\`customer_id = 'C001'\` was assigned by DataShop's operational app, not by your warehouse. What kind of key is that, and what would a *surrogate* key be?`,
      options: [
        'It\'s a surrogate key, because the warehouse stores it',
        'It\'s a natural key (it comes from the source system). A surrogate key is one the warehouse mints itself — usually an integer — independent of the source, used when the natural key isn\'t stable or you need to keep type-2 history.',
        'There\'s no difference; "natural" and "surrogate" are two words for the same key',
        'It\'s a foreign key, because it appears in `fact_orders` too',
      ],
      correctIndex: 1,
      explanation: `\`C001\` is a **natural key** — it arrived with the data. A **surrogate key** is a stable id the warehouse generates itself (commonly a sequence of integers). You reach for one when the source's id can change, when you merge two systems that both use \`C001\` for different customers, or when you keep **type-2 history** and need a fact to point at the *version* of a customer that was current when the order happened. This lab stays on natural keys and type-1 overwrites; surrogate keys and type-2 are a v2 topic. Knowing the word is enough for now.`,
    },
    {
      kind: 'sql',
      id: 'safe-join-predict',
      prompt: `**Predict, then run.** \`fact_orders\` has 6 rows. Join it to \`dim_customers\` on \`customer_id\` to pull each order's \`customer_name\` back from the dim. How many rows come back — 4, 6, or 8?`,
      starterSql: `SELECT o.order_id, o.customer_id, c.customer_name
FROM fact_orders o
JOIN dim_customers c ON c.customer_id = o.customer_id
ORDER BY o.order_id;`,
      validate: (s) =>
        lastQuerySucceeded(s) &&
        lastQueryRowCountEquals(s, 6) &&
        lastQueryContainsRow(s, { order_id: 'O002', customer_name: 'Bruno Costa' }),
      explanation: `**6 rows — exactly the count we started with.** Bruno's two orders (O002, O006) each matched his *one* row in \`dim_customers\`, so nothing multiplied. That's the rule in action: a FK → PK join into a dim whose PK is unique brings back the attribute (\`customer_name\`) **without changing the fact's grain**. The uniqueness you proved in step 1 — the Lesson 1 grain check — is precisely what guarantees it. The name lives once in the dim; the order carries only the key; the join reunites them.`,
    },
    {
      kind: 'checkpoint',
      id: 'what-breaks-the-join',
      question: `That join kept all 6 rows and not one more. What single change would make this *same* join suddenly return **more** than 6 rows?`,
      options: [
        'Adding more orders to `fact_orders`',
        'Switching the `JOIN` to a `LEFT JOIN`',
        'A duplicate `customer_id` in `dim_customers` — a non-unique PK on the dim side, so a fact row could match more than one dim row',
        'Selecting more columns from `dim_customers`',
      ],
      correctIndex: 2,
      explanation: `The *only* thing that multiplies a FK → PK join is a **non-unique key on the dim (PK) side.** If \`dim_customers\` had two rows for Bruno, each of his orders would match *both* — and the result would balloon past 6. (A \`LEFT JOIN\` can *add* unmatched-left rows but never multiplies matched ones; more orders just keeps the 1:1 match.) Keep every dim's PK unique — the grain check — and your joins stay honest. **Lesson 8 deliberately breaks this guarantee and shows you what the resulting row-multiplication does to a \`SUM\`: fan-out, the most expensive bug in analytics.**`,
    },
  ],
  furtherReading: [
    { label: 'Kimball: surrogate keys', url: 'https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/dimensional-modeling-techniques/dimension-surrogate-key/' },
  ],
}

export default lesson06
