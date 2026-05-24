import { useState, useEffect } from 'react'
import { useGameStore } from '../store/gameStore'
import { runQuery } from '../engine/duckdb'

/**
 * The mart finale. Shown when lesson 8's last step completes. Previews the
 * actual `mart_monthly_sales` the learner just built (or a sentinel if they
 * skipped ahead) and surfaces two CTAs:
 *
 *   primary    → Build it in dbt: transform-lab.datagym.io
 *   secondary  → More modeling content: datagym.io/topics/data-modeling
 *
 * Replaces the dbt-course completion screen.
 */
export default function CourseComplete() {
  const loadLesson = useGameStore((s) => s.loadLesson)
  const [martPreview, setMartPreview] = useState<{ columns: string[]; rows: unknown[][] } | null>(null)
  const [confetti] = useState(() => {
    const palette = ['var(--color-accent-orange)', 'var(--color-success)', 'var(--color-warning)']
    return Array.from({ length: 22 }, (_, i) => ({
      left: Math.random() * 100,
      delay: Math.random() * 600,
      color: palette[i % palette.length],
      size: 4 + Math.random() * 4,
    }))
  })

  useEffect(() => {
    runQuery(`SELECT * FROM mart_monthly_sales ORDER BY 1`)
      .then((r) => setMartPreview({ columns: r.columns, rows: r.rows }))
      .catch(() => setMartPreview(null))
  }, [])

  return (
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        border: '1px solid var(--color-success-border)',
        background: 'var(--color-success-bg)',
        borderRadius: '8px',
        padding: '20px 18px 18px',
      }}
    >
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        {confetti.map((c, i) => (
          <span
            key={i}
            className="sparkle"
            style={{
              left: `${c.left}%`,
              top: '50%',
              width: `${c.size}px`,
              height: `${c.size}px`,
              background: c.color,
              animationDelay: `${c.delay}ms`,
              position: 'absolute',
            }}
          />
        ))}
      </div>

      <div style={{
        color: 'var(--color-accent-orange)', fontFamily: 'JetBrains Mono, monospace',
        fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.12em',
        fontWeight: 600, marginBottom: '8px',
      }}>
        You built it
      </div>
      <h3 style={{
        margin: '0 0 10px', color: 'var(--color-text)', fontFamily: 'var(--font-sans)',
        fontSize: '1.0625rem', fontWeight: 700, lineHeight: 1.3,
      }}>
        Your analytics mart
      </h3>
      <p style={{
        margin: '0 0 14px', color: 'var(--color-text-secondary)',
        fontSize: '0.875rem', lineHeight: 1.6,
      }}>
        Two rows. One per month. Every decision you made — choosing a grain, classifying columns,
        designing dims and facts, aggregating each fact before the join — converges into this.
        This is what a business user actually queries.
      </p>

      {martPreview && martPreview.rows.length > 0 && (
        <div style={{ marginBottom: '14px', overflowX: 'auto' }}>
          <table style={{
            borderCollapse: 'collapse', width: '100%',
            fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem',
          }}>
            <thead>
              <tr>
                {martPreview.columns.map((c) => (
                  <th key={c} style={{
                    textAlign: 'left', padding: '6px 10px',
                    background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)',
                    color: 'var(--color-text-muted)', fontWeight: 500,
                    fontSize: '0.625rem', textTransform: 'uppercase', letterSpacing: '0.08em',
                  }}>
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {martPreview.rows.map((row, ri) => (
                <tr key={ri}>
                  {row.map((cell, ci) => (
                    <td key={ci} style={{
                      padding: '5px 10px', borderBottom: '1px solid var(--color-border-subtle)',
                      color: cell == null ? 'var(--color-muted)' : 'var(--color-text)',
                    }}>
                      {cell == null ? 'NULL' : String(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <a
          href="https://transform-lab.datagym.io"
          className="btn-primary"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            padding: '10px 14px', fontSize: '0.875rem', textDecoration: 'none',
            justifyContent: 'center',
          }}
        >
          Next: build it in dbt → transform-lab
        </a>
        <a
          href="https://datagym.io/topics/data-modeling"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            padding: '10px 14px', fontSize: '0.8125rem',
            color: 'var(--color-text-muted)', textDecoration: 'none',
            background: 'transparent', border: '1px solid var(--color-border)',
            borderRadius: '6px', justifyContent: 'center',
            fontFamily: 'var(--font-sans)',
          }}
        >
          More modeling content → datagym.io
        </a>
        <button
          onClick={() => void loadLesson(0)}
          style={{
            padding: '8px 14px', fontSize: '0.75rem',
            color: 'var(--color-muted)', background: 'transparent',
            border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)',
          }}
        >
          Back to intro
        </button>
      </div>
    </div>
  )
}
