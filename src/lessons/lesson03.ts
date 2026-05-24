import type { Lesson } from '../engine/types'
import { lastQuerySucceeded } from '../engine/validators'
import { DATASHOP_SEEDS } from '../seeds'

/**
 * Lesson 3 — Data quality checks.
 *
 * Maps to notebook 02b. Four named tests, the same four dbt ships natively:
 * not_null, unique, accepted_values, relationships. Each is taught as a
 * SQL query that returns "expected: zero rows".
 *
 * TODO(v1): full content + the simulated-failure demo (drop a customer_id
 * to make a `not_null` test catch a NULL).
 */
const lesson03: Lesson = {
  id: 3,
  title: 'Data quality checks',
  concept: `Before you build anything on top of a table, you check it. Four tests cover the vast majority of "I thought I trusted this data" surprises:

- **\`not_null\`** — no missing values in a column that shouldn't have them.
- **\`unique\`** — no duplicates in a key column.
- **\`accepted_values\`** — categorical columns stay inside a closed list.
- **\`relationships\`** — every foreign key has a parent row.

Each test is a **SQL query that should return zero rows**. That's the operational definition: "the test passes when no problem is found".`,
  dbtBridge: `These are exactly the four generic tests dbt ships with. The YAML you'll write later is just sugar over the same "should return zero rows" idea.`,
  seeds: DATASHOP_SEEDS,
  steps: [
    {
      kind: 'sql',
      id: 'stub-not-null',
      prompt: `[stub] Write a not_null test for raw_orders.customer_id — return any row where it's NULL.`,
      starterSql: `SELECT * FROM raw_orders WHERE customer_id IS NULL;`,
      validate: (s) => lastQuerySucceeded(s),
    },
    {
      kind: 'checkpoint',
      id: 'pk-equals',
      question: `Which two tests together define a primary key?`,
      options: [
        '`not_null` + `accepted_values`',
        '`not_null` + `unique`',
        '`unique` + `relationships`',
        '`accepted_values` + `relationships`',
      ],
      correctIndex: 1,
      explanation: `A PK column has no nulls (\`not_null\`) and no duplicates (\`unique\`). Run both — if both pass, the column is functionally a primary key.`,
    },
  ],
}

export default lesson03
