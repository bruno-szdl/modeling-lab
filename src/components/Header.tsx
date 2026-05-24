import { useEffect, useRef, useState, useCallback } from 'react'
import { useGameStore } from '../store/gameStore'
import { lessons, getLessonById } from '../lessons'
import { lessonCompleted } from '../store/gameStore'

export default function Header() {
  const loadLesson = useGameStore((s) => s.loadLesson)
  const currentLessonId = useGameStore((s) => s.currentLessonId)

  return (
    <header
      className="flex items-center justify-between shrink-0"
      style={{
        height: '52px',
        background: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-border)',
        padding: '0 20px',
        gap: '8px',
      }}
    >
      <div className="flex items-center gap-3 min-w-0" style={{ flex: 1 }}>
        <button
          onClick={() => void loadLesson(0)}
          aria-label="Back to intro"
          className="flex items-center gap-2"
          style={{
            background: 'transparent',
            border: 'none',
            padding: '4px 6px',
            borderRadius: '5px',
            cursor: currentLessonId === 0 ? 'default' : 'pointer',
            flexShrink: 0,
          }}
        >
          <LabMark />
          <div className="flex flex-col" style={{ gap: '1px' }}>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.9375rem', fontWeight: 700, color: 'var(--color-text)', lineHeight: 1 }}>
              <span style={{ color: 'var(--color-accent-orange)' }}>Data Modeling</span> Lab
            </div>
            <span style={{ fontFamily: 'var(--font-sans)', color: 'var(--color-muted)', fontSize: '0.625rem', lineHeight: 1 }}>
              From raw tables to an analytics mart
            </span>
          </div>
        </button>
        <div className="w-px h-4" style={{ background: 'var(--color-border)', flexShrink: 0 }} />
        <LessonSelector />
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <ResetLessonButton />
        <ThemeToggle />
      </div>
    </header>
  )
}

function LabMark() {
  return (
    <svg width="22" height="22" viewBox="0 0 32 32" fill="none">
      <rect width="32" height="32" rx="6" fill="var(--color-accent-orange)" fillOpacity="0.12" />
      <path d="M8 22 L8 10 L16 16 L24 10 L24 22" stroke="var(--color-accent-orange)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  )
}

function LessonSelector() {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const currentLessonId = useGameStore((s) => s.currentLessonId)
  const completedSteps = useGameStore((s) => s.completedSteps)
  const loadLesson = useGameStore((s) => s.loadLesson)
  const lesson = getLessonById(currentLessonId)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={containerRef} style={{ position: 'relative', minWidth: 0 }}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2"
        style={{
          background: 'transparent',
          border: 'none',
          padding: '4px 6px',
          borderRadius: '5px',
          cursor: 'pointer',
        }}
      >
        <span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem', fontFamily: 'var(--font-sans)' }}>Lesson</span>
        <span
          style={{
            background: 'var(--color-accent-bg)',
            border: '1px solid var(--color-accent-orange-dim)',
            color: 'var(--color-accent-orange)',
            fontSize: '0.8125rem',
            fontFamily: 'JetBrains Mono, monospace',
            padding: '0 8px',
            borderRadius: '4px',
            fontWeight: 600,
          }}
        >
          {currentLessonId || '–'}
        </span>
        {lesson && (
          <>
            <span style={{ color: 'var(--color-muted)', fontSize: '0.75rem' }}>·</span>
            <span style={{
              color: 'var(--color-text-muted)', fontSize: '0.75rem', fontFamily: 'var(--font-sans)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0,
            }}>
              {lesson.title}
            </span>
          </>
        )}
        <svg width="10" height="10" viewBox="0 0 16 16" fill="none" style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s', color: 'var(--color-muted)' }}>
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div
          role="listbox"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            left: 0,
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: '8px',
            padding: '6px',
            width: 'min(300px, calc(100vw - 24px))',
            maxHeight: 'calc(100vh - 80px)',
            overflowY: 'auto',
            zIndex: 100,
            boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
          }}
        >
          {lessons.map((l) => {
            const isCurrent = l.id === currentLessonId
            const isComplete = lessonCompleted(completedSteps, l.id)
            const isSide = !Number.isInteger(l.id)
            return (
              <button
                key={l.id}
                onClick={() => { void loadLesson(l.id); setOpen(false) }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  width: '100%',
                  padding: '6px 8px',
                  background: isCurrent ? 'var(--color-accent-bg)' : 'transparent',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  marginLeft: isSide ? '14px' : 0,
                }}
              >
                <span
                  style={{
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: '0.625rem',
                    color: isCurrent ? 'var(--color-accent-orange)' : isComplete ? 'var(--color-success)' : 'var(--color-muted)',
                    width: '24px',
                    textAlign: 'right',
                    flexShrink: 0,
                  }}
                >
                  {isSide ? '↳' : l.id}
                </span>
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: '0.75rem', color: isCurrent ? 'var(--color-text)' : 'var(--color-text-muted)', flex: 1 }}>
                  {l.title}
                </span>
                {isComplete && (
                  <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
                    <path d="M3 8.5l3 3 7-7" stroke="var(--color-success)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function ResetLessonButton() {
  const currentLessonId = useGameStore((s) => s.currentLessonId)
  const resetLesson = useGameStore((s) => s.resetLesson)
  const [armed, setArmed] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleClick = useCallback(() => {
    if (armed) {
      if (timerRef.current) clearTimeout(timerRef.current)
      setArmed(false)
      void resetLesson()
    } else {
      setArmed(true)
      timerRef.current = setTimeout(() => setArmed(false), 3000)
    }
  }, [armed, resetLesson])

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])

  if (currentLessonId === 0) return null

  return (
    <button
      onClick={handleClick}
      title={armed ? 'Click again to confirm' : 'Reset this lesson'}
      className="icon-btn flex items-center gap-1"
      style={{
        height: '28px',
        padding: '0 8px',
        fontFamily: 'var(--font-sans)',
        fontSize: '0.6875rem',
        color: armed ? 'var(--color-fail)' : 'var(--color-muted)',
        borderColor: armed ? 'var(--color-fail)' : undefined,
        background: 'transparent',
        border: '1px solid var(--color-border)',
        borderRadius: '5px',
        cursor: 'pointer',
      }}
    >
      {armed ? 'Reset?' : 'Reset'}
    </button>
  )
}

function ThemeToggle() {
  const theme = useGameStore((s) => s.theme)
  const toggleTheme = useGameStore((s) => s.toggleTheme)
  const isDark = theme === 'dark'
  return (
    <button
      onClick={toggleTheme}
      title={isDark ? 'Light mode' : 'Dark mode'}
      className="icon-btn flex items-center justify-center"
      style={{
        width: '28px',
        height: '28px',
        background: 'transparent',
        border: '1px solid var(--color-border)',
        borderRadius: '5px',
        cursor: 'pointer',
        color: 'var(--color-text-muted)',
      }}
    >
      {isDark ? '☀' : '☾'}
    </button>
  )
}
