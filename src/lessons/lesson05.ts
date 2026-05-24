import type { Lesson } from '../engine/types'
import { lastQuerySucceeded } from '../engine/validators'
import { DATASHOP_SEEDS } from '../seeds'

/**
 * Lesson 5 — Joins that don't break grain.
 *
 * Maps to notebook 04b. LEFT JOIN as the analytics default; anti-joins;
 * WHERE vs ON for filters on the right side; COALESCE.
 *
 * TODO(v1): the Diego-disappears example (cancelled-order filter in WHERE
 * vs ON), the anti-join exercise, the dim_date revenue-by-day.
 */
const lesson05: Lesson = {
  id: 5,
  title: `Joins that don't break grain`,
  concept: `**\`LEFT JOIN\` is the default for analytics**. It keeps every row on the left side, even when nothing matches on the right. \`INNER JOIN\` is the special case for "the row is useless without a match".

Two traps to internalize:

1. **Filters on the right side go in \`ON\`, not \`WHERE\`.** Otherwise the NULL rows from non-matches get filtered out and your \`LEFT JOIN\` silently becomes an \`INNER JOIN\`.
2. **\`COUNT(\\*)\` vs \`COUNT(column)\`** after a LEFT JOIN: the first counts everyone, the second skips the NULLs. Pick the one that answers the question you're asking.`,
  seeds: DATASHOP_SEEDS,
  steps: [
    {
      kind: 'sql',
      id: 'stub-left-join',
      prompt: `[stub] Total spent per customer, including customers with zero. Use LEFT JOIN and COALESCE.`,
      starterSql: `SELECT
    c.customer_id, c.customer_name,
    COALESCE(SUM(i.item_amount), 0) AS total_spent
FROM raw_customers AS c
LEFT JOIN raw_order_items AS i
       ON i.order_id IN (SELECT order_id FROM raw_orders WHERE customer_id = c.customer_id)
GROUP BY c.customer_id, c.customer_name
ORDER BY total_spent DESC;`,
      validate: (s) => lastQuerySucceeded(s),
    },
    {
      kind: 'checkpoint',
      id: 'where-or-on',
      question: `You're \`LEFT JOIN\`ing customers to orders, and you want to exclude **cancelled** orders. Where does the filter go?`,
      options: [
        '`WHERE o.order_status <> \'cancelled\'`',
        '`ON ... AND o.order_status <> \'cancelled\'`',
        'Either works the same',
        '`HAVING o.order_status <> \'cancelled\'`',
      ],
      correctIndex: 1,
      explanation: `In the \`ON\`. Otherwise the \`WHERE\` drops rows where the right side is NULL (the customers who never ordered, AND any customer whose only order was cancelled) — your \`LEFT JOIN\` collapses to an INNER. The filter goes in \`ON\` so the right side simply doesn't match for cancelled orders; the customer survives the join with NULLs on the right.`,
    },
  ],
}

export default lesson05
