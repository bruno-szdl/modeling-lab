import { create, type StateCreator } from 'zustand'
import { resetDb, registerCsv, exec } from '../engine/duckdb'
import { runEditorSql, listMaterializedTables } from '../engine/sqlRunner'
import { errorMessage } from '../engine/errors'
import { stepKey, type LessonState, type LastQueryResult, type Step } from '../engine/types'
import { getLessonById, getLastLessonId, lessons } from '../lessons'
import { safeStorage } from './safeStorage'

// Bumped to -v2 when the curriculum was renumbered (8 -> 11 lessons): the old
// `<lessonId>.<stepId>` keys no longer line up, so in-flight learners reset
// cleanly instead of seeing half-matched progress.
const PROGRESS_KEY = 'modeling-lab-progress-v2'
const THEME_KEY = 'modeling-lab-theme'

interface PersistedProgress {
  currentLessonId: number
  completedSteps: string[]
  passedCheckpointKeys: string[]
}

function loadProgress(): PersistedProgress | null {
  const raw = safeStorage.getItem(PROGRESS_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return null
    const p = parsed as Record<string, unknown>
    const currentLessonId = typeof p.currentLessonId === 'number' ? p.currentLessonId : 0
    const completedSteps = Array.isArray(p.completedSteps)
      ? p.completedSteps.filter((v): v is string => typeof v === 'string')
      : []
    const passedCheckpointKeys = Array.isArray(p.passedCheckpointKeys)
      ? p.passedCheckpointKeys.filter((v): v is string => typeof v === 'string')
      : []
    return { currentLessonId, completedSteps, passedCheckpointKeys }
  } catch {
    return null
  }
}

function persistProgress(
  state: Pick<StoreState, 'currentLessonId' | 'completedSteps' | 'passedCheckpointKeys'>,
): void {
  const payload: PersistedProgress = {
    currentLessonId: state.currentLessonId,
    completedSteps: [...state.completedSteps],
    passedCheckpointKeys: [...state.passedCheckpointKeys],
  }
  safeStorage.setItem(PROGRESS_KEY, JSON.stringify(payload))
}

interface StoreState {
  editorSql: string
  lastQuery: LastQueryResult | null
  materializedTables: Set<string>
  /** Step keys (`<lessonId>.<stepId>`) the learner has completed in this lesson. */
  completedSteps: Set<string>
  /** Checkpoint step keys the learner answered correctly. Subset of completedSteps. */
  passedCheckpointKeys: Set<string>
  /** Per-step hint reveal, keyed `<lessonId>.<stepId>`. */
  revealedHints: Set<string>
  /** Per-step solution reveal. */
  revealedSolutions: Set<string>

  currentLessonId: number
  running: boolean
  /** Incremented on every loadLesson — forces editor remount. */
  editorKey: number

  theme: 'dark' | 'light'

  setEditorSql: (sql: string) => void
  runQuery: () => Promise<void>
  loadLesson: (id: number) => Promise<void>
  resetLesson: () => Promise<void>
  answerCheckpoint: (stepId: string, optionIndex: number) => boolean
  revealHint: (lessonId: number, stepId: string) => void
  revealSolution: (lessonId: number, stepId: string) => void
  toggleTheme: () => void
}

const initial = loadProgress()

const storeCreator: StateCreator<StoreState> = (set, get) => ({
  editorSql: '',
  lastQuery: null,
  materializedTables: new Set<string>(),
  completedSteps: new Set<string>(initial?.completedSteps ?? []),
  passedCheckpointKeys: new Set<string>(initial?.passedCheckpointKeys ?? []),
  revealedHints: new Set<string>(),
  revealedSolutions: new Set<string>(),

  currentLessonId: initial?.currentLessonId ?? 0,
  running: false,
  editorKey: 0,

  theme: (safeStorage.getItem(THEME_KEY) as 'dark' | 'light') ?? 'light',

  toggleTheme: () => {
    const next = get().theme === 'dark' ? 'light' : 'dark'
    document.documentElement.dataset.theme = next === 'light' ? 'light' : ''
    safeStorage.setItem(THEME_KEY, next)
    set({ theme: next })
  },

  setEditorSql: (sql) => {
    set({ editorSql: sql })
    // SQL-step validators key off `lastQuery`, not the editor buffer — so
    // there's no need to re-check tasks on every keystroke.
  },

  runQuery: async () => {
    if (get().running) return
    set({ running: true })
    try {
      const outcome = await runEditorSql(get().editorSql)
      const lastQuery: LastQueryResult = {
        sql: outcome.sql,
        result: outcome.result,
        error: outcome.error,
        elapsedMs: outcome.elapsedMs,
      }
      const tables = new Set(await listMaterializedTables())
      set({ lastQuery, materializedTables: tables })
      // Re-evaluate SQL steps now that lastQuery + tables changed.
      checkSqlSteps(get, set)
    } finally {
      set({ running: false })
    }
  },

  loadLesson: async (id: number) => {
    const lesson = getLessonById(id)
    if (!lesson) return
    set((s) => ({
      editorKey: s.editorKey + 1,
      currentLessonId: id,
      editorSql: firstStarter(lesson.steps) ?? '',
      lastQuery: null,
      materializedTables: new Set<string>(),
      revealedHints: new Set<string>(),
      revealedSolutions: new Set<string>(),
      running: true,
    }))
    persistProgress(get())

    try {
      await resetDb()
      if (lesson.seeds) {
        for (const [name, csv] of Object.entries(lesson.seeds)) {
          await registerCsv(name, csv)
        }
      }
      if (lesson.preMaterialize?.length) {
        for (const sql of lesson.preMaterialize) {
          try { await exec(sql) } catch (e) {
            console.error('preMaterialize failed for', sql, errorMessage(e))
          }
        }
      }
      const tables = new Set(await listMaterializedTables())
      set({ materializedTables: tables })
    } finally {
      set({ running: false })
    }
  },

  resetLesson: async () => {
    const { currentLessonId, completedSteps, passedCheckpointKeys } = get()
    const prefix = `${currentLessonId}.`
    set({
      completedSteps: new Set([...completedSteps].filter((k) => !k.startsWith(prefix))),
      passedCheckpointKeys: new Set([...passedCheckpointKeys].filter((k) => !k.startsWith(prefix))),
    })
    persistProgress(get())
    await get().loadLesson(currentLessonId)
  },

  answerCheckpoint: (stepId, optionIndex) => {
    const s = get()
    const lesson = getLessonById(s.currentLessonId)
    if (!lesson) return false
    const step = lesson.steps.find((st) => st.id === stepId && st.kind === 'checkpoint')
    if (!step || step.kind !== 'checkpoint') return false
    const correct = optionIndex === step.correctIndex
    if (!correct) return false
    const key = stepKey(s.currentLessonId, stepId)
    const completed = new Set(s.completedSteps).add(key)
    const passed = new Set(s.passedCheckpointKeys).add(key)
    set({ completedSteps: completed, passedCheckpointKeys: passed })
    persistProgress(get())
    return true
  },

  revealHint: (lessonId, sid) =>
    set((s) => ({ revealedHints: new Set([...s.revealedHints, stepKey(lessonId, sid)]) })),

  revealSolution: (lessonId, sid) =>
    set((s) => ({ revealedSolutions: new Set([...s.revealedSolutions, stepKey(lessonId, sid)]) })),
})

export const useGameStore = create<StoreState>()(storeCreator)

/**
 * Re-evaluate every SQL step in the current lesson and persist any newly
 * completed ones. Runs after a query finishes (lastQuery + materializedTables
 * have just changed). Steps that fail validation stay in their previous state.
 */
function checkSqlSteps(
  getState: () => StoreState,
  setState: (partial: Partial<StoreState>) => void,
): void {
  const s = getState()
  const lesson = getLessonById(s.currentLessonId)
  if (!lesson) return
  const snapshot: LessonState = {
    editorSql: s.editorSql,
    lastQuery: s.lastQuery,
    materializedTables: s.materializedTables,
    passedCheckpoints: new Set(
      [...s.passedCheckpointKeys]
        .filter((k) => k.startsWith(`${s.currentLessonId}.`))
        .map((k) => k.slice(String(s.currentLessonId).length + 1)),
    ),
  }
  const next = new Set(s.completedSteps)
  let changed = false
  for (const step of lesson.steps) {
    if (step.kind !== 'sql') continue
    const key = stepKey(s.currentLessonId, step.id)
    if (next.has(key)) continue
    try {
      if (step.validate(snapshot)) {
        next.add(key)
        changed = true
      }
    } catch (e) {
      console.error('validator threw for step', key, errorMessage(e))
    }
  }
  if (changed) {
    setState({ completedSteps: next })
    persistProgress({ ...s, completedSteps: next })
  }
}

function firstStarter(steps: Step[]): string | undefined {
  for (const st of steps) {
    if (st.kind === 'sql' && st.starterSql) return st.starterSql
  }
  return undefined
}

/** True when every step (sql + checkpoint) in the lesson is complete. */
export function lessonCompleted(completedSteps: Set<string>, lessonId: number): boolean {
  const lesson = getLessonById(lessonId)
  if (!lesson || lesson.steps.length === 0) return false
  return lesson.steps.every((st) => completedSteps.has(stepKey(lessonId, st.id)))
}

export function totalLessonsCompleted(completedSteps: Set<string>): number {
  return lessons.filter((l) => lessonCompleted(completedSteps, l.id)).length
}

/** Total lessons that count toward "Course complete" (excludes intro + side quests). */
export function totalTrackedLessons(): number {
  return lessons.filter((l) => l.steps.length > 0 && Number.isInteger(l.id)).length
}

export { getLastLessonId }
