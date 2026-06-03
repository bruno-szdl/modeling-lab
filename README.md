# Data Modeling Lab

A browser-based, no-account lab that teaches **data modeling for analytics engineering** — grain, dimensions, facts, fan-out, and the final analytics mart. Sister lab to [transform-lab.datagym.io](https://transform-lab.datagym.io); part of the [DataGym.io](https://datagym.io) family.

> **Status: v1 content-complete.** The full 11-lesson arc plus the dim_date side quest is authored — concept text, SQL/checkpoint steps, validators, and schema sketches throughout. Lesson 0 (intro) and Lesson 1 (Grain) are the polished references.

## What it teaches

| # | Topic | Maps to notebook |
|---|-------|------------------|
| 0 | Intro / landing | — |
| 1 | The grain of a table | 01_o_grao_dos_dados |
| 2 | Entities, events, column roles | 02_entidades_eventos_e_colunas |
| 3 | The staging layer | — (shaping cleanup) |
| 4 | Dimensions | 03_dimensoes |
| 5 | Facts | 04_fatos_e_o_grao |
| 6 | Keys & relationships | — (new) |
| 7 | Joins that don't break grain | 04b_joins_para_analytics |
| 7b | Side quest: dim_date | 03b_dim_date |
| 8 | Fan-out: the join that multiplies rows | 05_metricas (mechanism half) |
| 9 | Metrics & additivity | 05_metricas (discipline half) |
| 10 | Build the mart | 06_o_mart_final |
| 11 | Slice by any dimension → finale | 06_o_mart_final |

Data quality / testing (notebook `02b`) is deliberately not a core lesson here. Lesson 1's grain test is functionally a `unique` test; the four-test family (`not_null`, `unique`, `accepted_values`, `relationships`) is the home turf of [transform-lab](https://transform-lab.datagym.io), where they get a proper YAML + CI treatment.

Bonus (type-2 SCDs, fact-table types) is deferred to v2 — surrogate keys and type-1-vs-type-2 are *named* in Lessons 4 and 6, but only built out in v2.

## Run

```sh
npm install
npm run dev      # http://localhost:5173
npm run build    # tsc + vite build → dist/
```

DuckDB-WASM runs in the browser. There is no backend. Lesson progress lives in `localStorage`.

## Architecture

- **Vite + React 19 + TypeScript strict** — SPA shell
- **DuckDB-WASM** — real SQL execution in the browser
- **Monaco** — single-buffer SQL editor (no file tree)
- **Zustand** (`src/store/gameStore.ts`) — all state
- **`@datagym/design`** — colors + fonts shared with the rest of DataGym

The lesson model lives in `src/engine/types.ts`. Each `Lesson` carries `steps: Step[]`, where a `Step` is either:

- `SqlStep` — prompt, starter SQL, hint, solution, explanation, and a `validate(state)` callback
- `CheckpointStep` — a multiple-choice modeling-judgement question

See `src/lessons/lesson01.ts` for the fully-polished reference.

## Deployment plan (deferred until v1 is content-complete)

- Subdomain: `modeling-lab.datagym.io`
- Separate Vercel project, DNS via Hostinger CNAME
- Plausible: add domain to tracked list (`pa-c87gbF8nEAP4EwX23Wzfa.js` site)
- Hub registration: flip `data-modeling` topic to `status: 'live'` in `datagym/src/data/topics.ts`

## Why "modeling-lab", not "data-modeling-quest"

See `datagym/DECISIONS.md` (2026-05-23) — single `-lab` suffix is the documented convention; `-quest` was retired.

## License

Proprietary. © 2026 Bruno Lima.
