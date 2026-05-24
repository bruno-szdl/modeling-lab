import type { Lesson } from '../engine/types'
import { lastQuerySucceeded } from '../engine/validators'
import { DATASHOP_SEEDS } from '../seeds'

/**
 * Lesson 3 — Dimensions.
 *
 * Maps to notebook 03. A dim is one row per entity, many descriptive
 * columns, no metrics. Lesson 3b (dim_date) follows as an optional side
 * quest.
 *
 * TODO(v1): exercises CREATE dim_customers, dim_products; the price_band
 * derived-column exercise.
 */
const lesson03: Lesson = {
  id: 3,
  title: 'Dimensions',
  concept: `A **dimension** table is one row per **entity** (one customer, one product), carrying the descriptive attributes that everything else will look up: name, city, category, price band.

Two things matter:
1. **Few rows, many columns** — dims describe stable, small sets.
2. **No metrics live here** — quantities and amounts belong in facts (next lesson). \`list_price\` is the *posted* price of the product (an attribute), not what was paid in any specific sale (that's a metric on the order item).`,
  seeds: DATASHOP_SEEDS,
  steps: [
    {
      kind: 'sql',
      id: 'stub-build-dim',
      prompt: `[stub] Build dim_customers from raw_customers. Add a derived signup_year column.`,
      starterSql: `CREATE OR REPLACE TABLE dim_customers AS
SELECT * FROM raw_customers;
SELECT * FROM dim_customers;`,
      validate: (s) => lastQuerySucceeded(s),
    },
    {
      kind: 'checkpoint',
      id: 'where-does-name-live',
      question: `If a customer's name changes, which table do you edit?`,
      options: [
        '`fact_orders` — update every row for that customer',
        '`dim_customers` — one row, one edit, and every join picks it up',
        'Both — they need to stay consistent',
        '`raw_customers` — never derive a dim',
      ],
      correctIndex: 1,
      explanation: `That's *the point* of a dimension: descriptive attributes live in **one place**. Facts only carry the FK (\`customer_id\`), so the update propagates via JOINs at query time.`,
    },
  ],
}

export default lesson03
