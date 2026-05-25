import { runQuery, exec, type QueryResult } from './duckdb'
import { errorMessage } from './errors'

export interface RunOutcome {
  sql: string
  result: QueryResult | null
  error: string | null
  elapsedMs: number
}

/**
 * Run the learner's SQL against the in-browser DuckDB.
 *
 * If the buffer contains multiple statements (`;`-separated), all but the
 * last are `exec()`ed (no result), and the last is `runQuery`ed so the rows
 * land in the Results panel. This mirrors what people expect from a notebook
 * cell: "run my CREATE TABLE then SELECT".
 *
 * Empty / whitespace-only input returns a "no SQL" error rather than
 * succeeding with nothing.
 */
export async function runEditorSql(sql: string): Promise<RunOutcome> {
  const start = performance.now()
  const trimmed = sql.trim()
  if (!trimmed) {
    return { sql, result: null, error: 'No SQL to run.', elapsedMs: 0 }
  }
  // Naive split on `;` followed by whitespace. Good enough for the lab —
  // learners aren't writing string literals with embedded semicolons.
  const stmts = trimmed
    .split(/;\s*(?=\S)/)
    .map((s) => s.replace(/;\s*$/, '').trim())
    .filter((s) => s.length > 0)

  try {
    for (let i = 0; i < stmts.length - 1; i++) {
      await exec(stmts[i])
    }
    const final = stmts[stmts.length - 1]
    let result: QueryResult | null = null
    if (isResultProducing(final)) {
      result = await runQuery(final)
    } else {
      await exec(final)
    }
    return { sql, result, error: null, elapsedMs: performance.now() - start }
  } catch (e) {
    return { sql, result: null, error: errorMessage(e), elapsedMs: performance.now() - start }
  }
}

/**
 * Heuristic: does this single statement return rows we should display?
 * SELECT / WITH / SHOW / DESCRIBE / PRAGMA / CALL / VALUES — yes.
 * Everything else (CREATE, INSERT, UPDATE, DELETE, DROP, ATTACH, …) — no.
 *
 * Strips leading SQL comments before checking the first keyword. Otherwise
 * a starter like `-- TODO: …\nSELECT …` would be mis-classified as
 * "no rows" because the head would start with `--`.
 */
function isResultProducing(stmt: string): boolean {
  let s = stmt.trimStart()
  while (true) {
    if (s.startsWith('--')) {
      const nl = s.indexOf('\n')
      if (nl === -1) return false
      s = s.slice(nl + 1).trimStart()
    } else if (s.startsWith('/*')) {
      const end = s.indexOf('*/')
      if (end === -1) return false
      s = s.slice(end + 2).trimStart()
    } else {
      break
    }
  }
  const head = s.slice(0, 12).toUpperCase()
  return (
    head.startsWith('SELECT') ||
    head.startsWith('WITH ') ||
    head.startsWith('SHOW ') ||
    head.startsWith('DESCRIBE') ||
    head.startsWith('PRAGMA') ||
    head.startsWith('CALL ') ||
    head.startsWith('VALUES')
  )
}

/** List the user-created tables and views in DuckDB's main schema. */
export async function listMaterializedTables(): Promise<string[]> {
  try {
    const r = await runQuery(
      `SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'main'
        ORDER BY table_name`,
    )
    return r.rows.map((row) => String(row[0]))
  } catch {
    return []
  }
}
