import { TreePine } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useStudioStore } from './state/store'
import './plot-view-controls.css'

export function TreeToggle() {
  const visible = useStudioStore(s => s.treesVisible)
  return <button className="neighbor-toggle" aria-label="Trees" aria-pressed={visible} title="Show or hide trees" onClick={() => useStudioStore.getState().setTreesVisible(!visible)}><TreePine size={19} /></button>
}

export function TreePreferences() {
  const ref = useStudioStore(s => s.project.ref)
  useEffect(() => {
    const key = `tree-view/${ref}`
    try { useStudioStore.getState().setTreesVisible(localStorage.getItem(key) !== 'false') } catch { useStudioStore.getState().setTreesVisible(true) }
    return useStudioStore.subscribe((state, previous) => {
      if (state.treesVisible !== previous.treesVisible) {
        try { localStorage.setItem(key, String(state.treesVisible)) } catch { /* Storage is optional. */ }
      }
    })
  }, [ref])
  return null
}

export function FloorToggle({ onSelect }: { onSelect: (storeyRef: string) => void }) {
  const house = useStudioStore(s => s.project.buildings.find(b => b.kind === 'house') ?? s.project.buildings[0])
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!open) return
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false) }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [open])
  if (!house?.storeys.length) return null
  return <div className="plot-floor-control" ref={root} onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); setOpen(false); trigger.current?.focus() } }}>
    <button ref={trigger} className="neighbor-toggle" aria-label="Choose floor" title="Choose house floor" aria-expanded={open} onClick={() => setOpen(!open)}>
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 20h6v-6h6V8h6V3M3 3v17h18" /></svg>
    </button>
    {open && <div className="plot-floor-options" role="group" aria-label="Choose house floor"><span>House levels</span>{[...house.storeys].sort((a, b) => a.level - b.level).map(floor => <button key={floor.ref} onClick={() => { setOpen(false); onSelect(floor.ref) }}>{floor.name}</button>)}</div>}
  </div>
}
