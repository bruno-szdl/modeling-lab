import { useEffect, useRef } from 'react'
import { useGameStore } from '../store/gameStore'
import { getLessonById, getLastLessonId, stepKey } from '../lessons'
import type { Step, SqlStep, CheckpointStep } from '../engine/types'
import CourseComplete from './CourseComplete'
import { Markdownish, renderInline } from './Markdownish'

/**
 * Modeling Lab lesson panel. Renders the lesson's concept, then iterates
 * `steps[]` — each one is either a SQL task (prompt + editor button + hint +
 * solution + explanation) or a multiple-choice checkpoint.
 *
 * Editor + Results live in their own columns (see <Workspace />); this panel
 * just orchestrates the lesson narrative.
 */
export default function LessonPanel() {
  const currentLessonId = useGameStore((s) => s.currentLessonId)
  const completedSteps = useGameStore((s) => s.completedSteps)
  const passedCheckpointKeys = useGameStore((s) => s.passedCheckpointKeys)
  const revealedHints = useGameStore((s) => s.revealedHints)
  const revealedSolutions = useGameStore((s) => s.revealedSolutions)
  const revealHint = useGameStore((s) => s.revealHint)
  const revealSolution = useGameStore((s) => s.revealSolution)
  const answerCheckpoint = useGameStore((s) => s.answerCheckpoint)
  const setEditorSql = useGameStore((s) => s.setEditorSql)
  const loadLesson = useGameStore((s) => s.loadLesson)

  const scrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => { scrollRef.current?.scrollTo(0, 0) }, [currentLessonId])

  const lesson = getLessonById(currentLessonId)
  if (!lesson) return null

  const allDone = lesson.steps.every((st) =>
    completedSteps.has(stepKey(lesson.id, st.id)),
  )
  const isLast = lesson.id === getLastLessonId()

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: 'var(--color-surface)' }}>
      {/* Header */}
      <div
        className="shrink-0"
        style={{
          padding: '16px 16px 12px',
          borderBottom: '1px solid var(--color-border)',
          borderLeft: '2px solid var(--color-accent-orange)',
          background: 'var(--color-surface)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <span
            style={{
              background: 'var(--color-accent-bg)',
              border: '1px solid var(--color-accent-orange-dim)',
              color: 'var(--color-accent-orange)',
              fontSize: '0.625rem',
              fontFamily: 'JetBrains Mono, monospace',
              padding: '2px 7px',
              borderRadius: '3px',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              fontWeight: 600,
            }}
          >
            Lesson {lesson.id} / {getLastLessonId()}
          </span>
        </div>
        <h2 style={{
          margin: 0, color: 'var(--color-text)', fontSize: '1.125rem',
          fontFamily: 'var(--font-sans)', fontWeight: 700, lineHeight: 1.25, letterSpacing: '-0.005em',
        }}>
          {lesson.title}
        </h2>
      </div>

      {/* Body */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {/* Concept */}
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--color-border-subtle)' }}>
          <Markdownish text={lesson.concept} />
          {lesson.schemaSketch && (
            <div style={{ marginTop: '12px', padding: '8px', background: 'var(--color-base)', border: '1px solid var(--color-border-subtle)', borderRadius: '6px' }}>
              <img src={lesson.schemaSketch.src} alt={lesson.schemaSketch.alt} style={{ width: '100%', display: 'block' }} />
            </div>
          )}
          {lesson.dbtBridge && <DbtBridge text={lesson.dbtBridge} />}
        </div>

        {/* Steps */}
        {lesson.steps.length > 0 && (
          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {lesson.steps.map((step, idx) => (
              <StepCard
                key={step.id}
                lessonId={lesson.id}
                index={idx + 1}
                step={step}
                completed={completedSteps.has(stepKey(lesson.id, step.id))}
                passedCorrect={passedCheckpointKeys.has(stepKey(lesson.id, step.id))}
                hintShown={revealedHints.has(stepKey(lesson.id, step.id))}
                solutionShown={revealedSolutions.has(stepKey(lesson.id, step.id))}
                onRevealHint={() => revealHint(lesson.id, step.id)}
                onRevealSolution={() => revealSolution(lesson.id, step.id)}
                onLoadStarter={(sql) => setEditorSql(sql)}
                onAnswerCheckpoint={(opt) => answerCheckpoint(step.id, opt)}
              />
            ))}
          </div>
        )}

        {/* Further reading */}
        {lesson.furtherReading && lesson.furtherReading.length > 0 && (
          <div style={{ padding: '14px 16px', borderTop: '1px solid var(--color-border-subtle)' }}>
            <SectionLabel>Further reading</SectionLabel>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {lesson.furtherReading.map((link) => (
                <li key={link.url}>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      color: 'var(--color-accent-orange)',
                      fontSize: '0.75rem',
                      fontFamily: 'var(--font-sans)',
                      textDecoration: 'none',
                      lineHeight: 1.5,
                    }}
                  >
                    {link.label} ↗
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Next or finale */}
        {allDone && (
          <div style={{ padding: '14px 16px' }}>
            {isLast ? (
              <CourseComplete />
            ) : (
              <button
                onClick={() => void loadLesson(nextLessonId(lesson.id))}
                className="btn-primary"
                style={{ width: '100%', fontSize: '0.875rem', padding: '11px' }}
              >
                Next lesson →
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function nextLessonId(current: number): number {
  // Skip 4b (id 4.5) when stepping forward unless we're already there.
  if (current === 4) return 4.5
  if (current === 4.5) return 5
  return current + 1
}

function StepCard({
  lessonId,
  index,
  step,
  completed,
  passedCorrect,
  hintShown,
  solutionShown,
  onRevealHint,
  onRevealSolution,
  onLoadStarter,
  onAnswerCheckpoint,
}: {
  lessonId: number
  index: number
  step: Step
  completed: boolean
  passedCorrect: boolean
  hintShown: boolean
  solutionShown: boolean
  onRevealHint: () => void
  onRevealSolution: () => void
  onLoadStarter: (sql: string) => void
  onAnswerCheckpoint: (opt: number) => boolean
}) {
  return (
    <div
      style={{
        border: `1px solid ${completed ? 'var(--color-success-border)' : 'var(--color-border-subtle)'}`,
        background: completed ? 'var(--color-success-bg)' : 'var(--color-base)',
        borderRadius: '8px',
        padding: '12px 14px',
        transition: 'background-color 200ms ease, border-color 200ms ease',
      }}
    >
      <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
        <StepBadge index={index} kind={step.kind} done={completed} />
        <div style={{ flex: 1, minWidth: 0 }}>
          {step.kind === 'sql' ? (
            <SqlStepBody
              step={step}
              lessonId={lessonId}
              completed={completed}
              hintShown={hintShown}
              solutionShown={solutionShown}
              onRevealHint={onRevealHint}
              onRevealSolution={onRevealSolution}
              onLoadStarter={onLoadStarter}
            />
          ) : (
            <CheckpointBody
              step={step}
              completed={completed}
              passedCorrect={passedCorrect}
              onAnswer={onAnswerCheckpoint}
            />
          )}
        </div>
      </div>
    </div>
  )
}

function SqlStepBody({
  step,
  completed,
  hintShown,
  solutionShown,
  onRevealHint,
  onRevealSolution,
  onLoadStarter,
}: {
  step: SqlStep
  lessonId: number
  completed: boolean
  hintShown: boolean
  solutionShown: boolean
  onRevealHint: () => void
  onRevealSolution: () => void
  onLoadStarter: (sql: string) => void
}) {
  return (
    <>
      <div style={{ color: 'var(--color-text)', fontSize: '0.875rem', fontFamily: 'var(--font-sans)', lineHeight: 1.55 }}>
        <Markdownish text={step.prompt} />
      </div>

      {step.starterSql && !completed && (
        <button
          onClick={() => onLoadStarter(step.starterSql!)}
          style={{
            marginTop: '8px',
            background: 'transparent',
            border: '1px dashed var(--color-border)',
            borderRadius: '4px',
            color: 'var(--color-text-muted)',
            fontSize: '0.6875rem',
            fontFamily: 'JetBrains Mono, monospace',
            padding: '4px 9px',
            cursor: 'pointer',
          }}
        >
          ↥ Load starter into editor
        </button>
      )}

      <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
        {step.hint && !completed && !hintShown && (
          <SmallButton onClick={onRevealHint}>Show hint</SmallButton>
        )}
        {step.solution && !solutionShown && (
          <SmallButton onClick={onRevealSolution}>Reveal solution</SmallButton>
        )}
      </div>

      {hintShown && step.hint && (
        <CalloutBox tone="hint">{step.hint}</CalloutBox>
      )}
      {solutionShown && step.solution && (
        <CalloutBox tone="solution">
          <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem' }}>{step.solution}</pre>
        </CalloutBox>
      )}
      {completed && step.explanation && (
        <CalloutBox tone="success">
          <Markdownish text={step.explanation} />
        </CalloutBox>
      )}
    </>
  )
}

function CheckpointBody({
  step,
  completed,
  passedCorrect,
  onAnswer,
}: {
  step: CheckpointStep
  completed: boolean
  passedCorrect: boolean
  onAnswer: (opt: number) => boolean
}) {
  return (
    <>
      <div style={{ color: 'var(--color-text)', fontSize: '0.875rem', fontFamily: 'var(--font-sans)', lineHeight: 1.55, marginBottom: '8px' }}>
        {renderInline(step.question)}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {step.options.map((opt, i) => {
          const isCorrect = i === step.correctIndex
          const showRight = completed && isCorrect
          return (
            <button
              key={i}
              disabled={passedCorrect}
              onClick={() => onAnswer(i)}
              style={{
                textAlign: 'left',
                padding: '8px 10px',
                background: showRight ? 'var(--color-success-bg)' : 'transparent',
                border: `1px solid ${showRight ? 'var(--color-success)' : 'var(--color-border)'}`,
                borderRadius: '5px',
                color: 'var(--color-text)',
                fontSize: '0.75rem',
                fontFamily: 'var(--font-sans)',
                cursor: passedCorrect ? 'default' : 'pointer',
              }}
            >
              {renderInline(opt)}
            </button>
          )
        })}
      </div>
      {completed && (
        <CalloutBox tone="success">
          <Markdownish text={step.explanation} />
        </CalloutBox>
      )}
    </>
  )
}

function StepBadge({ index, kind, done }: { index: number; kind: 'sql' | 'checkpoint'; done: boolean }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '22px',
        height: '22px',
        flexShrink: 0,
        border: `1.5px solid ${done ? 'var(--color-success)' : 'var(--color-border)'}`,
        borderRadius: kind === 'checkpoint' ? '4px' : '50%',
        background: done ? 'var(--color-success)' : 'transparent',
        color: done ? 'var(--color-on-success)' : 'var(--color-text-muted)',
        fontSize: '0.6875rem',
        fontFamily: 'JetBrains Mono, monospace',
        fontWeight: 700,
        marginTop: '1px',
      }}
      title={kind === 'checkpoint' ? 'Decision checkpoint' : 'SQL task'}
    >
      {done ? '✓' : (kind === 'checkpoint' ? '?' : index)}
    </span>
  )
}

function SmallButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'transparent',
        border: '1px dashed var(--color-border)',
        borderRadius: '4px',
        color: 'var(--color-text-muted)',
        fontSize: '0.6875rem',
        fontFamily: 'var(--font-sans)',
        padding: '3px 9px',
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  )
}

function CalloutBox({ tone, children }: { tone: 'hint' | 'solution' | 'success'; children: React.ReactNode }) {
  const bg = tone === 'success' ? 'var(--color-success-bg)' : tone === 'hint' ? 'var(--color-hint-bg)' : 'var(--color-surface)'
  const border = tone === 'success' ? 'var(--color-success-border)' : tone === 'hint' ? 'var(--color-warning)' : 'var(--color-border)'
  return (
    <div
      style={{
        marginTop: '8px',
        padding: '8px 10px',
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: '5px',
        color: 'var(--color-text-secondary)',
        fontSize: '0.8125rem',
        fontFamily: 'var(--font-sans)',
        lineHeight: 1.5,
      }}
    >
      {children}
    </div>
  )
}

function DbtBridge({ text }: { text: string }) {
  return (
    <div
      style={{
        marginTop: '12px',
        padding: '8px 10px',
        background: 'var(--color-accent-bg)',
        border: '1px solid var(--color-accent-orange-dim)',
        borderRadius: '5px',
        color: 'var(--color-text-secondary)',
        fontSize: '0.75rem',
        fontFamily: 'var(--font-sans)',
        lineHeight: 1.5,
      }}
    >
      <strong style={{ color: 'var(--color-accent-orange)' }}>💡 In dbt: </strong>
      <Markdownish text={text} />
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        color: 'var(--color-text-muted)',
        fontSize: '0.6875rem',
        fontFamily: 'JetBrains Mono, monospace',
        textTransform: 'uppercase',
        letterSpacing: '0.12em',
        marginBottom: '12px',
        fontWeight: 600,
      }}
    >
      {children}
    </div>
  )
}
