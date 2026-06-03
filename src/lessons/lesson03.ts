import type { Lesson } from '../engine/types'
import {
  lastQuerySucceeded,
  lastQueryRowCountEquals,
  lastQueryHasColumns,
  lastQueryContainsRow,
  tableExists,
} from '../engine/validators'
import sketch from '../sketches/lesson03.svg?raw'

/**
 * Lesson 3 — The staging layer.
 *
 * Sits between L2 (column roles) and L4 (dims), where the
 * raw -> staging -> models path is first relevant. The rest of the lab
 * folds staging into the dim/fact build (clean seeds); this lesson is
 * the one place the learner does the cleanup by hand.
 *
 * It is deliberately about *shaping*, not testing: rename to convention,
 * cast types, standardize values, trim. NO dedup / DQ assertions — that
 * boundary belongs to transform-lab (see CLAUDE.md "What's NOT in v1").
 *
 * Self-contained: no DATASHOP_SEEDS. preMaterialize builds one deliberately
 * messy table from VALUES so nothing here can touch the clean seeds other
 * lessons rely on.
 *
 * Expected results:
 *   raw_customers_messy            4 rows (off-convention names, padded text,
 *                                  mixed-case states, dates stored as strings)
 *   cleaned SELECT / stg_customers 4 rows, customer_id unique (grain unchanged)
 *     C001 Ana Lima   SP    (uf 'sp'   -> 'SP', name '  Ana Lima'  -> 'Ana Lima')
 *     C003 Clara Souza PR   (uf 'pr '  -> 'PR')
 *     C004 Diego Martins SP (uf 'Sp'   -> 'SP')
 */
const lesson03: Lesson = {
  id: 3,
  title: 'The staging layer',
  schemaSketch: {
    svg: sketch,
    alt: 'A messy raw_customers_messy table on the left (a customer name padded with spaces, a lowercase state code, a signup date stored as text) flows through a trim/cast/rename arrow into a clean stg_customers table on the right, with the same number of rows.',
  },
  concept: `Before you model anything, the raw table has to be *trustworthy*. Operational systems hand you data that's almost right: column names nobody agreed on, dates stored as text, a state code that's \`SP\` on one row and \`sp\` on the next, a name with a stray leading space. The **staging layer** is where you fix exactly that.

The full path a table travels is \`raw → staging → models (dims + facts) → mart\`. Staging is the first hop: **one staging model per raw table**, cleaning it **1:1** — rename to a convention, cast types, standardize values, trim the junk — *without changing the grain*. One row in goes to one row out. By convention we name it \`stg_*\`.

What staging is **not**: it isn't modeling yet. No joins, no derived business rules, no \`price_band\`, no dims. It just makes the raw table clean and predictable so the dim and fact you build next can assume good inputs. (The rest of this lab folds this cleanup straight into the dim/fact build to keep the focus on modeling decisions — this lesson is the one place you do it by hand.)`,
  dbtBridge: `In dbt these live in \`models/staging/\` — one \`stg_*.sql\` per source, usually materialized as a *view*, doing precisely this rename/cast/standardize hop from \`source()\` to a clean staging model. The [data transformation lab](https://transform-lab.datagym.io) builds them properly.`,
  // No seeds: this lesson works against one deliberately messy table so it
  // never has to share the stage with the clean raw_customers other lessons use.
  preMaterialize: [
    `CREATE OR REPLACE TABLE raw_customers_messy AS
       SELECT * FROM (VALUES
         ('C001', '  Ana Lima',    'São Paulo',     'sp',  '2024-01-10'),
         ('C002', 'Bruno Costa ',  'Florianópolis', 'SC',  '2024-01-15'),
         ('C003', ' Clara Souza ', 'Curitiba',      'pr ', '2024-02-01'),
         ('C004', 'Diego Martins', 'São Paulo',     'Sp',  '2024-02-20')
       ) AS t(id, customer, city, uf, signup)`,
  ],
  steps: [
    {
      kind: 'sql',
      id: 'see-the-mess',
      prompt: `Meet \`raw_customers_messy\` — the same four customers you know, straight off an operational system. Run the \`SELECT *\` and read it closely: the column names are off-convention (\`id\`, \`customer\`, \`uf\`), some names carry stray spaces, the state code mixes cases (\`sp\` / \`SC\` / \`Sp\`), and \`signup\` is a date stored as **text**.`,
      starterSql: `SELECT * FROM raw_customers_messy;`,
      validate: (s) =>
        lastQuerySucceeded(s) && lastQueryRowCountEquals(s, 4),
      explanation: `Four rows, and every one needs a little work before it's safe to model: \`'  Ana Lima'\` has leading spaces, \`'sp'\` and \`'Sp'\` should both be \`SP\`, and \`signup\` is a string that won't sort or filter like a real date. None of this is a *modeling* problem — it's a *cleanup* problem, and that's exactly what staging is for.`,
    },
    {
      kind: 'sql',
      id: 'clean-and-rename',
      prompt: `Clean it in one \`SELECT\` (no table yet). The starter already renames the columns to convention, \`TRIM\`s the name, and casts \`signup\` to a real \`DATE\`. Your job: standardize the state into a \`state\` column so \`sp\`, \`pr \`, and \`Sp\` all come out as clean two-letter uppercase codes.`,
      starterSql: `SELECT
    id             AS customer_id,
    TRIM(customer) AS customer_name,
    city,
    -- TODO: add a clean state column: UPPER(TRIM(uf)) AS state
    signup::DATE   AS signup_date
FROM raw_customers_messy;`,
      hint: `Add \`UPPER(TRIM(uf)) AS state,\` on its own line after \`city,\` (mind the trailing comma).`,
      solution: `SELECT
    id              AS customer_id,
    TRIM(customer)  AS customer_name,
    city,
    UPPER(TRIM(uf)) AS state,
    signup::DATE    AS signup_date
FROM raw_customers_messy;`,
      validate: (s) =>
        lastQuerySucceeded(s) &&
        lastQueryRowCountEquals(s, 4) &&
        lastQueryHasColumns(s, ['customer_id', 'customer_name', 'state', 'signup_date']) &&
        lastQueryContainsRow(s, { customer_id: 'C001', customer_name: 'Ana Lima', state: 'SP' }) &&
        lastQueryContainsRow(s, { customer_id: 'C003', state: 'PR' }) &&
        lastQueryContainsRow(s, { customer_id: 'C004', state: 'SP' }),
      explanation: `Every column now has a clean name, a clean type, and a standardized value: \`'  Ana Lima'\` trimmed to \`Ana Lima\`, \`'sp'\` and \`'Sp'\` both folded to \`SP\`, and \`signup\` is now a genuine \`DATE\` you can sort and filter. Notice this is still **four rows in, four rows out** — every fix was column-level. Staging cleans *values and types*; it never reshapes the table.`,
    },
    {
      kind: 'sql',
      id: 'persist-stg-customers',
      prompt: `Persist the clean query as \`stg_customers\`, then prove the grain survived the cleanup. Run the lesson-1 grain check on the new table: total rows and distinct \`customer_id\`s should both be **4**.`,
      starterSql: `CREATE OR REPLACE TABLE stg_customers AS
SELECT
    id              AS customer_id,
    TRIM(customer)  AS customer_name,
    city,
    UPPER(TRIM(uf)) AS state,
    signup::DATE    AS signup_date
FROM raw_customers_messy;

-- Grain unchanged? Prove it: total rows AND distinct customer_ids.
SELECT
    COUNT(*) AS total_rows
    -- TODO: add COUNT(DISTINCT customer_id) AS distinct_customer_ids
FROM stg_customers;`,
      hint: `Add \`, COUNT(DISTINCT customer_id) AS distinct_customer_ids\` after the first count (mind the comma).`,
      solution: `CREATE OR REPLACE TABLE stg_customers AS
SELECT
    id              AS customer_id,
    TRIM(customer)  AS customer_name,
    city,
    UPPER(TRIM(uf)) AS state,
    signup::DATE    AS signup_date
FROM raw_customers_messy;

SELECT
    COUNT(*)                    AS total_rows,
    COUNT(DISTINCT customer_id) AS distinct_customer_ids
FROM stg_customers;`,
      validate: (s) =>
        lastQuerySucceeded(s) &&
        tableExists(s, 'stg_customers') &&
        lastQueryHasColumns(s, ['total_rows', 'distinct_customer_ids']) &&
        lastQueryContainsRow(s, { total_rows: 4, distinct_customer_ids: 4 }),
      explanation: `**4 and 4** — same grain as the raw table, just clean. \`stg_customers\` is now the trustworthy foundation: when the next lesson builds \`dim_customers\`, it can assume the name is trimmed, the state is standardized, and \`signup_date\` is a real date — and spend its energy on *modeling* decisions (what to derive, what to document) instead of cleanup.`,
    },
    {
      kind: 'checkpoint',
      id: 'staging-vs-dim',
      question: `You just built \`stg_customers\`. Why isn't it already \`dim_customers\` — what's the difference?`,
      options: [
        'No difference — `stg_customers` and `dim_customers` are two names for the same thing',
        'Staging cleans the raw table 1:1 (rename, cast, standardize) while preserving its grain; the dim is the next hop, where you add derived business attributes like `signup_year` or `price_band`. Staging makes raw trustworthy; the dim makes it useful.',
        '`stg_customers` is a dim — it just needs to be renamed with a `dim_` prefix',
        'Staging tables can\'t be joined to facts, only dims can',
      ],
      correctIndex: 1,
      explanation: `**Staging is cleanup; the dim is modeling.** \`stg_customers\` did the 1:1 work — rename, cast, trim, standardize — and kept one row per customer. The dim is what comes next: it takes that clean input and *adds value* (a derived \`signup_year\`, a documented \`price_band\`, the agreed-upon description of the entity). Same grain, different job. Keeping them as separate hops means a downstream surprise has an obvious home: a type or casing bug is a staging fix, a business-rule change is a dim fix.`,
    },
  ],
}

export default lesson03
