import type { Lesson } from '../engine/types'
import { lastQuerySucceeded } from '../engine/validators'
import { DATASHOP_SEEDS } from '../seeds'

/**
 * Lesson 4 — Facts.
 *
 * Maps to notebook 04. Many rows, few columns: FKs + metrics. The grain
 * trap demo (a duplicated dim row breaks a JOIN that looked correct) is
 * the punchline.
 *
 * TODO(v1): build fact_orders, fact_order_items, fact_payments. Demo the
 * duplicate-dim-row JOIN inflation.
 */
const lesson04: Lesson = {
  id: 4,
  title: 'Facts',
  concept: `A **fact** table is one row per **event** — an order placed, an order item, a payment. It carries:

- **Foreign keys** to dims (\`customer_id\`, \`product_id\`).
- **Metrics** you'll aggregate (\`quantity\`, \`amount\`).
- **Almost nothing else.** No \`customer_name\` — that would duplicate dim data on every row.

Facts grow forever as events happen. The discipline is to keep them lean: lean schema, clean grain, metrics ready to \`SUM\`.`,
  seeds: DATASHOP_SEEDS,
  steps: [
    {
      kind: 'sql',
      id: 'stub-build-fact',
      prompt: `[stub] Build fact_orders carrying only PK, FKs, status, and order_date — no customer_name.`,
      starterSql: `CREATE OR REPLACE TABLE fact_orders AS
SELECT order_id, customer_id, order_date, order_status
FROM raw_orders;
SELECT * FROM fact_orders;`,
      validate: (s) => lastQuerySucceeded(s),
    },
    {
      kind: 'checkpoint',
      id: 'order-total-on-fact',
      question: `Should \`fact_orders\` carry an \`order_total\` column?`,
      options: [
        'Yes — every fact needs a metric, otherwise it\'s just an index',
        'No — order_total can be computed by summing fact_order_items or fact_payments; baking it in invites drift',
        'Yes — but only for orders with one item',
        'No — totals live in the dim',
      ],
      correctIndex: 1,
      explanation: `If \`order_total\` is a stored column AND items/payments exist, you have two sources of truth and they will diverge. Better: keep \`fact_orders\` lean, derive totals from the line-level facts. This also keeps the grain honest (one order = one row, period).`,
    },
  ],
}

export default lesson04
