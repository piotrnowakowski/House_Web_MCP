import { Building2, Eye, Settings2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useStudioStore } from './state/store'
import './neighbors.css'
import { HouseStudyControl } from './HouseStudyControl'

export function NeighborToggle({ iconOnly = false }: { iconOnly?: boolean }) {
  const neighbors = useStudioStore((state) => state.project.site.neighbors)
  const visible = useStudioStore((state) => state.neighborsVisible)
  const setVisible = useStudioStore((state) => state.setNeighborsVisible)
  if (!neighbors?.length) return null
  return <button className='neighbor-toggle' aria-label='Neighbor buildings' aria-pressed={visible} title='Show or hide neighbor buildings and their shadows' onClick={() => setVisible(!visible)}>
    <Building2 size={19} />{!iconOnly && <span>Neighbors</span>}
  </button>
}

/** View settings are local preferences; toggling does not create a house edit or undo entry. */
export function NeighborPreferences() {
  const ref = useStudioStore((state) => state.project.ref)
  const setVisible = useStudioStore((state) => state.setNeighborsVisible)
  useEffect(() => {
    const key = `neighbor-view/${ref}`
    try { setVisible(localStorage.getItem(key) === 'true') } catch { setVisible(false) }
    return useStudioStore.subscribe((state, previous) => {
      if (state.neighborsVisible !== previous.neighborsVisible) {
        try { localStorage.setItem(key, String(state.neighborsVisible)) } catch { /* Private browsing may disable storage. */ }
      }
    })
  }, [ref, setVisible])
  return null
}

export function NeighborSettings({ onView }: { onView?: () => void }) {
  const neighbors = useStudioStore((state) => state.project.site.neighbors) ?? []
  const viewFromNeighbor = useStudioStore((state) => state.viewFromNeighbor)
  const north = useStudioStore((state) => state.project.site.northDegrees)
  const [selected, setSelected] = useState('')
  const [eyeHeight, setEyeHeight] = useState(1.6)
  const neighbor = neighbors.find((item) => item.ref === selected) ?? neighbors[0]
  if (!neighbor) return null
  return <section className='neighbor-settings' aria-label='Neighbor view settings'>
    <strong>Neighbor buildings</strong>
    <NeighborToggle />
    <p>{neighbors.length} context buildings. Heights and roof forms are estimates; window positions are unknown. Shadows and facade viewpoints are approximate.</p>
    <label>View from<select aria-label='Neighbor viewpoint' value={neighbor.ref} onChange={(e) => setSelected(e.target.value)}>{neighbors.map((item) => <option key={item.ref} value={item.ref}>{item.name}</option>)}</select></label>
    <p>{neighbor.footprintConfidence === 'map-derived' ? 'Footprint from survey / cadastral data' : 'Approximate footprint from the map view'} · estimated ridge {neighbor.ridgeHeightM.toFixed(1)} m above ground.</p>
    <label>Eye height<select aria-label='Neighbor eye height' value={neighbor.ridgeHeightM < 5 ? 1.6 : eyeHeight} onChange={(e) => setEyeHeight(Number(e.target.value))}>
      <option value={1.6}>Ground floor · 1.6 m</option>
      {neighbor.ridgeHeightM >= 5 && <option value={4.6}>Upper floor · 4.6 m</option>}
    </select></label>
    <button onClick={() => { viewFromNeighbor(neighbor.ref, neighbor.ridgeHeightM < 5 ? 1.6 : eyeHeight); onView?.() }}><Eye size={18} />View towards our house</button>
    <small>True north in model: {north.toFixed(2)}°. Use Refocus to return to the house overview.</small>
  </section>
}

export function NeighborControls() {
  const neighbors = useStudioStore((state) => state.project.site.neighbors)
  const [open, setOpen] = useState(false)
  if (!neighbors?.length) return null
  return <div className='neighbor-controls' onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false) }}>
    <NeighborToggle />
    <button aria-label='Neighbor view settings' aria-expanded={open} onClick={() => setOpen(!open)}><Settings2 size={19} /></button>
    <HouseStudyControl />
    {open && <div className='neighbor-popover'><button aria-label='Close neighbor settings' onClick={() => setOpen(false)}>Close</button><NeighborSettings onView={() => setOpen(false)} /></div>}
  </div>
}
