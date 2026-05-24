import { useGameStore } from '../store/gameStore'

/**
 * Displays whatever the learner's last Run produced — rows on success,
 * a red error block on failure, an empty state before they've run anything.
 */
export default function ResultsPanel() {
  const lastQuery = useGameStore((s) => s.lastQuery)

  if (!lastQuery) return <EmptyState />

  if (lastQuery.error) {
    return (
      <div className="flex flex-col h-full" style={{ background: 'var(--color-base)' }}>
        <PanelHeader subtitle={`error · ${lastQuery.elapsedMs.toFixed(0)}ms`} />
        <div
          className="flex-1 overflow-auto"
          style={{
            padding: '14px 16px',
            color: 'var(--color-warning)',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '0.8125rem',
            whiteSpace: 'pre-wrap',
            lineHeight: 1.5,
          }}
        >
          {lastQuery.error}
        </div>
      </div>
    )
  }

  const result = lastQuery.result
  if (!result) {
    return (
      <div className="flex flex-col h-full" style={{ background: 'var(--color-base)' }}>
        <PanelHeader subtitle={`ok · ${lastQuery.elapsedMs.toFixed(0)}ms`} />
        <div
          className="flex-1 flex items-center justify-center"
          style={{
            color: 'var(--color-text-muted)',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '0.75rem',
          }}
        >
          Statement ran. No rows returned (CREATE / INSERT / UPDATE / DROP).
        </div>
      </div>
    )
  }

  const { columns, rows, rowCount } = result

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--color-base)' }}>
      <PanelHeader subtitle={`${rowCount} row${rowCount === 1 ? '' : 's'} · ${lastQuery.elapsedMs.toFixed(0)}ms`} />
      <div className="flex-1 overflow-auto">
        {rows.length === 0 ? (
          <div
            className="flex items-center justify-center h-full"
            style={{ color: 'var(--color-muted)', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem' }}
          >
            (no rows)
          </div>
        ) : (
          <table
            style={{
              borderCollapse: 'collapse',
              width: '100%',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '0.75rem',
            }}
          >
            <thead>
              <tr>
                {columns.map((c) => (
                  <th
                    key={c}
                    style={{
                      textAlign: 'left',
                      padding: '8px 14px',
                      background: 'var(--color-surface)',
                      borderBottom: '1px solid var(--color-border)',
                      color: 'var(--color-text-muted)',
                      fontWeight: 500,
                      fontSize: '0.625rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      position: 'sticky',
                      top: 0,
                    }}
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr
                  key={ri}
                  style={{
                    background: ri % 2 === 0 ? 'transparent' : 'var(--color-border-subtle)',
                  }}
                >
                  {row.map((cell, ci) => (
                    <td
                      key={ci}
                      style={{
                        padding: '6px 14px',
                        borderBottom: '1px solid var(--color-border-subtle)',
                        color: cell == null ? 'var(--color-muted)' : 'var(--color-text)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {cell == null ? 'NULL' : String(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function PanelHeader({ subtitle }: { subtitle: string }) {
  return (
    <div
      className="flex items-center gap-2 shrink-0"
      style={{ padding: '6px 16px', background: 'var(--color-base)', borderBottom: '1px solid var(--color-border)' }}
    >
      <span
        style={{
          color: 'var(--color-text-muted)',
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: '0.625rem',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
        }}
      >
        Results
      </span>
      <span style={{ color: 'var(--color-muted)' }}>·</span>
      <span style={{ color: 'var(--color-muted)', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.625rem' }}>
        {subtitle}
      </span>
    </div>
  )
}

function EmptyState() {
  return (
    <div
      className="flex flex-col items-center justify-center h-full gap-3"
      style={{ opacity: 0.5 }}
    >
      <span
        style={{
          color: 'var(--color-text-muted)',
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: '0.6875rem',
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
        }}
      >
        Results
      </span>
      <span
        style={{
          color: 'var(--color-muted)',
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: '0.6875rem',
          textAlign: 'center',
          lineHeight: 1.6,
          maxWidth: '280px',
        }}
      >
        Write SQL on the right, then click Run (or ⌘↵). Rows will appear here.
      </span>
    </div>
  )
}
