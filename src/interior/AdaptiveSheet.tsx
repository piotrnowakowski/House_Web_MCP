import { ChevronDown, ChevronUp, X } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import './adaptive.css'
import { WorkspaceSaveStatus } from '../components/WorkspaceSaveStatus'

export function useCompactLayout() {
  const [compact, setCompact] = useState(() => window.matchMedia('(max-width: 900px)').matches)
  useEffect(() => {
    const query = window.matchMedia('(max-width: 900px)')
    const update = () => setCompact(query.matches)
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  return compact
}

export function AdaptiveSheet({
  open,
  title,
  onClose,
  children,
  expanded,
  onExpanded,
  revealKey,
  footer,
}: {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  expanded: boolean
  onExpanded: (expanded: boolean) => void
  revealKey?: string | null
  footer?: ReactNode
}) {
  const start = useRef<number | null>(null)
  const panel = useRef<HTMLElement>(null)
  const body = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    if (!open || !revealKey || !body.current) return
    body.current.scrollTop = 0
    body.current.querySelector<HTMLElement>('[data-selection-inspector]')?.focus({ preventScroll: true })
  }, [open, revealKey])
  useEffect(() => {
    const viewport = window.visualViewport
    const update = () => {
      if (!viewport || !panel.current) return
      const keyboard = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)
      panel.current.style.setProperty('--keyboard-inset', `${keyboard}px`)
      panel.current.style.setProperty('--sheet-viewport', `${viewport.height}px`)
      if (keyboard > 80) (document.activeElement as HTMLElement | null)?.scrollIntoView({ block: 'nearest' })
    }
    viewport?.addEventListener('resize', update)
    viewport?.addEventListener('scroll', update)
    update()
    return () => {
      viewport?.removeEventListener('resize', update)
      viewport?.removeEventListener('scroll', update)
    }
  }, [open])
  useEffect(() => {
    if (!open) return
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('keydown', escape)
    return () => document.removeEventListener('keydown', escape)
  }, [open, onClose])
  if (!open) return null
  return (
    <section
      ref={panel}
      className={`adaptive-sheet ${expanded ? 'is-expanded' : ''} ${footer ? 'has-edit-actions' : ''}`}
      role="dialog"
      aria-label={title}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <header
        className="sheet-header"
        onPointerDown={(event) => {
          if ((event.target as HTMLElement).closest('button')) return
          start.current = event.clientY
          event.currentTarget.setPointerCapture(event.pointerId)
        }}
        onPointerUp={(event) => {
          if (start.current === null) return
          const delta = event.clientY - start.current
          start.current = null
          if (delta < -30) onExpanded(true)
          if (delta > 30) {
            if (expanded) onExpanded(false)
            else onClose()
          }
          if (event.currentTarget.hasPointerCapture(event.pointerId))
            event.currentTarget.releasePointerCapture(event.pointerId)
        }}
        onPointerCancel={() => {
          start.current = null
        }}
      >
        <span className="sheet-grip" />
        <h2>{title}</h2>
        <button aria-label={expanded ? "Zwiń panel" : "Rozwiń panel"} onClick={() => onExpanded(!expanded)}>
          {expanded ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
        </button>
        <button aria-label="Zamknij panel" onClick={onClose}>
          <X size={18} />
        </button>
      </header>
      <div className="sheet-body" ref={body}>{children}</div>
      {footer && <div className="sheet-edit-actions">{footer}</div>}
      <WorkspaceSaveStatus className="sheet-save-status" />
    </section>
  )
}
