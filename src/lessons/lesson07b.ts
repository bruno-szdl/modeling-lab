import type { Lesson } from '../engine/types'
import {
  lastQuerySucceeded,
  lastQueryRowCountEquals,
  lastQueryHasColumns,
  lastQueryContainsRow,
  tableExists,
} from '../engine/validators'
import { DATASHOP_SEEDS } from '../seeds'
import sketch from '../sketches/lesson07b.svg?raw'

/**
 * Lesson 7b — Side quest: dim_date.
 *
 * Optional. Maps to notebook 03b. Lighter than core lessons (4 steps).
 * Sits after L7 (joins) so its closing calendar-spine LEFT JOIN *applies*
 * the LEFT JOIN taught there, rather than previewing it. Still placed before
 * L10 so the monthly mart can refer back to "the calendar spine from the side
 * quest". The unique payoff: a generated calendar dimension demonstrates that
 * "dimension" is a ROLE (context for facts) — not a statement about where
 * the data came from. The closing step delivers the "every day shows up
 * even with zero sales" calendar-spine LEFT JOIN.
 *
 * Expected results:
 *   2024 dim_date row count = 366 (leap year)
 *   Daily paid revenue, LEFT JOIN dim_date -> raw_payments, 2024-04-01..07:
 *     Mon 2024-04-01  280 (PAY004)
 *     Tue 2024-04-02    0 (no sale — but the day still appears)
 *     Wed 2024-04-03  120 (PAY005)
 *     Thu 2024-04-04    0
 *     Fri 2024-04-05    0
 *     Sat 2024-04-06    0
 *     Sun 2024-04-07    0
 */
const lesson07b: Lesson = {
  id: 7.5,
  title: 'Side quest: dim_date',
  schemaSketch: { svg: sketch, alt: 'DuckDB generate_series function on the left, an arrow, and the resulting dim_date table on the right with 366 rows' },
  concept: `Calendar attributes — day of the week, month name, quarter, is-holiday — show up in every dashboard but never in your source data. The usual fix is to re-derive them inline (\`EXTRACT(quarter FROM order_date)\`, \`dayname(order_date)\`) in every query. That gets old fast, and any two queries that disagree on the rule (does the fiscal quarter start in February?) silently produce different numbers.

A **date dimension** solves this: compute every calendar attribute *once*, in a table, then JOIN to it whenever a query needs them. The dim is *generated* (no source data), but it's still a dim — it has a grain (one day), a PK (\`date_day\`), and descriptive attributes that facts look up via the key.

This is an **optional side quest** — skip it and the main lab still works — but it ends on the pattern every dashboard secretly leans on: joining *from* a calendar so days with zero activity still appear instead of vanishing from the report.`,
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
      prompt: `Now the payoff the calendar dim was built for: **a daily revenue report where days with zero sales still show up.** Take the first week of April and \`LEFT JOIN\` *from* \`dim_date\` to \`raw_payments\` — the calendar is the spine, so every day appears whether or not a payment landed on it. (This is the \`LEFT JOIN\` from lesson 7, now anchored on a calendar so it keeps every day instead of every customer.)`,
      starterSql: `SELECT
    d.date_day,
    d.day_name,
    COALESCE(SUM(CASE WHEN p.payment_status = 'paid' THEN p.amount END), 0) AS paid_revenue
FROM dim_date d
LEFT JOIN raw_payments p ON p.payment_date = d.date_day
WHERE d.date_day BETWEEN DATE '2024-04-01' AND DATE '2024-04-07'
GROUP BY d.date_day, d.day_name
ORDER BY d.date_day;`,
      validate: (s) =>
        lastQuerySucceeded(s) &&
        lastQueryRowCountEquals(s, 7) &&
        lastQueryContainsRow(s, { day_name: 'Monday', paid_revenue: 280 }) &&
        lastQueryContainsRow(s, { day_name: 'Tuesday', paid_revenue: 0 }),
      explanation: `**Seven rows for seven days — even though only two of them had a sale.** Monday 280 (PAY004) and Wednesday 120 (PAY005); the other five days come back as 0, not missing. That's the whole point of a calendar spine: the dim supplies the days, the \`LEFT JOIN\` keeps every one of them, and \`COALESCE\` turns the no-match NULLs into clean zeros. Without the spine you'd \`GROUP BY payment_date\` and the empty days would simply vanish — a line chart with holes in it. (Bonus: the query is clean, too — \`day_name\` came from the dim, so no inline \`EXTRACT\`/\`CASE\` for the calendar attributes.)`,
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

export default lesson07b
