import type { LessonState } from './types'

/**
 * Validators for SqlStep `validate(state)` callbacks. They key off the
 * learner's last query result (columns, rows) and what's been materialized,
 * NOT off the literal SQL text — there are many correct ways to write a query.
 *
 * Naming convention: every validator answers `state ⊨ <claim>?`.
 */

// ── last-query shape ──────────────────────────────────────────────────────────

/** Did the most recent run produce a result (vs. error / nothing)? */
export function lastQuerySucceeded(s: LessonState): boolean {
  return s.lastQuery?.result != null
}

/** Did the most recent run return EXACTLY `n` rows? */
export function lastQueryRowCountEquals(s: LessonState, n: number): boolean {
  const r = s.lastQuery?.result
  return r != null && r.rowCount === n
}

/** Did the most recent result have at least the given columns (lowercase compare)? */
export function lastQueryHasColumns(s: LessonState, expected: string[]): boolean {
  const r = s.lastQuery?.result
  if (!r) return false
  const have = new Set(r.columns.map((c) => c.toLowerCase()))
  return expected.every((c) => have.has(c.toLowerCase()))
}

/** Did the most recent result contain EXACTLY these columns (set equality, lowercase)? */
export function lastQueryColumnsEqual(s: LessonState, expected: string[]): boolean {
  const r = s.lastQuery?.result
  if (!r) return false
  if (r.columns.length !== expected.length) return false
  const have = new Set(r.columns.map((c) => c.toLowerCase()))
  return expected.every((c) => have.has(c.toLowerCase()))
}

/**
 * Find the row index in the last result whose `col` cell equals `key` (string
 * compare); returns -1 if not found.
 */
function findRowIndex(s: LessonState, col: string, key: unknown): number {
  const r = s.lastQuery?.result
  if (!r) return -1
  const ci = r.columns.findIndex((c) => c.toLowerCase() === col.toLowerCase())
  if (ci === -1) return -1
  for (let i = 0; i < r.rows.length; i++) {
    if (String(r.rows[i][ci]) === String(key)) return i
  }
  return -1
}

/**
 * Did the most recent result include a row where `keyCol = keyVal` and
 * `valueCol = expected` (string compare, so numeric / string both work)?
 */
export function lastQueryRowHasValue(
  s: LessonState,
  keyCol: string,
  keyVal: unknown,
  valueCol: string,
  expected: unknown,
): boolean {
  const r = s.lastQuery?.result
  if (!r) return false
  const rowIdx = findRowIndex(s, keyCol, keyVal)
  if (rowIdx === -1) return false
  const vi = r.columns.findIndex((c) => c.toLowerCase() === valueCol.toLowerCase())
  if (vi === -1) return false
  return String(r.rows[rowIdx][vi]) === String(expected)
}

/**
 * Did the most recent single-row, single-cell result equal `expected`? Handy
 * for `SELECT COUNT(*) FROM ...` style checks. Compares as string.
 */
export function lastQueryScalarEquals(s: LessonState, expected: unknown): boolean {
  const r = s.lastQuery?.result
  if (!r || r.rowCount !== 1 || r.columns.length !== 1) return false
  return String(r.rows[0][0]) === String(expected)
}

/**
 * Did the most recent result contain at least one row where EVERY column in
 * `cells` matches its given value (string compare)?
 */
export function lastQueryContainsRow(
  s: LessonState,
  cells: Record<string, unknown>,
): boolean {
  const r = s.lastQuery?.result
  if (!r) return false
  const colIdx: Record<string, number> = {}
  for (const k of Object.keys(cells)) {
    const idx = r.columns.findIndex((c) => c.toLowerCase() === k.toLowerCase())
    if (idx === -1) return false
    colIdx[k] = idx
  }
  return r.rows.some((row) =>
    Object.entries(cells).every(([k, v]) => String(row[colIdx[k]]) === String(v)),
  )
}

// ── warehouse state ───────────────────────────────────────────────────────────

/** Is `name` currently a table or view in DuckDB's main schema? */
export function tableExists(s: LessonState, name: string): boolean {
  return s.materializedTables.has(name)
}

/** Are ALL of `names` currently materialized? */
export function tablesExist(s: LessonState, names: string[]): boolean {
  return names.every((n) => s.materializedTables.has(n))
}

// ── editor text ───────────────────────────────────────────────────────────────

/** Does the editor's current SQL match the regex (case-insensitive by default)? */
export function editorSqlMatches(s: LessonState, pattern: RegExp): boolean {
  const flags = pattern.flags.includes('i') ? pattern.flags : pattern.flags + 'i'
  return new RegExp(pattern.source, flags).test(s.editorSql)
}
