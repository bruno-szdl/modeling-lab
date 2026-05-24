import type { Lesson } from '../engine/types'
import { stepKey } from '../engine/types'
import lesson00 from './lesson00'
import lesson01 from './lesson01'
import lesson02 from './lesson02'
import lesson03 from './lesson03'
import lesson04 from './lesson04'
import lesson04b from './lesson04b'
import lesson05 from './lesson05'
import lesson06 from './lesson06'
import lesson07 from './lesson07'
import lesson08 from './lesson08'

/**
 * Ordered curriculum.
 *
 *   0  — Intro (full-page)
 *   1  — The grain of a table          ✅ polished
 *   2  — Entities, events, column roles
 *   3  — Data quality checks
 *   4  — Dimensions
 *   4b — Side quest: dim_date           (optional, sorts between 4 and 5)
 *   5  — Facts
 *   6  — Joins that don't break grain
 *   7  — Metrics, fan-out, additivity
 *   8  — Build the mart                 → finale screen after completion
 *
 * Lesson 1 is the only fully-polished content lesson in this scaffold; 2–8
 * and 4b are well-typed stubs with concept text + 1–2 example steps each.
 */
export const lessons: Lesson[] = [
  lesson00,
  lesson01,
  lesson02,
  lesson03,
  lesson04,
  lesson04b,
  lesson05,
  lesson06,
  lesson07,
  lesson08,
]

export function getLessonById(id: number): Lesson | undefined {
  return lessons.find((l) => l.id === id)
}

/** The highest content lesson id (the mart). 4b is a side quest, doesn't count. */
export function getLastLessonId(): number {
  return lessons
    .filter((l) => Number.isInteger(l.id))
    .reduce((max, l) => (l.id > max ? l.id : max), 0)
}

/** True when the given id is a side quest (non-integer like 4.5 for 4b). */
export function isSideQuest(id: number): boolean {
  return !Number.isInteger(id)
}

export { stepKey }
