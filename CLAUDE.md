# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this is

The **Data Modeling Lab** — `modeling-lab.datagym.io`. A browser-only, no-account interactive lab that teaches data modeling *for analytics engineering*. Sister to `transform-lab` (the dbt lab); part of the DataGym.io family.

It is **not** a complete data-modeling course. It teaches the modeling decisions an analytics engineer makes when turning raw operational tables into analytics-ready models: grain, entity vs event, column roles, dims, facts, joins-that-don't-break-grain, metrics + fan-out + additivity, and the final mart.

Audience: SQL-proficient analysts moving toward analytics engineering. Not absolute beginners.

## Commands

```sh
npm install
npm run dev      # http://localhost:5173 (Vite)
npm run build    # tsc -b && vite build → dist/
npm run lint     # eslint
```

## Architecture (cheat sheet)

```
src/
  engine/
    types.ts        Lesson, Step (SqlStep | CheckpointStep), LessonState, stepKey
    duckdb.ts       DuckDB-WASM bootstrap, runQuery/exec/registerCsv/resetDb
    sqlRunner.ts    Run the editor's SQL; multi-statement aware; lists materialized tables
    validators.ts   lastQueryRowHasValue / tableExists / lastQueryRowCountEquals / ...
    errors.ts       errorMessage(unknown) → string
  seeds/
    index.ts        DATASHOP_SEEDS — 5 raw CSVs from data-modeling-notebook/data/
    raw_*.csv       The DataShop dataset (4 cust, 4 prod, 6 orders, 9 items, 7 pmts)
  lessons/
    lesson00.ts     Full-page intro (rendered by IntroPage, not LessonPanel)
    lesson01.ts     Grain — fully polished reference
    lesson02..08    Fully authored (concept + 4-9 SQL/checkpoint steps each).
                    NOTE: lesson05 is the "joins that LOSE rows" half
                    (LEFT/INNER, WHERE-vs-ON, anti-join); the duplicate-PK /
                    broken-JOIN demo ("joins that MULTIPLY rows") opens
                    lesson06 and leads into fan-out. Not in lesson04.
                    lesson07 = the monthly mart (facts sliced by time);
                    lesson08 = the dimension-sliced capstone (the star pays
                    off — fact→dim join, single source of truth). lesson08 is
                    the finale; it pre-materializes mart_monthly_sales so
                    CourseComplete can show both marts side by side.
    lesson02b.ts    staging-layer side quest (id 2.5 — sorts between 2 and 3).
                    Cleans a deliberately messy raw_customers_messy into
                    stg_customers (trim/cast/rename/standardize), grain
                    preserved. Shaping only — no dedup/DQ asserts (that's
                    transform-lab). Self-contained: no seeds, builds its own
                    messy table in preMaterialize.
    lesson05b.ts    dim_date side quest (id 5.5 — sorts between 5 and 6, after
                    the joins lesson so its calendar-spine LEFT JOIN applies
                    L5 rather than previewing it; still before L7 needs it)
    index.ts        lessons[], getLessonById, getLastLessonId, isSideQuest, stepKey
                    NOTE: data-quality is NOT a lesson — see "What's NOT in v1" below
  store/
    gameStore.ts    Zustand: editorSql, lastQuery, materializedTables,
                    completedSteps, passedCheckpointKeys, runQuery, loadLesson, ...
  components/
    Workspace.tsx   3-region layout: LessonPanel | Editor / ResultsPanel
    LessonPanel.tsx Renders concept + steps[] (SQL or checkpoint)
    Editor.tsx      Single-buffer Monaco + Run button (⌘↵)
    ResultsPanel.tsx Renders `lastQuery` rows / error
    IntroPage.tsx   Lesson-0 landing
    CourseComplete.tsx Mart finale (shown after lesson 8; previews both marts)
    Header / LabBar / PrivacyPage / ErrorBoundary / Markdownish
```

## Lesson model

```ts
type Step =
  | { kind: 'sql'; id; prompt; hint?; solution?; explanation?;
      starterSql?: string; validate: (state: LessonState) => boolean }
  | { kind: 'checkpoint'; id; question; options: string[];
      correctIndex: number; explanation: string }

type Lesson = {
  id: number; title; concept; schemaSketch?; seeds?; preMaterialize?;
  steps: Step[]; furtherReading?; dbtBridge?
}
```

- **Side quests** use a non-integer id (staging is `2.5`, dim_date is `5.5`). `Number.isInteger(id)` distinguishes. The forward "Next lesson" routing for these fractional ids lives in `nextLessonId` in `LessonPanel.tsx`.
- **Lesson 0** has `steps: []`; it is the intro, rendered by `<IntroPage>` not `<LessonPanel>`.
- **Validators** are pure functions over `LessonState` (editor SQL, last query result, materialized tables, passed checkpoints). They run after every `runQuery`.

## Conventions

- **Single SQL buffer per lesson**, not a file tree (unlike transform-lab). Modeling lessons work against the raw seeds; the editor is a scratchpad.
- **Table naming**: flat `raw_customers`, not `raw.customers` source-style (matches the notebook).
- **No comments explaining what code does.** Only WHY-comments (hidden constraint, surprising behavior).
- **No em-dashes** in user-facing text where avoidable.
- **i18n**: currently English-only. PT support is the next major polish task.
- **dbt** appears only as `> 💡 In dbt: …` callouts inside `Lesson.dbtBridge`. It is a bridge, never a main topic.

## Reference numbers (DataShop)

Memorize these — every lesson keys off them.

| Table | Rows | PK | Notes |
|---|---|---|---|
| raw_customers | 4 | customer_id | — |
| raw_products | 4 | product_id | P003=80, P004=40 (basic); P001/P002 ≥100 (premium) |
| raw_orders | 6 | order_id | O003 cancelled |
| raw_order_items | 9 | order_item_id | 3 orders have multiple items |
| raw_payments | 7 | payment_id | O006 has 2 rows: paid + refunded |

| Metric | Value |
|---|---|
| gross_sales (cancelled excluded) | 1060 |
| paid_revenue (status='paid') | 1060 |
| fan-out trap (SUM amount JOIN items) | **1800** |
| AOV (1060 / 5 paid orders) | 212 |
| mart_monthly_sales | 2 rows (2024-03 and 2024-04) |
| mart_sales_by_category (L8) | Course 780 / 5 units, Accessory 280 / 6 units |

## What's NOT in v1

- **Data quality / testing as a lesson** (notebook `02b`). Cut deliberately: testing is a discipline of its own and overlaps with transform-lab's territory. The grain check in lesson 1 is the only DQ touchpoint, framed as the operational definition of a PK — with a one-paragraph `dbtBridge` pointing the learner at transform-lab for the four named tests. Do **not** add a DQ side quest here; it would be a worse version of what transform-lab already does. (The staging side quest at 2.5 is *shaping*, not DQ: rename/cast/standardize/trim with the grain preserved, and it deliberately makes **no** test assertions — keep that line; the moment a contributor wants to add `not_null`/`unique`/`accepted_values` asserts, that's transform-lab's job.)
- SCDs and fact-table types (notebook 07/08) — deferred to v2. Type-1 vs type-2 and surrogate keys are *named* in lesson 3's name-edit checkpoint (so type-1 overwrite isn't taught as the whole story), but type-2 history is not built here.
- The three notebook session quizzes — replaced by inline checkpoints
- Multi-language UI — EN only at launch
- AI / Claude framing — out of scope here
- Mobile layout — defer; SQL editor is awkward on phones

## When you make changes

1. `npm run build` must pass before declaring done. Type-checks + Vite build = the verification gate.
2. If you add a step that depends on a pre-built dim/fact, add it to `Lesson.preMaterialize` so the lesson is self-sufficient.
3. If you add a new lesson, register it in `src/lessons/index.ts`. The lesson selector in `Header.tsx` and the next/previous logic in `LessonPanel.tsx` derive from that list.

See `datagym/DECISIONS.md` for the broader DataGym architecture decisions (subdomain convention, page-shape vs app-shape split, design-token sharing).
