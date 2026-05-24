import { useCallback, useEffect, useRef, useState } from 'react'
import Editor from './Editor'
import LessonPanel from './LessonPanel'
import ResultsPanel from './ResultsPanel'

/**
 * Three-region workspace for the modeling lab.
 *
 *   ┌────────────────┬─────────────────────────────┐
 *   │  LessonPanel   │  Editor                     │
 *   │  (concept +    │  (single SQL buffer + Run)  │
 *   │   steps[])     ├─────────────────────────────┤
 *   │                │  Results                    │
 *   └────────────────┴─────────────────────────────┘
 *
 * No file explorer, no terminal, no DAG — modeling lessons work against the
 * raw seeds and a scratch buffer. Splitter widths/heights are local; sizes
 * don't persist across reloads.
 */
export default function Workspace() {
  const [lessonWidth, setLessonWidth] = useState(420)
  const [resultsHeight, setResultsHeight] = useState(260)
  const rootRef = useRef<HTMLDivElement>(null)

  return (
    <div ref={rootRef} className="flex-1 flex overflow-hidden">
      <aside
        className="flex flex-col shrink-0 overflow-hidden"
        style={{
          width: lessonWidth,
          background: 'var(--color-surface)',
          borderRight: '1px solid var(--color-border)',
        }}
      >
        <LessonPanel />
      </aside>

      <VerticalResizer onDelta={(dx) => setLessonWidth((w) => clamp(w + dx, 320, 640))} />

      <div className="flex-1 flex flex-col overflow-hidden" style={{ minWidth: 0 }}>
        <div className="flex-1 overflow-hidden">
          <Editor />
        </div>
        <HorizontalResizer onDelta={(dy) => setResultsHeight((h) => clamp(h - dy, 140, 600))} />
        <div
          className="flex flex-col shrink-0"
          style={{ height: resultsHeight, background: 'var(--color-base)', borderTop: '1px solid var(--color-border)' }}
        >
          <ResultsPanel />
        </div>
      </div>
    </div>
  )
}

function VerticalResizer({ onDelta }: { onDelta: (dx: number) => void }) {
  const dragging = useRef(false)
  const lastX = useRef(0)
  const onDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dragging.current = true
    lastX.current = e.clientX
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [])
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return
      const dx = e.clientX - lastX.current
      lastX.current = e.clientX
      if (dx !== 0) onDelta(dx)
    }
    const onUp = () => {
      if (!dragging.current) return
      dragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [onDelta])
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      onMouseDown={onDown}
      style={{ width: '4px', cursor: 'col-resize', background: 'var(--color-border)', flexShrink: 0 }}
    />
  )
}

function HorizontalResizer({ onDelta }: { onDelta: (dy: number) => void }) {
  const dragging = useRef(false)
  const lastY = useRef(0)
  const onDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dragging.current = true
    lastY.current = e.clientY
    document.body.style.cursor = 'row-resize'
    document.body.style.userSelect = 'none'
  }, [])
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return
      const dy = e.clientY - lastY.current
      lastY.current = e.clientY
      if (dy !== 0) onDelta(dy)
    }
    const onUp = () => {
      if (!dragging.current) return
      dragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [onDelta])
  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      onMouseDown={onDown}
      style={{ height: '4px', cursor: 'row-resize', background: 'var(--color-border)', flexShrink: 0 }}
    />
  )
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}
