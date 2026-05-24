import type { QueryResult } from './duckdb'

export interface LastQueryResult {
  /** The SQL that produced this result (or attempted to). */
  sql: string
  /** Populated on a successful run; null when the SQL errored. */
  result: QueryResult | null
  /** Populated on error; null on success. */
  error: string | null
  /** Wall-clock ms the query took. */
  elapsedMs: number
}

/**
 * The full observable state a Step's validator can key off. Validators are
 * pure functions over this snapshot so they re-run any time it changes.
 */
export interface LessonState {
  /** Editor buffer (single SQL document per lesson). */
  editorSql: string
  /** Whatever the learner's last `Run` produced (success or error). */
  lastQuery: LastQueryResult | null
  /** Tables / views currently materialized in the warehouse (DuckDB main schema). */
  materializedTables: Set<string>
  /** Checkpoint step ids the learner has answered correctly in this lesson. */
  passedCheckpoints: Set<string>
}

/** A single SQL exercise: prompt → editor → run → optional explanation. */
export interface SqlStep {
  kind: 'sql'
  id: string
  /** Short scenario / business question the learner is answering. */
  prompt: string
  /** SQL the editor is prefilled with when this step becomes active. */
  starterSql?: string
  /** Optional hint, revealed on demand. */
  hint?: string
  /** Optional reference solution — shown after they pass, or via "Reveal solution". */
  solution?: string
  /**
   * Explanation shown once the step is completed. The "what just happened"
   * panel that replaces the notebook's accordion. Plain markdown-ish text.
   */
  explanation?: string
  /** True when the learner's current state satisfies the step. */
  validate: (state: LessonState) => boolean
}

/** A modeling-judgement checkpoint. Multiple choice, one correct answer. */
export interface CheckpointStep {
  kind: 'checkpoint'
  id: string
  /** The decision question. e.g. "What does one row in raw_order_items represent?". */
  question: string
  options: string[]
  correctIndex: number
  /** Shown after they pick — the "why" behind the right answer. */
  explanation: string
}

export type Step = SqlStep | CheckpointStep

export interface FurtherReadingLink {
  label: string
  url: string
}

/**
 * Per-lesson schema sketch shown in the concept area. Kept simple on
 * purpose — modeling lessons benefit from a single static picture, not a
 * live graph.
 *
 * `svg` is the raw markup of an SVG element. Import each sketch via
 * `import sketch from '../sketches/lessonN.svg?raw'` so colours can use
 * `currentColor` and `var(--color-accent-orange)`, inheriting from the
 * surrounding LessonPanel (and therefore respecting light/dark themes).
 */
export interface SchemaSketch {
  /** Raw inline SVG markup. */
  svg: string
  /** Alt text describing what the sketch depicts. */
  alt: string
}

export interface Lesson {
  id: number
  title: string
  /**
   * Concept text shown at the top of the lesson panel. Markdown-ish (the
   * same subset Markdownish supports).
   */
  concept: string
  /** Optional per-lesson schema-at-a-glance picture, rendered under the concept. */
  schemaSketch?: SchemaSketch
  /**
   * CSV blobs registered as DuckDB tables when this lesson loads. Key = table
   * name (e.g. 'raw_customers'); value = CSV string.
   */
  seeds?: Record<string, string>
  /**
   * SQL run silently on lesson load AFTER seeds. Used to pre-build any
   * dim_* / fact_* the lesson treats as "already there" (see notebook
   * decision #5: each lesson is self-sufficient).
   */
  preMaterialize?: string[]
  /** Ordered list of SQL tasks and checkpoints. */
  steps: Step[]
  furtherReading?: FurtherReadingLink[]
  /**
   * Optional `> 💡 In dbt...` bridge callout shown at the bottom of the
   * concept. Keeps the dbt-as-bridge framing without making it a section.
   */
  dbtBridge?: string
}

/** Stable key for a Step's progress entry: `<lessonId>.<stepId>`. */
export function stepKey(lessonId: number, stepId: string): string {
  return `${lessonId}.${stepId}`
}
