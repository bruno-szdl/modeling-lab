import type { Lesson } from '../engine/types'
import { stepKey } from '../engine/types'
import lesson00 from './lesson00'
import lesson01 from './lesson01'
import lesson02 from './lesson02'
import lesson02b from './lesson02b'
import lesson03 from './lesson03'
import lesson04 from './lesson04'
import lesson05 from './lesson05'
import lesson05b from './lesson05b'
import lesson06 from './lesson06'
import lesson07 from './lesson07'
import lesson08 from './lesson08'

/**
 * Ordered curriculum. All lessons are fully authored.
 *
 *   0  — Intro (full-page)
 *   1  — The grain of a table
 *   2  — Entities, events, column roles
 *   2b — Side quest: the staging layer  (optional, sorts between 2 and 3;
 *                                        clean raw 1:1 before modeling it)
 *   3  — Dimensions
 *   4  — Facts                          (star schema; fact-vs-dim)
 *   5  — Joins that don't break grain   (LEFT/INNER, WHERE-vs-ON, anti-join
 *                                        — the "joins that LOSE rows" half)
 *   5b — Side quest: dim_date           (optional, sorts between 5 and 6;
 *                                        applies L5's LEFT JOIN to a calendar
 *                                        spine, before L7 leans on it)
 *   6  — Metrics, fan-out, additivity   (opens with the duplicate-PK
 *                                        broken-JOIN demo — "joins that
 *                                        MULTIPLY rows" — then fan-out)
 *   7  — Build the mart                 (the monthly mart: facts sliced by time)
 *   8  — Slice by any dimension         (the star pays off: same facts sliced
 *                                        by an attribute) → finale screen
 *
 * Data quality / testing is deliberately NOT a core lesson here. The grain
 * test in lesson 1 is functionally a `unique` test; transform-lab teaches
 * the dbt test family (`not_null`, `unique`, `accepted_values`,
 * `relationships`) in its proper home — YAML config, `dbt test`, CI. The
 * staging side quest (2b) shapes and cleans but deliberately does NOT assert
 * (no dedup / DQ tests) — that boundary also belongs to transform-lab.
 */
export const lessons: Lesson[] = [
  lesson00,
  lesson01,
  lesson02,
  lesson02b,
  lesson03,
  lesson04,
  lesson05,
  lesson05b,
  lesson06,
  lesson07,
  lesson08,
]

export function getLessonById(id: number): Lesson | undefined {
  return lessons.find((l) => l.id === id)
}

/** The highest content lesson id (the mart). Side quests (non-integer ids) don't count. */
export function getLastLessonId(): number {
  return lessons
    .filter((l) => Number.isInteger(l.id))
    .reduce((max, l) => (l.id > max ? l.id : max), 0)
}

/** True when the given id is a side quest (non-integer like 2.5 or 5.5). */
export function isSideQuest(id: number): boolean {
  return !Number.isInteger(id)
}

export { stepKey }
