import { useEffect, useRef, useState } from 'react'
import Header from './components/Header'
import LabBar from './components/LabBar'
import IntroPage from './components/IntroPage'
import Workspace from './components/Workspace'
import PrivacyPage from './components/PrivacyPage'
import { useGameStore } from './store/gameStore'

type ParsedRoute = { kind: 'lesson'; lessonId: number | null } | { kind: 'privacy' }

function parsePathname(pathname: string): ParsedRoute {
  if (pathname.startsWith('/privacy')) return { kind: 'privacy' }
  const m = pathname.match(/^\/lesson\/(\d+(?:\.\d+)?)\/?$/)
  if (m) {
    const n = Number(m[1])
    return { kind: 'lesson', lessonId: Number.isFinite(n) ? n : null }
  }
  return { kind: 'lesson', lessonId: null }
}

export default function App() {
  const loadLesson = useGameStore((s) => s.loadLesson)
  const currentLessonId = useGameStore((s) => s.currentLessonId)
  const theme = useGameStore((s) => s.theme)
  const initializedRef = useRef(false)
  const [pathname, setPathname] = useState(() => window.location.pathname)

  useEffect(() => {
    document.documentElement.dataset.theme = theme === 'light' ? 'light' : ''
  }, [theme])

  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true
    const parsed = parsePathname(pathname)
    const isRoot = pathname === '/'
    const resumeId =
      parsed.kind === 'lesson'
        ? parsed.lessonId ?? (isRoot ? useGameStore.getState().currentLessonId ?? 0 : 0)
        : 0
    loadLesson(resumeId).catch((err) => {
      console.error('Failed to initialise lesson:', err)
    })
  }, [loadLesson, pathname])

  useEffect(() => {
    if (!initializedRef.current) return
    const target = currentLessonId === 0 ? '/' : `/lesson/${currentLessonId}`
    if (window.location.pathname !== target) {
      window.history.replaceState(null, '', target)
    }
    if (pathname !== target) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPathname(target)
    }
  }, [currentLessonId, pathname])

  useEffect(() => {
    const onPopState = () => {
      const next = window.location.pathname
      setPathname(next)
      const parsed = parsePathname(next)
      if (parsed.kind === 'lesson') {
        const id = parsed.lessonId ?? 0
        if (id !== useGameStore.getState().currentLessonId) {
          loadLesson(id).catch(() => undefined)
        }
      }
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [loadLesson])

  const route = parsePathname(pathname).kind
  const isIntro = currentLessonId === 0

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: 'var(--color-base)' }}>
      <LabBar />
      <Header />
      {route === 'privacy' ? <PrivacyPage /> : (isIntro ? <IntroPage /> : <Workspace />)}
    </div>
  )
}
