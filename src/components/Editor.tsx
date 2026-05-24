import MonacoEditor from '@monaco-editor/react'
import { useGameStore } from '../store/gameStore'

/**
 * Single-buffer SQL editor for the modeling lab. Unlike transform-lab's
 * multi-file editor, every lesson works against ONE SQL document — the
 * learner's scratch space. Each lesson's first SQL step prefills it with
 * starterSql; lessons remount the editor by bumping `editorKey`.
 */
export default function Editor() {
  const editorSql = useGameStore((s) => s.editorSql)
  const setEditorSql = useGameStore((s) => s.setEditorSql)
  const runQuery = useGameStore((s) => s.runQuery)
  const running = useGameStore((s) => s.running)
  const theme = useGameStore((s) => s.theme)
  const editorKey = useGameStore((s) => s.editorKey)

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
            editor.addCommand(
              monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter,
              () => void useGameStore.getState().runQuery(),
            )
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
