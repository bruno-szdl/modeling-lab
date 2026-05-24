import type { Lesson } from '../engine/types'
import {
  lastQuerySucceeded,
  lastQueryRowCountEquals,
  lastQueryHasColumns,
  lastQueryContainsRow,
  tableExists,
} from '../engine/validators'
import { DATASHOP_SEEDS } from '../seeds'
import sketch from '../sketches/lesson03b.svg?raw'

/**
 * Lesson 3b — Side quest: dim_date.
 *
 * Optional. Maps to notebook 03b. Lighter than core lessons (4 steps).
 * The unique payoff: a generated calendar dimension demonstrates that
 * "dimension" is a ROLE (context for facts) — not a statement about where
 * the data came from. Sets up the "every day shows up even with zero
 * sales" LEFT-JOIN-from-calendar pattern.
 *
 * Expected results:
 *   2024 dim_date row count = 366 (leap year)
 *   Paid revenue by day_name:
 *     Monday    280 (PAY004)
 *     Wednesday 320 (PAY005 + PAY006)
 *     Friday    180 (PAY001)
 *     Saturday  280 (PAY002)
 */
const lesson03b: Lesson = {
  id: 3.5,
  title: 'Side quest: dim_date',
  schemaSketch: { svg: sketch, alt: 'DuckDB generate_series function on the left, an arrow, and the resulting dim_date table on the right with 366 rows' },
  concept: `Calendar attributes — day of the week, month name, quarter, is-holiday — show up in every dashboard but never in your source data. The usual fix is to re-derive them inline (\`EXTRACT(quarter FROM order_date)\`, \`dayname(order_date)\`) in every query. That gets old fast, and any two queries that disagree on the rule (does the fiscal quarter start in February?) silently produce different numbers.

A **date dimension** solves this: compute every calendar attribute *once*, in a table, then JOIN to it whenever a query needs them. The dim is *generated* (no source data), but it's still a dim — it has a grain (one day), a PK (\`date_day\`), and descriptive attributes that facts look up via the key.

This is an **optional side quest.** Skip it and the main lab works fine; come back when you want the "join from a calendar so empty days still show up" pattern.`,
  dbtBridge: `Packages like \`dbt_utils\` and \`dbt_date\` ship \`date_spine()\` macros that generate exactly this. You're learning what those macros emit so you can read, debug, and customize them.`,
  seeds: DATASHOP_SEEDS,
  steps: [
    {
      kind: 'sql',
      id: 'generate-dim-date',
      prompt: `Generate \`dim_date\` covering all of 2024. DuckDB's \`generate_series(start, end, INTERVAL '1 day')\` is the trick — it returns one row per day in the range. Build the table, then SELECT \`COUNT(*)\` to confirm the row count.`,
      starterSql: `CREATE OR REPLACE TABLE dim_date AS
SELECT date_day
FROM generate_series(DATE '2024-01-01', DATE '2024-12-31', INTERVAL '1 day') AS t(date_day);

SELECT COUNT(*) AS days_in_2024 FROM dim_date;`,
      validate: (s) =>
        lastQuerySucceeded(s) &&
        tableExists(s, 'dim_date') &&
        lastQueryContainsRow(s, { days_in_2024: 366 }),
      explanation: `**366 days** — 2024 is a leap year, so February has 29. The pattern \`generate_series(start, end, step)\` is your friend whenever you need a contiguous spine: dates, hours, integer IDs, anything sequential. Right now \`dim_date\` is one column. The next step makes it useful.`,
    },
    {
      kind: 'sql',
      id: 'enrich-dim-date',
      prompt: `Rebuild \`dim_date\` with the attributes every dashboard will reach for: \`year\`, \`month\`, \`day_name\`, and \`is_weekend\`. Compute them all here, once, so no downstream query has to re-derive them.`,
      starterSql: `CREATE OR REPLACE TABLE dim_date AS
SELECT
    date_day,
    EXTRACT(year  FROM date_day)::INT AS year,
    EXTRACT(month FROM date_day)::INT AS month,
    dayname(date_day)                 AS day_name,
    -- TODO: is_weekend = TRUE when day_name is Saturday or Sunday, else FALSE
FROM generate_series(DATE '2024-01-01', DATE '2024-12-31', INTERVAL '1 day') AS t(date_day);

SELECT * FROM dim_date WHERE date_day = DATE '2024-03-02';`,
      hint: `\`dayname(date_day) IN ('Saturday', 'Sunday') AS is_weekend\``,
      solution: `CREATE OR REPLACE TABLE dim_date AS
SELECT
    date_day,
    EXTRACT(year  FROM date_day)::INT AS year,
    EXTRACT(month FROM date_day)::INT AS month,
    dayname(date_day)                 AS day_name,
    dayname(date_day) IN ('Saturday', 'Sunday') AS is_weekend
FROM generate_series(DATE '2024-01-01', DATE '2024-12-31', INTERVAL '1 day') AS t(date_day);

SELECT * FROM dim_date WHERE date_day = DATE '2024-03-02';`,
      validate: (s) =>
        lastQuerySucceeded(s) &&
        tableExists(s, 'dim_date') &&
        lastQueryHasColumns(s, ['day_name', 'is_weekend']) &&
        lastQueryContainsRow(s, { day_name: 'Saturday', is_weekend: true }),
      explanation: `One row, fully enriched: \`2024-03-02\` is a Saturday and \`is_weekend\` is TRUE. Every downstream query can now \`GROUP BY d.day_name\` or \`WHERE NOT d.is_weekend\` without re-deriving anything. Change "weekend" to mean "Friday-Sunday" later and you edit *one place* — every dashboard picks it up.`,
    },
    {
      kind: 'sql',
      id: 'use-dim-date',
      prompt: `Now use \`dim_date\` for an actual analytics question: **paid revenue grouped by day of the week.** JOIN \`raw_payments\` to \`dim_date\` on the date key, filter to paid, group by \`day_name\`. Without the dim, you'd \`EXTRACT(dow ...)\` and \`CASE WHEN ...\` inline; with it, you just \`GROUP BY d.day_name\`.`,
      starterSql: `SELECT
    d.day_name,
    SUM(p.amount) AS paid_revenue
FROM raw_payments p
JOIN dim_date d ON p.payment_date = d.date_day
WHERE p.payment_status = 'paid'
GROUP BY d.day_name
ORDER BY paid_revenue DESC;`,
      validate: (s) =>
        lastQuerySucceeded(s) &&
        lastQueryRowCountEquals(s, 4) &&
        lastQueryContainsRow(s, { day_name: 'Wednesday', paid_revenue: 320 }) &&
        lastQueryContainsRow(s, { day_name: 'Monday', paid_revenue: 280 }),
      explanation: `**Wednesday 320, Monday 280, Saturday 280, Friday 180.** Wednesday wins (PAY005 + PAY006). Notice how clean the query is — no \`EXTRACT\` clutter, no inline \`CASE\` for day-of-week. The dim absorbed all that. And the same pattern scales: add a holiday column to \`dim_date\`, and *every* report can suddenly filter "non-holiday days" with one JOIN.`,
    },
    {
      kind: 'checkpoint',
      id: 'is-dim-date-a-dim',
      question: `\`dim_date\` was generated from a function — there's no source CSV, no upstream system, no row that came from "the business". Is it still a dimension?`,
      options: [
        'No — dimensions must originate from a source system; this is just a helper table',
        'Yes — the role defines what it is (a small, stable set of "things" providing context to facts via a key), not where the data came from',
        'Half — it\'s a "synthetic" dim, a special intermediate category',
        'Only if you store the generated output as a CSV first, then reload it',
      ],
      correctIndex: 1,
      explanation: `**Role beats origin.** \`dim_date\` has one row per day (grain), a PK (\`date_day\`), descriptive attributes (\`year\`, \`month\`, \`day_name\`, \`is_weekend\`), and a small stable set. That's what makes it a dim. Whether the rows came from a source system, a function, or a CSV you typed by hand is irrelevant. The same applies to any "generated" dim — \`dim_hour\` (24 rows), \`dim_currency\` (a hardcoded list of supported currencies), \`dim_segment\` (your business rules for segmenting customers). If it plays the role, it's a dim.`,
    },
  ],
}

export default lesson03b
