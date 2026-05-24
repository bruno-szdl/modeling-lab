import type { Lesson } from '../engine/types'
import { lastQuerySucceeded, tableExists } from '../engine/validators'
import { DATASHOP_SEEDS } from '../seeds'

/**
 * Lesson 8 — Build the mart.
 *
 * Maps to notebook 06. The product. Each fact is aggregated at the mart's
 * grain (month), then the per-fact CTEs are joined safely. Two rows out.
 * Finale screen takes over after this lesson completes.
 *
 * TODO(v1): full build via CTEs, the net-revenue exercise, the
 * reflection-questions checkpoint.
 *
 * Expected mart shape:
 *   month     | gross_sales | paid_revenue | refunded | delivered | cancelled | refunded_orders
 *   2024-03   |  460        | 460          | 0        | 2         | 1         | 0
 *   2024-04   |  600        | 600          | 200      | 2         | 0         | 1
 */
const lesson08: Lesson = {
  id: 8,
  title: 'Build the mart',
  concept: `Everything you've practiced converges here. The mart is what business users actually query — \`SELECT * FROM mart_monthly_sales\` and the answer is in two rows.

The build strategy is **aggregate each fact at the mart's grain first, then join**. Three CTEs (gross sales per month, paid revenue per month, order counts per month), one final \`JOIN\` on \`month\`, done. No fan-out because nothing is at a finer grain at the join.

The mart layer is the **product**; dim/fact are the **inputs**. Your consumers don't need to know dims and facts exist.`,
  dbtBridge: `In dbt, this is the contents of \`models/marts/mart_monthly_sales.sql\` — same SQL, materialized as \`table\`, with tests on the grain and \`unique\` on \`month\`.`,
  seeds: DATASHOP_SEEDS,
  steps: [
    {
      kind: 'sql',
      id: 'stub-build-mart',
      prompt: `[stub] Build mart_monthly_sales. One row per month. Use CTEs to aggregate each fact at month grain, then join.`,
      starterSql: `-- TODO: build mart_monthly_sales
-- Expected: 2 rows (2024-03, 2024-04)
-- 2024-03: gross_sales=460, paid_revenue=460
-- 2024-04: gross_sales=600, paid_revenue=600, refunded=200
`,
      hint: `Start with three CTEs at month grain: gross sales (from raw_order_items + raw_orders, exclude cancelled), paid revenue (from raw_payments where status='paid'), refunded amounts. Then SELECT … FROM gross g LEFT JOIN paid p ON g.month = p.month …`,
      validate: (s) => lastQuerySucceeded(s) && tableExists(s, 'mart_monthly_sales'),
      explanation: `Two rows. That's the whole point of analytics modeling: heavy work upstream so the final answer is shaped exactly like the question.`,
    },
  ],
}

export default lesson08
