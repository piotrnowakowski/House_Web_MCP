import { useEffect, useState } from 'react'
import { useStudioStore } from '../state/store'
import { PrecisionField } from '../interior/InteriorPanels'

export function ExactMeasureTools() {
  const mode = useStudioStore(s => s.viewerMode), points = useStudioStore(s => s.measurementPoints)
  const [draft, setDraft] = useState(points)
  useEffect(() => setDraft(points), [points])
  if (mode !== 'measure-length') return null
  const distance = points.length === 2 ? Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y, points[1].z - points[0].z) : null
  return <section className="exact-measure" aria-label="Exact distance">
    <h3>Exact distance</h3><p>Pick two points in the scene, or enter their coordinates. Values use metres in plot coordinates.</p>
    {distance !== null && <output aria-label="Exact distance result">{distance.toFixed(3)} m <small>({(distance * 1000).toFixed(1)} mm)</small></output>}
    <form onSubmit={e => { e.preventDefault(); if (draft.every(p => [p.x,p.y,p.z].every(Number.isFinite))) useStudioStore.getState().setMeasurementPoints(draft) }}>{draft.map((p, index) => <fieldset key={index}><legend>Point {index + 1}</legend><div className="interior-fields">{(['x', 'y', 'z'] as const).map(axis => <PrecisionField key={axis} label={`Point ${index + 1} ${axis.toUpperCase()} (m)`} value={p[axis]} min={-10000} max={10000} step={0.001} onChange={v => { setDraft(draft.map((q,i) => i === index ? { ...q, [axis]: v } : q)) }} />)}</div></fieldset>)}
    {draft.length === 2 && <button>Apply endpoints</button>}</form>
    <div className="edit-quick-actions"><button onClick={() => useStudioStore.getState().setMeasurementPoints([{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }])}>Enter two points</button><button onClick={() => useStudioStore.getState().setMeasurementPoints([])}>Clear points</button></div>
    <p className="interior-note">3D point-to-point distance in the model. Source survey accuracy is unchanged.</p>
  </section>
}
