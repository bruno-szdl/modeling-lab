# Data Modeling Lab

A browser-based, no-account lab that teaches **data modeling for analytics engineering** — grain, dimensions, facts, fan-out, and the final analytics mart. Sister lab to [transform-lab.datagym.io](https://transform-lab.datagym.io); part of the [DataGym.io](https://datagym.io) family.

> **Status: v1 scaffold.** Lesson 0 (intro) and Lesson 1 (Grain) are fully polished. Lessons 2-8 + 4b (dim_date side quest) are well-typed stubs with concept text + 1-2 example steps each. The remaining content is the next iteration.

## What it teaches

| # | Topic | Maps to notebook |
|---|-------|------------------|
| 0 | Intro / landing | — |
| 1 | The grain of a table | 01_o_grao_dos_dados |
| 2 | Entities, events, column roles | 02_entidades_eventos_e_colunas |
| 3 | Data quality checks | 02b_qualidade_dos_dados |
| 4 | Dimensions | 03_dimensoes |
| 4b | Side quest: dim_date | 03b_dim_date |
| 5 | Facts | 04_fatos_e_o_grao |
| 6 | Joins that don't break grain | 04b_joins_para_analytics |
| 7 | Metrics, fan-out, additivity | 05_metricas |
| 8 | Build the mart → finale | 06_o_mart_final |

Bonus (SCDs, fact-table types) is deferred to v2.

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
