import type { Lesson } from '../engine/types'
import { lastQuerySucceeded } from '../engine/validators'
import { DATASHOP_SEEDS } from '../seeds'

/**
 * Lesson 6 — Metrics, fan-out, additivity.
 *
 * Maps to notebook 05. The headline aha moment: SUM(amount) JOIN items
 * returns 1800 when the right answer is 1060. The 5 paid payments fan out
 * across 8 line items and the sum double-counts.
 *
 * TODO(v1): the fan-out demo (predict-then-run), the AOV exercise
 * (1060 / 5 = 212), and the fully/semi/non-additive vocabulary.
 */
const lesson06: Lesson = {
  id: 6,
  title: 'Metrics, fan-out, additivity',
  concept: `A **metric** has three parts you commit to *before* writing SQL: a definition (in English), a formula, and a grain. Skip any of them and the team will argue about whose number is right.

The trap that ruins more dashboards than any other is **fan-out**: you \`SUM\` a metric *after* a JOIN that duplicated its rows. \`SUM(amount)\` from \`raw_payments\` JOINed to \`raw_order_items\` reports **1800** when the right answer is **1060** — because each payment now appears once per line item on its order.

The rule: **calculate every metric at its own grain first, then join the rolled-up numbers together.**`,
  seeds: DATASHOP_SEEDS,
  steps: [
    {
      kind: 'sql',
      id: 'stub-fanout-trap',
      prompt: `[stub] Run the fan-out trap. Predict the result before running.`,
      starterSql: `-- BEFORE you run: predict the number.
-- The correct paid revenue is 1060.
-- What does this query return?
SELECT SUM(p.amount) AS paid_revenue
FROM raw_payments AS p
JOIN raw_order_items AS i ON i.order_id = p.order_id
WHERE p.payment_status = 'paid';`,
      validate: (s) => lastQuerySucceeded(s),
      explanation: `1800. Each \`paid\` payment got duplicated once per line item on its order — 5 paid payments fan out to 8 rows, and \`SUM(amount)\` adds the same payment multiple times. Lesson 7 (the mart) shows how to compute each metric at its own grain and then bring the answers together safely.`,
    },
    {
      kind: 'checkpoint',
      id: 'aov-additivity',
      question: `**Average Order Value** (AOV) is a ratio: paid revenue ÷ paid orders. Across the year, is AOV additive over months?`,
      options: [
        'Yes — AOV is just an average; averages add',
        'No — you can\'t add monthly AOVs to get yearly AOV; you have to recompute from the ingredients',
        'Yes — if the months have the same row count',
        'No — only sums are additive',
      ],
      correctIndex: 1,
      explanation: `AOV is **non-additive**. To get yearly AOV you need yearly revenue ÷ yearly orders, not the mean of monthly AOVs. The implication for the mart (next lesson): store the *ingredients* (\`SUM\`, \`COUNT(DISTINCT)\`), let the consumer recompute the ratio.`,
    },
  ],
}

export default lesson06
