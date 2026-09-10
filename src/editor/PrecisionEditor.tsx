import { useEffect, useState, type ReactNode } from 'react'
import { Undo2, Redo2, Move, Ruler } from 'lucide-react'
import { useStudioStore } from '../state/store'
import { availableInteriorHeight } from '../domain/interior'
import { furnitureMoveCommands } from '../domain/precisionEdits'
import { validateProject } from '../domain/commands'
import { ItemInspector, OpeningInspector, PrecisionField, WallInspector } from '../interior/InteriorPanels'
import type { BuildingModel, ProjectCommand, Vec2 } from '../domain/types'
import { ExactMeasureTools } from './ExactMeasureTools'
import './precision-editor.css'

export function EditHistory() {
  const history = useStudioStore(s => s.history.length), future = useStudioStore(s => s.future.length)
  return <div className="edit-history" aria-label="Edit history"><button aria-label="Undo edit" disabled={!history} onClick={() => useStudioStore.getState().undo()}><Undo2 size={17} />Undo</button><button aria-label="Redo edit" disabled={!future} onClick={() => useStudioStore.getState().redo()}><Redo2 size={17} />Redo</button></div>
}

function PositionEditor({ position, rotation, label, onSave, children, disabled = false }: { position: Vec2; rotation?: number; label: string; onSave: (position: Vec2, rotation: number) => boolean; children?: ReactNode; disabled?: boolean }) {
  const [draft, setDraft] = useState(position), [angle, setAngle] = useState(rotation ?? 0), [step, setStep] = useState(0.1)
  useEffect(() => { setDraft(position); setAngle(rotation ?? 0) }, [position, rotation])
  return <form className="position-editor" aria-label={label} onSubmit={e => { e.preventDefault(); onSave(draft, angle) }}>
    <h3>{label}</h3><fieldset disabled={disabled}>
    <div className="interior-fields"><PrecisionField label="Position X (m)" min={-10000} max={10000} value={draft.x} onChange={x => setDraft({ ...draft, x })} /><PrecisionField label="Position Z (m)" min={-10000} max={10000} value={draft.z} onChange={z => setDraft({ ...draft, z })} />{rotation !== undefined && <PrecisionField label="Rotation (°)" min={-360} max={360} step={1} value={angle} onChange={setAngle} />}</div>
    <label className="interior-field">Move step<select aria-label="Move step" value={step} onChange={e => setStep(Number(e.target.value))}><option value={0.01}>1 cm</option><option value={0.1}>10 cm</option><option value={1}>1 m</option></select></label>
    <div className="edit-nudge" aria-label="Adjust position">{(['x', 'z'] as const).flatMap(axis => [-1, 1].map(sign => <button type="button" key={`${axis}/${sign}`} aria-label={`Move ${axis.toUpperCase()} ${sign > 0 ? 'plus' : 'minus'}`} onClick={() => setDraft({ ...draft, [axis]: +(draft[axis] + sign * step).toFixed(4) })}>{axis.toUpperCase()} {sign > 0 ? '+' : '−'}</button>))}</div>
    {children}<button className="interior-primary">Apply position</button><button type="button" onClick={() => { setDraft(position); setAngle(rotation ?? 0) }}>Cancel adjustment</button>
    </fieldset>
  </form>
}

export function PrecisionEditor() {
  const project = useStudioStore(s => s.project), selected = useStudioStore(s => s.selectedRef)
  const pending = useStudioStore(s => s.confirmationVariantRef)
  const mode = useStudioStore(s => s.viewerMode)
  const setSelected = useStudioStore(s => s.setSelectedRef)
  const [error, setError] = useState(''), [success, setSuccess] = useState(''), [linked, setLinked] = useState(true)
  useEffect(() => { setError(''); setSuccess('') }, [selected])
  const commit = (commands: ProjectCommand | ProjectCommand[]) => {
    try {
      if (pending) throw new Error('Apply or reject the pending proposal before editing.')
      useStudioStore.getState().commitCommands(Array.isArray(commands) ? commands : [commands], 'Edit applied. Undo is available.')
      setError(''); setSuccess('Applied. Changes are autosaved.'); return true
    } catch (e) { setError(e instanceof Error ? e.message : 'Edit failed.'); setSuccess(''); return false }
  }
  const building = project.buildings.find(b => b.ref === selected)
  const host = project.buildings.find(b => b.furniture?.some(i => i.ref === selected) || b.walls.some(w => w.ref === selected || w.openings.some(o => o.ref === selected)))
  const item = host?.furniture?.find(i => i.ref === selected)
  const wall = host?.walls.find(w => w.ref === selected || w.openings.some(o => o.ref === selected))
  const opening = wall?.openings.find(o => o.ref === selected)
  const storey = host?.storeys.find(s => item ? s.ref === item.storeyRef : wall && s.wallRefs.includes(wall.ref))
  const fixture = project.landscape.fixtures.find(f => f.ref === selected), plant = project.landscape.plants.find(p => p.ref === selected)
  const warnings = validateProject(project).filter(i => i.severity === 'warning' && (i.subjectRef === selected || i.subjectRef === host?.ref))
  const options = project.buildings.map(b => ({ building: b, entries: [
    { ref: b.ref, name: b.name },
    ...b.walls.flatMap(w => [{ ref: w.ref, name: `${b.storeys.find(s => s.wallRefs.includes(w.ref))?.name ?? ''} · Wall ${w.ref.split('/').at(-1)}` }, ...w.openings.map(o => ({ ref: o.ref, name: `${o.kind === 'window' ? 'Window' : 'Door'} · ${o.ref.split('/').at(-1)}` }))]),
    ...(b.furniture ?? []).map(i => ({ ref: i.ref, name: i.name })),
  ] }))
  const moveBuilding = (b: BuildingModel, position: Vec2, rotationDegrees: number) => commit({ type: 'building.update', action: 'move', buildingRef: b.ref, position, rotationDegrees, moveLinkedFeatures: linked && project.ref === 'project/zielonki-v2' && b.ref === 'house/main' })
  return <section className="precision-editor" aria-label="Precision editor">
    <header><h3>Edit & measure</h3><EditHistory /></header>
    <label className="interior-field">Choose an element<select aria-label="Choose element to edit" value={selected ?? ''} onChange={e => { useStudioStore.getState().setViewerMode('edit'); setSelected(e.target.value || null) }}><option value="">Select in the scene or choose here</option>{selected && !options.some(g => g.entries.some(e => e.ref === selected)) && !fixture && !plant && <option value={selected}>Selected element</option>}{options.map(g => <optgroup key={g.building.ref} label={g.building.name}>{g.entries.map(e => <option key={e.ref} value={e.ref}>{e.name}</option>)}</optgroup>)}<optgroup label="Garden">{[...project.landscape.fixtures, ...project.landscape.plants].map(e => <option key={e.ref} value={e.ref}>{e.name}</option>)}</optgroup></select></label>
    <div className="edit-quick-actions"><button onClick={() => { useStudioStore.getState().setViewerMode('edit'); setSelected(project.buildings.find(b => b.kind === 'house')?.ref ?? null) }}><Move size={16} />Move house</button><button onClick={() => useStudioStore.getState().setViewerMode('measure-length')}><Ruler size={16} />Measure distance</button></div>
    {error && <p role="alert" className="edit-error">{error}</p>}{success && <p role="status" className="edit-success">{success}</p>}
    <fieldset hidden={mode !== 'edit' && mode !== 'plan'} disabled={!!pending} className="edit-body">
    {building && <PositionEditor key={building.ref} label="Building position" position={building.position} rotation={building.rotationDegrees} onSave={(p,r) => moveBuilding(building,p,r)}>{project.ref === 'project/zielonki-v2' && building.ref === 'house/main' && <label className="edit-check"><input type="checkbox" checked={linked} onChange={e => setLinked(e.target.checked)} />Move carport, terrace and entrance path together</label>}<p className="interior-note">Metres in plot coordinates. The road entrance stays fixed; check the approach after moving.</p></PositionEditor>}
    {fixture && <PositionEditor key={fixture.ref} label="Garden object position" position={fixture.position} rotation={fixture.rotationDegrees} disabled={fixture.locked} onSave={(position, rotationDegrees) => commit([{ type: 'garden-fixture.update', action: 'move', fixtureRef: fixture.ref, position }, { type: 'garden-fixture.update', action: 'rotate', fixtureRef: fixture.ref, rotationDegrees }])} />}
    {plant && <><PositionEditor key={plant.ref} label="Plant position" position={plant.position} disabled={plant.locked} onSave={position => commit({ type: 'plant.update', action: 'move', plantRef: plant.ref, position })} />{plant.locked && <p>Unlock this plant below before moving it.</p>}</>}
    {item && host && storey && <ItemInspector key={item.ref} item={item} interactionHint="Position uses floor coordinates inside the building. Open House interior to drag furniture in 2D or 3D." availableHeight={availableInteriorHeight(item, host, storey)} onSave={changed => commit(furnitureMoveCommands(host, item, changed))} />}
    {item?.locked && host && storey && <button onClick={() => commit({ type: 'interior.update', action: 'lock', buildingRef: host.ref, storeyRef: storey.ref, itemRefs: item.groupRef ? (host.furniture ?? []).filter(i => i.groupRef === item.groupRef).map(i => i.ref) : [item.ref], locked: false })}>Unlock object</button>}
    {opening && wall && host && storey ? <OpeningInspector key={opening.ref} wall={wall} opening={opening} building={host} storey={storey} commit={commit} /> : wall && host && storey && <WallInspector key={wall.ref} wall={wall} building={host} storey={storey} commit={commit} onSelect={setSelected} />}
    </fieldset>
    {!!warnings.length && <details className="edit-warnings"><summary>Placement notes ({warnings.length})</summary>{warnings.map((w,i) => <p key={i}>{w.message}</p>)}</details>}
    <ExactMeasureTools />
  </section>
}
