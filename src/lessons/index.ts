import type { Lesson } from '../engine/types'
import { stepKey } from '../engine/types'
import lesson00 from './lesson00'
import lesson01 from './lesson01'
import lesson02 from './lesson02'
import lesson03 from './lesson03'
import lesson04 from './lesson04'
import lesson05 from './lesson05'
import lesson06 from './lesson06'
import lesson07 from './lesson07'
import lesson07b from './lesson07b'
import lesson08 from './lesson08'
import lesson09 from './lesson09'
import lesson10 from './lesson10'
import lesson11 from './lesson11'

/**
 * Ordered curriculum. All lessons are fully authored.
 *
 *   0   — Intro (full-page)
 *   1   — The grain of a table
 *   2   — Entities, events, column roles
 *   3   — The staging layer            (clean raw 1:1 before modeling it)
 *   4   — Dimensions
 *   5   — Facts                        (star schema; fact-vs-dim)
 *   6   — Keys & relationships         (FK/PK, natural vs surrogate, the grain
 *                                       check reborn as the join-safety rule)
 *   7   — Joins that don't break grain (LEFT/INNER, WHERE-vs-ON, anti-join
 *                                       — the "joins that LOSE rows" half)
 *   7b  — Side quest: dim_date         (optional, sorts between 7 and 8;
 *                                       applies L7's LEFT JOIN to a calendar
 *                                       spine, before L10 leans on it)
 *   8   — Fan-out: the join that       (the duplicate-PK broken-JOIN demo —
 *         multiplies rows               "joins that MULTIPLY rows" — and the
 *                                       1800-vs-1060 fan-out trap)
 *   9   — Metrics & additivity         (definition/formula/grain; additive vs
 *                                       semi vs non-additive; AOV ingredients)
 *   10  — Build the report             (the monthly report: facts sliced by time)
 *   11  — Slice by any dimension       (the star pays off: same facts sliced
 *                                       by an attribute) → finale screen
 *
 * Data quality / testing is deliberately NOT a core lesson here. The grain
 * test in lesson 1 is functionally a `unique` test; transform-lab teaches
 * the dbt test family (`not_null`, `unique`, `accepted_values`,
 * `relationships`) in its proper home — YAML config, `dbt test`, CI. The
 * staging lesson (3) shapes and cleans but deliberately does NOT assert
 * (no dedup / DQ tests) — that boundary also belongs to transform-lab.
 */
export const lessons: Lesson[] = [
  lesson00,
  lesson01,
  lesson02,
  lesson03,
  lesson04,
  lesson05,
  lesson06,
  lesson07,
  lesson07b,
  lesson08,
  lesson09,
  lesson10,
  lesson11,
]

export function getLessonById(id: number): Lesson | undefined {
  return lessons.find((l) => l.id === id)
}

/** The highest content lesson id (the capstone). Side quests (non-integer ids) don't count. */
export function getLastLessonId(): number {
  return lessons
    .filter((l) => Number.isInteger(l.id))
    .reduce((max, l) => (l.id > max ? l.id : max), 0)
}

/** True when the given id is a side quest (non-integer like 7.5). */
export function isSideQuest(id: number): boolean {
  return !Number.isInteger(id)
}

export { stepKey }
