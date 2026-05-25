import MonacoEditor from '@monaco-editor/react'
import { useEffect } from 'react'
import { useGameStore } from '../store/gameStore'

/**
 * Single-buffer SQL editor for the modeling lab. Unlike transform-lab's
 * multi-file editor, every lesson works against ONE SQL document — the
 * learner's scratch space. Each lesson's first SQL step prefills it with
 * starterSql; lessons remount the editor by bumping `editorKey`.
 *
 * Run-query wiring (Bruno wants both options):
 *   1. The Run button always works (button onClick).
 *   2. Cmd/Ctrl + Enter when focus is INSIDE Monaco fires the editor's
 *      registered action — `addAction` is more reliable than `addCommand`
 *      for keybindings; it also stops Monaco from inserting a newline.
 *   3. Cmd/Ctrl + Enter when focus is OUTSIDE the editor (e.g. on the Run
 *      button right after clicking it, or on any focusable element in the
 *      workspace) fires a window-level keydown listener — same handler.
 *
 * Both paths funnel into `useGameStore.getState().runQuery()`, which is
 * guarded by `running` so a double-fire is a no-op.
 */
export default function Editor() {
  const editorSql = useGameStore((s) => s.editorSql)
  const setEditorSql = useGameStore((s) => s.setEditorSql)
  const runQuery = useGameStore((s) => s.runQuery)
  const running = useGameStore((s) => s.running)
  const theme = useGameStore((s) => s.theme)
  const editorKey = useGameStore((s) => s.editorKey)

  // Window-level fallback so Cmd/Ctrl+Enter works when focus is on the Run
  // button or anywhere else in the workspace, not just inside Monaco.
  //
  // CAPTURE PHASE (third arg = true) is required: Monaco may call
  // stopPropagation() on keys it has bound, so a normal bubble-phase
  // listener never sees the event. Capture fires before descendants,
  // bypassing that.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        e.stopPropagation()
        void useGameStore.getState().runQuery()
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [])

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--color-base)' }}>
      <div
        className="flex items-center shrink-0"
        style={{
          background: 'var(--color-surface)',
          height: '36px',
          padding: '0 12px',
          borderBottom: '1px solid var(--color-border)',
          gap: '12px',
        }}
      >
        <span
          style={{
            color: 'var(--color-text-muted)',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '0.6875rem',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
          }}
        >
          SQL editor
        </span>
        <button
          onClick={() => void runQuery()}
          disabled={running}
          className="btn-primary"
          style={{
            marginLeft: 'auto',
            fontSize: '0.75rem',
            padding: '4px 14px',
            opacity: running ? 0.6 : 1,
            cursor: running ? 'not-allowed' : 'pointer',
          }}
        >
          {running ? 'Running…' : 'Run ⌘↵'}
        </button>
      </div>

      <div className="flex-1 overflow-hidden">
        <MonacoEditor
          key={editorKey}
          height="100%"
          language="sql"
          theme={theme === 'dark' ? 'vs-dark' : 'light'}
          value={editorSql}
          onChange={(val) => setEditorSql(val ?? '')}
          onMount={(editor, monaco) => {
            // Belt: Monaco action with the Cmd+Enter keybinding. Prevents
            // Monaco's default "insert newline" and shows up in the
            // command palette + right-click menu.
            editor.addAction({
              id: 'modeling-lab.run-query',
              label: 'Run SQL query',
              keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
              contextMenuGroupId: 'navigation',
              contextMenuOrder: 1,
              run: () => {
                void useGameStore.getState().runQuery()
              },
            })
            // Suspenders: raw onKeyDown handler on the editor itself.
            // Uses the underlying browser event's `key` (string), which is
            // the most reliable cross-platform check. Catches the
            // shortcut even if the action binding misbehaves.
            editor.onKeyDown((e) => {
              if ((e.metaKey || e.ctrlKey) && e.browserEvent.key === 'Enter') {
                e.preventDefault()
                e.stopPropagation()
                void useGameStore.getState().runQuery()
              }
            })
            editor.focus()
          }}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            fontFamily: '"JetBrains Mono", "Fira Code", monospace',
            scrollBeyondLastLine: false,
            lineNumbers: 'on',
            renderLineHighlight: 'line',
            padding: { top: 8 },
            wordBasedSuggestions: 'off',
            quickSuggestions: false,
          }}
        />
      </div>
    </div>
  )
}
