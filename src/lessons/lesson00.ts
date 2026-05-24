import type { Lesson } from '../engine/types'

/**
 * Lesson 0 is the intro / landing page. Rendered full-width by
 * `<IntroPage />`, NOT by `<LessonPanel />`. The fields below exist only so
 * `getLessonById(0)` resolves; no DuckDB seeds are loaded here.
 */
const lesson00: Lesson = {
  id: 0,
  title: 'Data Modeling Lab',
  concept: '',
  steps: [],
}

export default lesson00
