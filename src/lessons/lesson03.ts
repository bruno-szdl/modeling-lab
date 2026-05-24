import type { Lesson } from '../engine/types'
import {
  lastQuerySucceeded,
  lastQueryRowCountEquals,
  lastQueryHasColumns,
  lastQueryContainsRow,
  tableExists,
} from '../engine/validators'
import { DATASHOP_SEEDS } from '../seeds'

/**
 * Lesson 3 — Dimensions.
 *
 * Maps to notebook 03. Teaches:
 *   - a dim is one row per entity, many descriptive columns, zero metrics
 *   - building a dim is a *choice* (rename, derive, drop, document)
 *   - list_price vs unit_price is the attribute-vs-metric trap that
 *     trips people up most often
 *   - dims are small and stable; the "scaling" reflex sets up Lesson 4
 *
 * Reference data (DataShop):
 *   raw_customers: 4 rows, all signup_year = 2024
 *   raw_products:  P001/P002 list_price >= 100 (premium); P003/P004 < 100 (basic)
 *
 * Side quest (Lesson 3b) builds dim_date — optional follow-up, not a
 * dependency of lesson 4.
 */
const lesson03: Lesson = {
  id: 3,
  title: 'Dimensions',
  concept: `A **dimension** table is one row per **entity** — one customer, one product. It carries the descriptive attributes that every report and chart will reach for: name, city, category, price band. By convention, we name it \`dim_*\`.

Three things matter:
1. **Few rows, many columns.** Dimensions describe small, stable sets. Adding a customer means adding *one* row.
2. **No metrics live here.** Quantities and amounts belong in facts (next lesson). \`list_price\` is the *posted* price of the product — an attribute. \`unit_price\` from \`raw_order_items\` is the price actually *paid* in one sale — a metric. Same kind of value, different role.
3. **Building a dim is a choice.** What columns to include, what to rename, what to derive (a \`signup_year\` from \`signup_date\`, a \`price_band\` from \`list_price\`). The dim is the canonical, agreed-upon description of the entity. If a rule lives in 20 reports, those reports will drift; if it lives in the dim, they can't.`,
  dbtBridge: `In dbt, a dim is just a SQL file at \`models/marts/dim_customers.sql\` returning the dim shape. \`unique\` and \`not_null\` tests on the PK column (the same ones you ran in lesson 1) lock the contract — downstream models can trust that \`customer_id\` is a real key.`,
  seeds: DATASHOP_SEEDS,
  steps: [
    {
      kind: 'sql',
      id: 'build-minimal-dim',
      prompt: `Build your first dimension: \`dim_customers\`, starting as an exact copy of \`raw_customers\`. The starter SQL creates the table; then it selects from it so the results panel shows you what's there.`,
      starterSql: `CREATE OR REPLACE TABLE dim_customers AS
SELECT * FROM raw_customers;

SELECT * FROM dim_customers;`,
      validate: (s) =>
        lastQuerySucceeded(s) &&
        tableExists(s, 'dim_customers') &&
        lastQueryRowCountEquals(s, 4) &&
        lastQueryHasColumns(s, ['customer_id', 'customer_name']),
      explanation: `\`dim_customers\` now exists in the warehouse. It looks identical to \`raw_customers\` — which is the right starting point. The act of *declaring* it as a dim is the modeling decision: from now on, every other model that needs customer attributes joins to \`dim_customers\`, not to the raw table. Same data, different contract.`,
    },
    {
      kind: 'sql',
      id: 'add-derived-attribute',
      prompt: `Now make the dim earn its keep: rebuild \`dim_customers\` with a derived \`signup_year\` column extracted from \`signup_date\`. Every downstream "customers acquired in 2024" report can now group by this column instead of re-deriving the year each time.`,
      starterSql: `CREATE OR REPLACE TABLE dim_customers AS
SELECT
    customer_id,
    customer_name,
    city,
    state,
    signup_date,
    -- TODO: add signup_year here
FROM raw_customers;

SELECT * FROM dim_customers;`,
      hint: `\`EXTRACT(year FROM signup_date) AS signup_year\` — drop it into the SELECT list.`,
      solution: `CREATE OR REPLACE TABLE dim_customers AS
SELECT
    customer_id,
    customer_name,
    city,
    state,
    signup_date,
    EXTRACT(year FROM signup_date) AS signup_year
FROM raw_customers;

SELECT * FROM dim_customers;`,
      validate: (s) =>
        lastQuerySucceeded(s) &&
        tableExists(s, 'dim_customers') &&
        lastQueryRowCountEquals(s, 4) &&
        lastQueryHasColumns(s, ['signup_year']) &&
        lastQueryContainsRow(s, { customer_id: 'C001', signup_year: 2024 }),
      explanation: `Every customer's \`signup_year\` is computed *once*, here, in the dim. Reports stop re-deriving \`EXTRACT(year FROM ...)\` in every query. This is the modeling habit: **if a rule recurs, it lives in the dim.**`,
    },
    {
      kind: 'checkpoint',
      id: 'list-price-vs-unit-price',
      question: `\`raw_products.list_price\` is the **posted** price of a product. What role does it play?`,
      options: [
        'Identifier — it\'s a unique number per product',
        'Descriptive attribute — it describes the product itself',
        'Metric — it\'s a number, so you\'d \`SUM\` it for total revenue',
        'Foreign key — it links to a price table',
      ],
      correctIndex: 1,
      explanation: `\`list_price\` is a **property of the product** — same value on every row about that product, never aggregated. It's an attribute, even though it's numeric. Contrast it with \`unit_price\` from \`raw_order_items\`: that's the price *actually paid* in one specific sale, and *that* one is a metric (you'd \`SUM\` it for revenue, or \`AVG\` it for average sale price). Same kind of value, different role — because they belong to different things.`,
    },
    {
      kind: 'sql',
      id: 'build-dim-products',
      prompt: `Build \`dim_products\` with a derived \`price_band\` column: products with \`list_price >= 100\` are *premium*, everything else is *basic*. This is the kind of business rule that absolutely has to live in one place.`,
      starterSql: `CREATE OR REPLACE TABLE dim_products AS
SELECT
    product_id,
    product_name,
    category,
    list_price,
    -- TODO: add price_band ('premium' / 'basic') based on list_price
FROM raw_products;

SELECT * FROM dim_products ORDER BY product_id;`,
      hint: `\`CASE WHEN list_price >= 100 THEN 'premium' ELSE 'basic' END AS price_band\``,
      solution: `CREATE OR REPLACE TABLE dim_products AS
SELECT
    product_id,
    product_name,
    category,
    list_price,
    CASE WHEN list_price >= 100 THEN 'premium' ELSE 'basic' END AS price_band
FROM raw_products;

SELECT * FROM dim_products ORDER BY product_id;`,
      validate: (s) =>
        lastQuerySucceeded(s) &&
        tableExists(s, 'dim_products') &&
        lastQueryRowCountEquals(s, 4) &&
        lastQueryHasColumns(s, ['price_band']) &&
        lastQueryContainsRow(s, { product_id: 'P001', price_band: 'premium' }) &&
        lastQueryContainsRow(s, { product_id: 'P002', price_band: 'premium' }) &&
        lastQueryContainsRow(s, { product_id: 'P003', price_band: 'basic' }) &&
        lastQueryContainsRow(s, { product_id: 'P004', price_band: 'basic' }),
      explanation: `Two premium (P001, P002), two basic (P003, P004). The \`price_band\` rule now exists in **one** place — change the threshold from 100 to 150 here, and every downstream report that joins to \`dim_products\` picks up the new rule for free. Bury the same rule in 20 queries and you'll spend a week tracking down the one that didn't get updated.`,
    },
    {
      kind: 'checkpoint',
      id: 'where-does-name-live',
      question: `A customer emails: "you've misspelled my name on every receipt." You confirm — \`customer_name\` is wrong in one place. Where do you edit it?`,
      options: [
        'In every \`fact_orders\` row that mentions that customer',
        'In \`dim_customers\` — one row, one edit, and every join picks up the fix',
        'In both \`dim_customers\` and \`fact_orders\` to keep them consistent',
        'Edit the raw CSV and rebuild everything',
      ],
      correctIndex: 1,
      explanation: `That's *the* reason dimensions exist. Descriptive attributes live in **one place**, the dim. Facts carry only the foreign key (\`customer_id\`); they pick the customer's current name up through a JOIN at query time. If \`customer_name\` were duplicated onto every fact row, a name change would require touching thousands of rows — and one missed update means an inconsistent dashboard.`,
    },
    {
      kind: 'checkpoint',
      id: 'scaling-shape',
      question: `DataShop scales: 10 million orders next year. Which table grows fastest?`,
      options: [
        '\`dim_customers\` — every order brings new customer data',
        '\`fact_orders\` — every order is a new row',
        'Both grow at the same rate; they\'re linked',
        '\`dim_products\` — more orders mean more products',
      ],
      correctIndex: 1,
      explanation: `Facts grow forever as events happen — that's the *shape* of a fact table. Dimensions describe a stable, small set: 10 million orders might come from only 100,000 distinct customers, and \`dim_customers\` only has to grow when a *new* one signs up. This asymmetry — small, stable dims; large, ever-growing facts — is exactly why we split them. Next lesson builds the fact side.`,
    },
  ],
}

export default lesson03
