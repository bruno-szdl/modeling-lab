import { useGameStore } from '../store/gameStore'

/**
 * Lesson 0: full-width landing. Sells the lab and gets the learner into
 * lesson 1 with one click. Hardcoded EN copy for this scaffold; PT will be
 * added in a follow-up via a translation file.
 */
export default function IntroPage() {
  const loadLesson = useGameStore((s) => s.loadLesson)
  const completedSteps = useGameStore((s) => s.completedSteps)
  const hasProgress = completedSteps.size > 0

  return (
    <div className="flex-1 overflow-y-auto" style={{ background: 'var(--color-base)', color: 'var(--color-text)' }}>
      <section style={{ maxWidth: '760px', margin: '0 auto', padding: '48px 32px 28px', textAlign: 'center' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'baseline', gap: '10px', marginBottom: '12px',
          flexWrap: 'wrap', justifyContent: 'center',
        }}>
          <span style={{
            fontFamily: 'var(--font-sans)', fontSize: '2rem', fontWeight: 700,
            color: 'var(--color-accent-orange)', letterSpacing: '-0.02em',
          }}>
            Data Modeling
          </span>
          <span style={{
            fontFamily: 'var(--font-sans)', fontSize: '2rem', fontWeight: 700,
            color: 'var(--color-text)', letterSpacing: '-0.02em',
          }}>
            Lab
          </span>
        </div>
        <p style={{
          fontFamily: 'var(--font-sans)', fontSize: '1.125rem', lineHeight: 1.55,
          color: 'var(--color-text-secondary)', margin: '0 auto 24px', maxWidth: '560px',
        }}>
          From raw tables to an analytics mart. Learn the modeling decisions behind analytics
          engineering — grain, dimensions, facts, fan-out, and the mart that pulls it together.
        </p>
        <button
          onClick={() => void loadLesson(hasProgress ? useGameStore.getState().currentLessonId || 1 : 1)}
          className="btn-primary"
          style={{ padding: '12px 22px', fontSize: '0.9375rem' }}
        >
          {hasProgress ? 'Resume where you left off →' : 'Start lesson 1 →'}
        </button>
      </section>

      <section style={{
        maxWidth: '760px', margin: '0 auto', padding: '8px 32px 48px',
      }}>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '32px',
        }}>
          <Fact label="Who it's for" body="Analysts who know some SQL and want to become analytics engineers." />
          <Fact label="What you'll build" body="A two-row monthly sales mart, the right way — dims, facts, and a fan-out you'll predict, then break." />
          <Fact label="No setup" body="Real SQL runs in your browser against DuckDB. No install, no account, nothing to download." />
          <Fact label="Estimated time" body="~3–4 hours total. Each lesson is self-contained — pick up where you left off." />
        </div>

        <h2 style={{ margin: '0 0 12px', fontSize: '1.125rem', fontWeight: 700 }}>What's inside</h2>
        <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[
            ['1', 'The grain of a table', 'What does one row represent? The anchor of everything.'],
            ['2', 'Entities, events, column roles', 'Three column roles — identifier, attribute, metric. The mental map for dims vs facts.'],
            ['3', 'Dimensions', 'One row per entity. Many descriptive columns, zero metrics.'],
            ['3b', 'Side quest: dim_date', 'Generate a calendar dim with generate_series. Optional.'],
            ['4', 'Facts', 'Many rows per event. FKs + metrics + nothing else.'],
            ['5', 'Joins that don\'t break grain', 'LEFT JOIN as the analytics default. WHERE vs ON. Anti-joins.'],
            ['6', 'Metrics, fan-out, additivity', 'Predict 1060, run, get 1800. Learn why.'],
            ['7', 'Build the mart', 'Aggregate each fact at its grain, then join. Two rows out.'],
          ].map(([num, title, desc]) => (
            <li key={num} style={{
              display: 'flex', gap: '12px', alignItems: 'flex-start',
              padding: '10px 12px',
              border: '1px solid var(--color-border-subtle)',
              borderRadius: '6px',
              background: 'var(--color-surface)',
            }}>
              <span style={{
                fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem',
                color: 'var(--color-accent-orange)',
                width: '28px', textAlign: 'right', flexShrink: 0, marginTop: '1px',
              }}>{num}</span>
              <div>
                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)', marginBottom: '2px' }}>{title}</div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>{desc}</div>
              </div>
            </li>
          ))}
        </ol>

        <div style={{
          marginTop: '28px', padding: '14px 16px',
          border: '1px dashed var(--color-border)', borderRadius: '6px',
          color: 'var(--color-text-secondary)', fontSize: '0.8125rem', lineHeight: 1.6,
        }}>
          <strong>Recurring mantra:</strong> every time you meet a new table, ask out loud —
          <em> "What does one row in this table represent?"</em> The whole lab keys off it.
        </div>
      </section>
    </div>
  )
}

function Fact({ label, body }: { label: string; body: string }) {
  return (
    <div style={{
      border: '1px solid var(--color-border-subtle)',
      borderRadius: '6px',
      padding: '12px 14px',
      background: 'var(--color-surface)',
    }}>
      <div style={{
        fontFamily: 'JetBrains Mono, monospace', fontSize: '0.625rem',
        textTransform: 'uppercase', letterSpacing: '0.08em',
        color: 'var(--color-text-muted)', marginBottom: '6px',
      }}>{label}</div>
      <div style={{ fontSize: '0.8125rem', color: 'var(--color-text)', lineHeight: 1.55 }}>{body}</div>
    </div>
  )
}
