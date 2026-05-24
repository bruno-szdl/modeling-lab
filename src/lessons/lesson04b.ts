import type { Lesson } from '../engine/types'
import { lastQuerySucceeded } from '../engine/validators'

/**
 * Lesson 4b — Side quest: dim_date.
 *
 * Optional. Maps to notebook 03b. Generate a calendar dim with
 * generate_series, enrich with EXTRACT and dayname. Sets up the LEFT JOIN
 * from-calendar pattern that lesson 6 uses (revenue-per-day with no missing
 * days).
 *
 * TODO(v1): full exercises (day_name, is_weekend, the holiday extension).
 */
const lesson04b: Lesson = {
  id: 4.5, // sorts between 4 and 5; the lessons/index treats fractional ids fine.
  title: 'Side quest: dim_date',
  concept: `Calendar attributes (day-of-week, month name, quarter, holiday) are something you compute **once** in a date dimension, then JOIN to whenever a query needs them. The alternative — every query re-deriving \`EXTRACT(quarter FROM …)\` — is slow, repetitive, and inconsistent.

This is an optional lesson. Skip it and you can still finish the lab; come back when you want the "every day shows up even if there were zero sales" pattern that the joins lesson uses.`,
  dbtBridge: `In dbt, packages like \`dbt_utils\` and \`dbt_date\` ship \`date_spine()\` macros that generate this for you. You're learning what those macros emit.`,
  steps: [
    {
      kind: 'sql',
      id: 'stub-generate',
      prompt: `[stub] Generate dim_date from 2024-01-01 to 2024-12-31 using generate_series.`,
      starterSql: `CREATE OR REPLACE TABLE dim_date AS
SELECT
    date_day,
    EXTRACT(year FROM date_day)::INT  AS year,
    EXTRACT(month FROM date_day)::INT AS month,
    dayname(date_day)                 AS day_name
FROM generate_series(DATE '2024-01-01', DATE '2024-12-31', INTERVAL '1 day') AS t(date_day);
SELECT COUNT(*) AS days FROM dim_date;`,
      validate: (s) => lastQuerySucceeded(s),
    },
  ],
}

export default lesson04b
