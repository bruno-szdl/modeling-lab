# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this is

The **Data Modeling Lab** — `modeling-lab.datagym.io`. A browser-only, no-account interactive lab that teaches data modeling *for analytics engineering*. Sister to `transform-lab` (the dbt lab); part of the DataGym.io family.

It is **not** a complete data-modeling course. It teaches the modeling decisions an analytics engineer makes when turning raw operational tables into analytics-ready models: grain, entity vs event, column roles, staging, dims, facts, keys/relationships, joins-that-don't-break-grain, fan-out, metrics + additivity, and the final marts.

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
    lesson02.ts     Entities, events, column roles
    lesson03.ts     The staging layer — CORE lesson (was side quest id 2.5,
                    promoted). Clean a messy raw_customers_messy into
                    stg_customers (trim/cast/rename/standardize), grain
                    preserved. Shaping only — no dedup/DQ asserts (that's
                    transform-lab). Self-contained: no seeds, builds its own
                    messy table in preMaterialize.
    lesson04.ts     Dimensions
    lesson05.ts     Facts (star schema; fact-vs-dim)
    lesson06.ts     Keys & relationships — PK vs FK, natural vs surrogate keys
                    (named, NOT built; type-2 stays v2), the lesson-1 grain
                    check reborn as the join-safety rule. Eases the Facts→Joins
                    jump and sets up fan-out. preMaterializes dim_customers +
                    fact_orders.
    lesson07.ts     Joins that don't break grain — the "joins that LOSE rows"
                    half (LEFT/INNER, WHERE-vs-ON, anti-join). preMaterializes
                    a phantom customer Eve (C999) for the LEFT/INNER contrast.
    lesson07b.ts    dim_date side quest (id 7.5 — sorts between 7 and 8, after
                    the joins lesson so its calendar-spine LEFT JOIN applies
                    L7 rather than previewing it; still before L10 needs it)
    lesson08.ts     Fan-out: the join that MULTIPLIES rows — the duplicate-PK /
                    broken-JOIN demo (6→8) + the 1800-vs-1060 SUM trap. The
                    mirror image of L7. (L8 + L9 are the split halves of the
                    old single metrics lesson.)
    lesson09.ts     Metrics & additivity — definition/formula/grain; additive
                    vs semi- vs non-additive; AOV ingredients (store ratios'
                    ingredients, not the ratio).
    lesson10.ts     The monthly mart (facts sliced by time).
    lesson11.ts     Dimension-sliced capstone (the star pays off — fact→dim
                    join, single source of truth). The FINALE; it
                    pre-materializes mart_monthly_sales so CourseComplete can
                    show both marts side by side.
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
    CourseComplete.tsx Mart finale (shown after lesson 11; previews both marts)
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

- **Side quests** use a non-integer id (dim_date is `7.5`; staging used to be the `2.5` side quest but was promoted to core lesson 3). `Number.isInteger(id)` distinguishes. The forward "Next lesson" routing for the fractional id lives in `nextLessonId` in `LessonPanel.tsx` (`7 → 7.5 → 8`).
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
| fan-out trap (SUM amount JOIN items, L8) | **1800** |
| AOV (1060 / 5 paid orders, L9) | 212 |
| mart_monthly_sales (L10) | 2 rows (2024-03 and 2024-04) |
| mart_sales_by_category (L11) | Course 780 / 5 units, Accessory 280 / 6 units |

## What's NOT in v1

- **Data quality / testing as a lesson** (notebook `02b`). Cut deliberately: testing is a discipline of its own and overlaps with transform-lab's territory. The grain check in lesson 1 is the only DQ touchpoint, framed as the operational definition of a PK — with a one-paragraph `dbtBridge` pointing the learner at transform-lab for the four named tests. Do **not** add a DQ side quest here; it would be a worse version of what transform-lab already does. (The staging lesson — now core lesson 3 — is *shaping*, not DQ: rename/cast/standardize/trim with the grain preserved, and it deliberately makes **no** test assertions — keep that line; the moment a contributor wants to add `not_null`/`unique`/`accepted_values` asserts, that's transform-lab's job.)
- SCDs and fact-table types (notebook 07/08) — deferred to v2. Type-1 vs type-2 and surrogate keys are *named* in lesson 4's name-edit checkpoint and in lesson 6 (Keys & relationships) — so type-1 overwrite and natural keys aren't taught as the whole story — but type-2 history and surrogate keys are not built here.
- The three notebook session quizzes — replaced by inline checkpoints
- Multi-language UI — EN only at launch
- AI / Claude framing — out of scope here
- Mobile layout — defer; SQL editor is awkward on phones

## When you make changes

1. `npm run build` must pass before declaring done. Type-checks + Vite build = the verification gate.
2. If you add a step that depends on a pre-built dim/fact, add it to `Lesson.preMaterialize` so the lesson is self-sufficient.
3. If you add a new lesson, register it in `src/lessons/index.ts`. The lesson selector in `Header.tsx` and the next/previous logic in `LessonPanel.tsx` derive from that list.
4. Inserting or reordering an *integer* lesson renumbers everything downstream — lesson `id`s, the `lessonNN.ts` / `lessonNN.svg` filenames, and the cross-lesson "Lesson N" references woven through concept/explanation text — and invalidates saved progress (keyed `<lessonId>.<stepId>`). Bump `PROGRESS_KEY` in `gameStore.ts` so in-flight learners reset cleanly, and update the hardcoded "What's inside" list in `IntroPage.tsx`.

See `datagym/DECISIONS.md` for the broader DataGym architecture decisions (subdomain convention, page-shape vs app-shape split, design-token sharing).
