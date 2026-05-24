import type { Lesson } from '../engine/types'
import { stepKey } from '../engine/types'
import lesson00 from './lesson00'
import lesson01 from './lesson01'
import lesson02 from './lesson02'
import lesson03 from './lesson03'
import lesson03b from './lesson03b'
import lesson04 from './lesson04'
import lesson05 from './lesson05'
import lesson06 from './lesson06'
import lesson07 from './lesson07'

/**
 * Ordered curriculum.
 *
 *   0  — Intro (full-page)
 *   1  — The grain of a table          ✅ polished
 *   2  — Entities, events, column roles
 *   3  — Dimensions
 *   3b — Side quest: dim_date           (optional, sorts between 3 and 4)
 *   4  — Facts
 *   5  — Joins that don't break grain
 *   6  — Metrics, fan-out, additivity
 *   7  — Build the mart                 → finale screen after completion
 *
 * Data quality / testing is deliberately NOT a core lesson here. The grain
 * test in lesson 1 is functionally a `unique` test; transform-lab teaches
 * the dbt test family (`not_null`, `unique`, `accepted_values`,
 * `relationships`) in its proper home — YAML config, `dbt test`, CI.
 */
export const lessons: Lesson[] = [
  lesson00,
  lesson01,
  lesson02,
  lesson03,
  lesson03b,
  lesson04,
  lesson05,
  lesson06,
  lesson07,
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

/** True when the given id is a side quest (non-integer like 3.5 for 3b). */
export function isSideQuest(id: number): boolean {
  return !Number.isInteger(id)
}

export { stepKey }
