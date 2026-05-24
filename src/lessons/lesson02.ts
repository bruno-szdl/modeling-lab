import type { Lesson } from '../engine/types'
import { lastQuerySucceeded } from '../engine/validators'
import { DATASHOP_SEEDS } from '../seeds'

/**
 * Lesson 2 — Entities, events, column roles.
 *
 * Maps to notebook 02. Teaches: entity vs event; column role (identifier /
 * descriptive attribute / metric). The mental map for lessons 4 (dims) and 5
 * (facts): entity → dim, event → fact, attribute → dim, metric → fact.
 *
 * TODO(v1): flesh out all steps. Stub below has the skeleton + concept only.
 */
const lesson02: Lesson = {
  id: 2,
  title: 'Entities, events, column roles',
  concept: `Some tables describe **things that exist** (customers, products) — those are **entities**. Others describe **things that happened** (orders, payments) — those are **events**.

Inside each table, every column plays one of three roles:
- **Identifier** (PK or FK) — links rows together. \`customer_id\`, \`order_id\`.
- **Descriptive attribute** — tells you about the thing. \`customer_name\`, \`payment_status\`.
- **Metric** — something you measure. \`quantity\`, \`amount\`.

This classification is the bridge from "raw tables" to "dims vs facts" (next two lessons).`,
  seeds: DATASHOP_SEEDS,
  steps: [
    {
      kind: 'sql',
      id: 'stub-inspect',
      prompt: `[stub] Inspect raw_customers and raw_payments side by side. Which describes a thing, which describes an event?`,
      starterSql: `SELECT * FROM raw_customers;`,
      validate: (s) => lastQuerySucceeded(s),
    },
    {
      kind: 'checkpoint',
      id: 'payment-status-role',
      question: `What role does \`payment_status\` play in \`raw_payments\`?`,
      options: [
        'Identifier — it tells you which payment this is',
        'Descriptive attribute — it describes the payment',
        'Metric — you can sum it across rows',
        'Foreign key — it links to another table',
      ],
      correctIndex: 1,
      explanation: `\`payment_status\` is text categorical data. You group by it, filter on it, but you never \`SUM\` it. That's the textbook definition of a descriptive attribute.`,
    },
  ],
}

export default lesson02
