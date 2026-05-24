import * as duckdb from '@duckdb/duckdb-wasm'
import duckdb_wasm_mvp from '@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url'
import mvp_worker from '@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url'
import duckdb_wasm_eh from '@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url'
import eh_worker from '@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url'
import { Type, type DataType } from 'apache-arrow'

// Arrow exposes both the abstract category id (Type.Date=8, Type.Timestamp=10)
// and the concrete-subclass ids (DateDay=-13, …); duckdb-wasm has been seen to
// hand back the abstract id for CSV-inferred columns, so match against both.
const DATE_TYPE_IDS: ReadonlySet<number> = new Set([Type.Date, Type.DateDay, Type.DateMillisecond])
const TIMESTAMP_TYPE_IDS: ReadonlySet<number> = new Set([
  Type.Timestamp,
  Type.TimestampSecond,
  Type.TimestampMillisecond,
  Type.TimestampMicrosecond,
  Type.TimestampNanosecond,
])

const BUNDLES: duckdb.DuckDBBundles = {
  mvp: { mainModule: duckdb_wasm_mvp, mainWorker: mvp_worker },
  eh: { mainModule: duckdb_wasm_eh, mainWorker: eh_worker },
}

let dbPromise: Promise<duckdb.AsyncDuckDB> | null = null

async function createDb(): Promise<duckdb.AsyncDuckDB> {
  const bundle = await duckdb.selectBundle(BUNDLES)
  const worker = new Worker(bundle.mainWorker!)
  const logger = new duckdb.VoidLogger()
  const db = new duckdb.AsyncDuckDB(logger, worker)
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker)
  await db.open({ query: { castBigIntToDouble: true } })
  return db
}

export function getDb(): Promise<duckdb.AsyncDuckDB> {
  if (!dbPromise) dbPromise = createDb()
  return dbPromise
}

export interface QueryResult {
  columns: string[]
  rows: unknown[][]
  rowCount: number
}

export async function runQuery(sql: string): Promise<QueryResult> {
  const db = await getDb()
  const conn = await db.connect()
  try {
    const table = await conn.query(sql)
    const fields = table.schema.fields
    const columns = fields.map((f) => f.name)
    const types = fields.map((f) => f.type as DataType)
    const rows: unknown[][] = []
    for (let i = 0; i < table.numRows; i++) {
      const row = table.get(i)
      if (!row) continue
      rows.push(columns.map((c, ci) => normalize(row[c], types[ci])))
    }
    return { columns, rows, rowCount: table.numRows }
  } finally {
    await conn.close()
  }
}

export async function exec(sql: string): Promise<void> {
  const db = await getDb()
  const conn = await db.connect()
  try {
    await conn.query(sql)
  } finally {
    await conn.close()
  }
}

export async function registerCsv(name: string, csv: string): Promise<void> {
  const db = await getDb()
  const dotIdx = name.indexOf('.')
  const schema = dotIdx !== -1 ? name.slice(0, dotIdx) : 'main'
  const table = dotIdx !== -1 ? name.slice(dotIdx + 1) : name
  const fileKey = `${schema}_${table}`
  try { await db.dropFile(`${fileKey}.csv`) } catch { /* not registered yet */ }
  await db.registerFileText(`${fileKey}.csv`, csv)
  const conn = await db.connect()
  try {
    if (schema !== 'main') {
      await conn.query(`CREATE SCHEMA IF NOT EXISTS "${schema}"`)
    }
    await conn.query(
      `CREATE OR REPLACE TABLE "${schema}"."${table}" AS SELECT * FROM read_csv_auto('${fileKey}.csv', header=true)`,
    )
  } finally {
    await conn.close()
  }
}

/**
 * Drops every user-created table and view so the next level starts clean.
 *
 * Arrow row objects don't expose named fields as plain properties — use
 * `table.getChild(col)` to get the column vector and `.get(i)` per row.
 */
export async function resetDb(): Promise<void> {
  const db = await getDb()
  // Flush all registered CSV / Parquet files too.
  try { await db.dropFiles() } catch { /* nothing registered */ }
  const conn = await db.connect()
  try {
    const schemaRes = await conn.query(
      `SELECT schema_name FROM information_schema.schemata
         WHERE schema_name NOT IN ('information_schema', 'pg_catalog')
         ORDER BY schema_name`,
    )
    const schemaCol = schemaRes.getChild('schema_name')
    const schemas: string[] = []
    for (let i = 0; i < schemaRes.numRows; i++) {
      const s = schemaCol?.get(i) as string | null
      if (s) schemas.push(s)
    }
    // Drop views first (they may reference tables), then tables, then non-main schemas.
    for (const type of ['VIEW', 'BASE TABLE']) {
      for (const schema of schemas) {
        const res = await conn.query(
          `SELECT table_name FROM information_schema.tables
             WHERE table_schema = '${schema}' AND table_type = '${type}'`,
        )
        const col = res.getChild('table_name')
        for (let i = 0; i < res.numRows; i++) {
          const name = col?.get(i) as string | null
          if (!name) continue
          const drop = type === 'VIEW' ? 'DROP VIEW' : 'DROP TABLE'
          await conn.query(`${drop} IF EXISTS "${schema}"."${name}" CASCADE`)
        }
      }
    }
    for (const schema of schemas) {
      if (schema !== 'main') {
        await conn.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`)
      }
    }
  } finally {
    await conn.close()
  }
}

function normalize(v: unknown, type?: DataType): unknown {
  if (v == null) return v
  const id = type?.typeId
  if (id !== undefined && DATE_TYPE_IDS.has(id)) return safeFormat(v, type!, formatDate)
  if (id !== undefined && TIMESTAMP_TYPE_IDS.has(id)) return safeFormat(v, type!, formatTimestamp)
  if (typeof v === 'bigint') return Number(v)
  if (v instanceof Date) {
    const t = v.getTime()
    return Number.isFinite(t) ? new Date(t).toISOString().slice(0, 10) : String(v)
  }
  if (v && typeof v === 'object' && 'toString' in v && !Array.isArray(v)) {
    const s = (v as { toString: () => string }).toString()
    if (s !== '[object Object]') return s
  }
  return v
}

function safeFormat(v: unknown, type: DataType, fmt: (ms: number) => string): string {
  try {
    const ms = toMs(v, type)
    if (!Number.isFinite(ms)) return String(v)
    return fmt(ms)
  } catch {
    return String(v)
  }
}

// Convert an Arrow DATE/TIMESTAMP cell to JS ms-since-epoch.
//
// We *don't* trust the DataType's `unit` field: duckdb-wasm reports
// DateDay/unit=DAY for `read_csv_auto` date columns, yet the row proxy
// already hands us milliseconds. Magnitude-based detection is reliable
// because the ranges don't overlap for any plausible real-world value:
//   - days since epoch: ~0 .. 100_000      (year 1970 .. ~2243)
//   - seconds:          ~10^9 .. 10^10
//   - milliseconds:     ~10^12 .. 10^13
//   - microseconds:     ~10^15 .. 10^16
//   - nanoseconds:      ~10^18 .. 10^19
function toMs(v: unknown, type: DataType): number {
  if (v instanceof Date) return v.getTime()
  const raw = Number(v)
  if (!Number.isFinite(raw)) return NaN
  if (DATE_TYPE_IDS.has(type.typeId) || TIMESTAMP_TYPE_IDS.has(type.typeId)) {
    return inferToMs(raw)
  }
  return raw
}

function inferToMs(n: number): number {
  const abs = Math.abs(n)
  if (abs < 1e8) return n * 86_400_000          // days
  if (abs < 1e11) return n * 1000                // seconds
  if (abs < 1e14) return n                       // milliseconds
  if (abs < 1e17) return n / 1000                // microseconds
  return n / 1_000_000                            // nanoseconds
}

function formatDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}

function formatTimestamp(ms: number): string {
  const iso = new Date(ms).toISOString()
  return `${iso.slice(0, 10)} ${iso.slice(11, 19)}`
}
