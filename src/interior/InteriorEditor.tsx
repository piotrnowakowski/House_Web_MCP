import { Canvas } from '@react-three/fiber'
import { Suspense, useEffect, useState } from 'react'
import { ACESFilmicToneMapping, PCFSoftShadowMap } from 'three'
import { polygonArea, polygonBounds, spaceFootprint } from '../domain/geometry'
import { interiorCatalog } from '../domain/interior'
import { roomDimensions } from '../domain/roomDimensions'
import { isZielonkiProject } from '../domain/terrain'
import type { BuildingModel, InteriorCatalogId, InteriorItem, ProjectCommand, SpaceModel, StoreyModel, Vec2 } from '../domain/types'
import { useStudioStore } from '../state/store'
import { InteriorScene } from './InteriorScene'
import './interior.css'

function NumberField({ label, value, onChange, min = 0.1, max = 50 }: { label: string; value: number; onChange: (n: number) => void; min?: number; max?: number }) {
  return <label className='interior-field'><span>{label}</span><input type='number' step='any' min={min} max={max} value={Number.isNaN(value) ? '' : value} onChange={(e) => onChange(e.target.valueAsNumber)} required /></label>
}

function ItemInspector({ item, onSave, onRemove }: { item: InteriorItem; onSave: (item: InteriorItem) => void; onRemove: () => void }) {
  const [draft, setDraft] = useState(item)
  useEffect(() => setDraft(item), [item])
  return <form className='interior-inspector-form' onSubmit={(event) => { event.preventDefault(); onSave(draft) }}>
    <p className='interior-kicker'>SELECTED OBJECT</p><h2>{item.name}</h2>
    <label className='interior-field'><span>Object name</span><input value={draft.name} maxLength={100} required onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></label>
    <div className='interior-fields'><NumberField label='Width (m)' value={draft.widthM} onChange={(widthM) => setDraft({ ...draft, widthM })} max={20} /><NumberField label='Depth (m)' value={draft.depthM} onChange={(depthM) => setDraft({ ...draft, depthM })} max={20} /><NumberField label='Height (m)' value={draft.heightM} onChange={(heightM) => setDraft({ ...draft, heightM })} max={5} /><NumberField label='Rotation (°)' value={draft.rotationDegrees} min={-360} max={360} onChange={(rotationDegrees) => setDraft({ ...draft, rotationDegrees })} /><NumberField label='Position X (m)' value={draft.position.x} min={-1000} max={1000} onChange={(x) => setDraft({ ...draft, position: { ...draft.position, x } })} /><NumberField label='Position Z (m)' value={draft.position.z} min={-1000} max={1000} onChange={(z) => setDraft({ ...draft, position: { ...draft.position, z } })} /></div>
    <label className='interior-field interior-color'><span>Finish color</span><input type='color' value={draft.color} onChange={(e) => setDraft({ ...draft, color: e.target.value })} /></label>
    <button className='interior-primary' type='submit'>Apply changes</button><div className='interior-button-row'><button type='button' onClick={() => onSave({ ...item, rotationDegrees: (item.rotationDegrees + 90) % 360 })}>Rotate 90°</button><button className='interior-danger' type='button' onClick={onRemove}>Delete object</button></div>
    <p className='interior-note'>Drag to move · R to rotate · Delete to remove</p>
  </form>
}

function RoomInspector({ building, storey, room, commit }: { building: BuildingModel; storey: StoreyModel; room: SpaceModel; commit: (command: ProjectCommand) => boolean }) {
  const centreBounds = polygonBounds(spaceFootprint(building, room)); const measured = roomDimensions(building, room); const bounds = measured.bounds
  const initial = { name: room.name, width: +(bounds.maxX - bounds.minX).toFixed(2), depth: +(bounds.maxZ - bounds.minZ).toFixed(2) }
  const [draft, setDraft] = useState(initial)
  useEffect(() => setDraft({ name: room.name, width: +(bounds.maxX - bounds.minX).toFixed(2), depth: +(bounds.maxZ - bounds.minZ).toFixed(2) }), [room, bounds.minX, bounds.maxX, bounds.minZ, bounds.maxZ])
  return <form className='interior-inspector-form' onSubmit={(event) => { event.preventDefault(); commit({ type: 'interior.update', action: 'room', buildingRef: building.ref, storeyRef: storey.ref, spaceRef: room.ref, name: draft.name, ...(draft.width !== initial.width || draft.depth !== initial.depth ? { widthM: draft.width + centreBounds.maxX - centreBounds.minX - measured.width, depthM: draft.depth + centreBounds.maxZ - centreBounds.minZ - measured.depth } : {}) }) }}>
    <p className='interior-kicker'>ROOM DETAILS</p><h2>{room.name}</h2><label className='interior-field'><span>Room name</span><input value={draft.name} required maxLength={100} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></label>
    <div className='interior-fields'><NumberField label='Room width (m)' value={draft.width} min={1} onChange={(width) => setDraft({ ...draft, width })} /><NumberField label='Room depth (m)' value={draft.depth} min={1} onChange={(depth) => setDraft({ ...draft, depth })} /></div>
    <p className='interior-note'>Inside dimensions · {measured.area.toFixed(2)} m² usable floor area</p><button className='interior-primary' disabled={room.locked}>Save room</button><p className='interior-note'>Dimensions are measured between inside wall faces. For an L-shaped room they show its overall extent. Resizing moves connected walls and may change neighbouring rooms.</p>
  </form>
}

export function InteriorEditor({ onBack }: { onBack: () => void }) {
  const [fitting, setFitting] = useState(false)
  const project = useStudioStore((state) => state.project); const history = useStudioStore((state) => state.history)
  const [buildingRef, setBuildingRef] = useState(project.buildings.find((b) => b.kind === 'house')?.ref ?? project.buildings[0]?.ref)
  const building = project.buildings.find((b) => b.ref === buildingRef) ?? project.buildings[0]
  const [storeyRef, setStoreyRef] = useState(building?.storeys[0]?.ref)
  const storey = building?.storeys.find((s) => s.ref === storeyRef) ?? building?.storeys[0]
  const [plan, setPlan] = useState(false); const [reset, setReset] = useState(0)
  const [dimensions, setDimensions] = useState(true)
  const [selected, setSelected] = useState<string | null>(null); const [category, setCategory] = useState('All'); const [query, setQuery] = useState('')
  const [catalogOpen, setCatalogOpen] = useState(true); const [pending, setPending] = useState<InteriorCatalogId | null>(null)
  const [mode, setMode] = useState<'select' | 'measure'>('select'); const [points, setPoints] = useState<Vec2[]>([])
  const [snap, setSnap] = useState(true); const [labels, setLabels] = useState(!building?.interiorSource && project.site.knowledgeBase.datasetVersion !== 'reference-house-v1'); const [message, setMessage] = useState('Choose an object, then click the floor to place it.'); const [error, setError] = useState(false)
  const items = building?.furniture?.filter((item) => item.storeyRef === storey.ref) ?? []
  const item = items.find((entry) => entry.ref === selected); const room = building?.spaces.find((entry) => entry.ref === selected && storey.spaceRefs.includes(entry.ref))
  const commit = (command: ProjectCommand) => {
    try { useStudioStore.getState().commitCommand(command); setError(false); setMessage('Changes saved to this project.'); return true }
    catch (e) { setError(true); setMessage(e instanceof Error ? e.message : 'Could not apply this edit.'); return false }
  }
  const put = (value: InteriorItem) => commit({ type: 'interior.update', action: 'put', buildingRef: building.ref, storeyRef: storey.ref, item: value })
  const remove = () => { if (item && commit({ type: 'interior.update', action: 'remove', buildingRef: building.ref, storeyRef: storey.ref, itemRef: item.ref })) setSelected(null) }
  const clearTool = () => { setPending(null); setMode('select'); setPoints([]); setError(false) }
  useEffect(() => {
    setSelected(null); setPending(null); setPoints([]); setMode('select')
  }, [building?.ref, storey?.ref])
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && (event.target.matches('input, textarea, select') || event.target.isContentEditable)) return
      if (event.key === 'Escape') { clearTool(); setSelected(null) }
      if ((event.key === 'Delete' || event.key === 'Backspace') && item) { event.preventDefault(); remove() }
      if (event.key.toLowerCase() === 'r' && item && !event.ctrlKey && !event.metaKey) put({ ...item, rotationDegrees: (item.rotationDegrees + 90) % 360 })
      if (item && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
        event.preventDefault(); const step = event.shiftKey ? 0.5 : 0.1
        put({ ...item, position: { x: +(item.position.x + (event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0)).toFixed(2), z: +(item.position.z + (event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0)).toFixed(2) } })
      }
    }
    window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler)
  })
  if (!building || !storey) return <main className='interior-editor'><button onClick={onBack}>← Back to plot</button><p>Add a house on the plot to start editing its interior.</p></main>
  const footprint = building.slabs.find((s) => s.ref === storey.baseSlabRef)!.footprint
  const rooms = building.spaces.filter((s) => storey.spaceRefs.includes(s.ref))
  const catalog = interiorCatalog.filter((entry) => (category === 'All' || entry.category === category) && entry.name.toLowerCase().includes(query.toLowerCase()))
  const pick = (point: Vec2) => {
    const position = snap ? { x: Math.round(point.x * 10) / 10, z: Math.round(point.z * 10) / 10 } : point
    if (mode === 'measure') { setPoints((previous) => previous.length === 1 ? [...previous, position] : [position]); return }
    if (pending) {
      const entry = interiorCatalog.find((value) => value.id === pending)!
      const placed: InteriorItem = { ref: `interior/${crypto.randomUUID()}`, catalogId: entry.id, storeyRef: storey.ref, name: entry.name, position, widthM: entry.size[0], depthM: entry.size[1], heightM: entry.size[2], rotationDegrees: 0, color: entry.color }
      if (put(placed)) { setSelected(placed.ref); setPending(null) }
    } else setSelected(null)
  }
  return <main className='interior-editor' aria-label='House interior editor'>
    <header className='interior-header'><button className='interior-back' onClick={onBack}>← <span>Back to plot</span></button><div className='interior-title'><p className='interior-kicker'>SPATIAL EDITOR</p><h1>House interior</h1></div><div className='interior-header-right'><span>{project.name}</span><button disabled={!history.length} onClick={() => { useStudioStore.getState().undo(); setMessage('Last change undone.'); setError(false) }}>↶ Undo</button></div></header>
    <div className='interior-workspace'>
      <section className={`interior-stage ${pending ? 'is-placing' : ''} ${mode === 'measure' ? 'is-measuring' : ''}`} aria-label='Interior floor view'>
        <Canvas orthographic shadows dpr={[1, 2]} camera={{ position: [10, 26, 15], zoom: 30, near: 0.1, far: 200 }} gl={{ antialias: true, preserveDrawingBuffer: true }} onCreated={({ gl }) => { gl.toneMapping = ACESFilmicToneMapping; gl.toneMappingExposure = 1; gl.shadowMap.type = PCFSoftShadowMap; gl.domElement.setAttribute('aria-label', 'Interactive interior floor'); gl.domElement.setAttribute('role', 'application'); gl.domElement.tabIndex = 0 }}><Suspense fallback={null}><InteriorScene key={`${building.ref}/${storey.ref}`} building={building} storey={storey} plan={plan} reset={reset} selected={selected} mode={mode} placing={!!pending} snap={snap} labels={labels} dimensions={dimensions} points={points} onPick={pick} onSelect={setSelected} onMove={put} /></Suspense></Canvas>
        <div className='interior-view-controls'><div className='interior-segment' aria-label='Interior view mode'><button aria-pressed={plan} onClick={() => { setPlan(true); setLabels(true) }}>2D Plan</button><button aria-pressed={!plan} onClick={() => { setPlan(false); if (building.interiorSource || project.site.knowledgeBase.datasetVersion === 'reference-house-v1') setLabels(false) }}>3D Interior</button></div><button className='interior-fit' onClick={() => setReset((v) => v + 1)} title='Fit floor in view'>⌖ Fit view</button></div>
        <div className='interior-floor-controls'><label><span>Building</span><select aria-label='Interior building' value={building.ref} onChange={(e) => { setBuildingRef(e.target.value); setStoreyRef('') }}>{project.buildings.map((b) => <option key={b.ref} value={b.ref}>{b.name}{b.kind === 'garage' ? ' · Garage' : ''}</option>)}</select></label><div className='interior-floor-tabs' aria-label='House levels'>{[...building.storeys].sort((a, b) => b.level - a.level).map((s) => <button key={s.ref} aria-pressed={storey.ref === s.ref} onClick={() => setStoreyRef(s.ref)}><span>{s.level === 0 ? 'G' : s.level}</span>{s.name}</button>)}</div></div>
        <div className='interior-tools' aria-label='Interior tools'><button aria-pressed={mode === 'select' && !pending} onClick={clearTool}>↖ Select</button><button aria-pressed={mode === 'measure'} onClick={() => { setPending(null); setMode('measure'); setSelected(null); setPoints([]) }}>↔ Measure</button><button aria-pressed={labels} onClick={() => setLabels(!labels)}>Aa Labels</button><button aria-pressed={dimensions} onClick={() => { setDimensions(!dimensions); setPlan(true) }}>↔ Dimensions</button><button aria-pressed={snap} onClick={() => setSnap(!snap)}>⊞ Snap 10 cm</button></div>
        <div className='interior-stage-bottom'><div className='interior-floor-summary'><strong>{storey.name}</strong><span>{(polygonArea(footprint) - (building.slabs.find((s) => s.ref === storey.baseSlabRef)?.holes ?? []).reduce((a, hole) => a + polygonArea(hole), 0)).toFixed(1)} m² gross · {rooms.length} rooms · {items.length} objects</span></div><button className='interior-primary interior-catalog-toggle' aria-expanded={catalogOpen} onClick={() => setCatalogOpen(!catalogOpen)}>{catalogOpen ? 'Hide catalog' : '+ Furniture catalog'}</button></div>
        {(pending || mode === 'measure') && <div className='interior-tool-prompt' role='status'><span>{pending ? `Click the floor to place ${interiorCatalog.find((v) => v.id === pending)?.name.toLowerCase()}` : points.length === 0 ? 'Click the first measurement point' : points.length === 1 ? 'Click the second measurement point' : `Distance: ${Math.hypot(points[1].x - points[0].x, points[1].z - points[0].z).toFixed(2)} m · Click to start again`}</span><button onClick={clearTool}>Done</button></div>}
      </section>
      <aside className='interior-sidebar' aria-label='Interior catalog and details'>
        {(building.interiorSource || project.site.knowledgeBase.datasetVersion === 'reference-house-v1') && <details className='interior-reference-notes'><summary>Plan dimensions &amp; source notes</summary><p>Original reference · current room sizes update as you edit.</p>{(building.interiorSource?.notes ?? project.site.knowledgeBase.caveats).map((note, i) => <p key={i}>{note}</p>)}</details>}
        {!building.interiorSource && (isZielonkiProject(project) || project.site.knowledgeBase.datasetVersion === 'reference-house-v1') && <button className='interior-primary' disabled={fitting} onClick={async () => {
          setFitting(true)
          try { await useStudioStore.getState().fitReferenceToZielonki(); setSelected(null); setLabels(false); setReset((v) => v + 1); setMessage('Zielonki now uses the measured interior and fitted barn exterior.'); setError(false) }
          catch (e) { setError(true); setMessage(e instanceof Error ? e.message : 'Could not fit the Zielonki house.') }
          finally { setFitting(false) }
        }}>{fitting ? 'Fitting Zielonki…' : 'Fit reference interior to Zielonki'}</button>}
        {item ? <ItemInspector item={item} onSave={put} onRemove={remove} /> : room ? <RoomInspector building={building} storey={storey} room={room} commit={commit} /> : <div className='interior-overview'><p className='interior-kicker'>FURNITURE & ROOMS</p><h2>Furnish this floor.</h2><p>Choose an object, then click the floor to place it.</p></div>}
        {(item || room) && <button className='interior-deselect' onClick={() => setSelected(null)}>← Browse furniture & rooms</button>}
        {catalogOpen && <section className='interior-catalog' aria-label='Furniture catalog'><div className='interior-section-title'><h3>Furniture & fittings</h3><span>{interiorCatalog.length} objects</span></div><input type='search' aria-label='Search furniture' placeholder='Search furniture, appliances…' value={query} onChange={(e) => setQuery(e.target.value)} /><div className='interior-categories'>{['All', 'Living', 'Bedroom', 'Kitchen', 'Bathroom', 'Garage'].map((c) => <button key={c} aria-pressed={c === category} onClick={() => setCategory(c)}>{c}</button>)}</div><div className='interior-catalog-grid'>{catalog.map((entry) => <button key={entry.id} className={pending === entry.id ? 'active' : ''} aria-label={`Place ${entry.name}`} onClick={() => { setPending(entry.id); setMode('select'); setSelected(null); setError(false) }}><span className={`interior-object-preview preview-${entry.id}`} style={{ '--object-color': entry.color } as React.CSSProperties}><i /><b /><em /></span><strong>{entry.name}</strong><small>{entry.size[0].toFixed(2)} × {entry.size[1].toFixed(2)} m<span>+</span></small></button>)}</div>{!catalog.length && <p className='interior-note'>No objects match this search.</p>}</section>}
        <section className='interior-room-list' aria-label='Rooms on this level'><div className='interior-section-title'><h3>Rooms on this level</h3><span>{rooms.length}</span></div>{rooms.map((r) => <button key={r.ref} onClick={() => { setSelected(r.ref); clearTool() }}><span>{r.name}</span><small>{roomDimensions(building, r).area.toFixed(2)} m² <b>↗</b></small></button>)}</section>
        {!!items.length && <section className='interior-room-list' aria-label='Placed objects'><div className='interior-section-title'><h3>Placed objects</h3><span>{items.length}</span></div>{items.map((entry) => <button key={entry.ref} onClick={() => { setSelected(entry.ref); clearTool() }}><span>{entry.name}</span><small>Edit ↗</small></button>)}</section>}
      </aside>
    </div>
    <footer className={`interior-status ${error ? 'has-error' : ''}`}><span role={error ? 'alert' : 'status'}>{message}</span><span>Metres · Drag to orbit · Scroll to zoom</span></footer>
  </main>
}
