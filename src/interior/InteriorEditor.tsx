import { isEnvelopeWall } from '../domain/interiorLayout'
import { randomId } from '../domain/randomId'
import { Canvas } from '@react-three/fiber'
import { Suspense, useEffect, useRef, useState, type ReactNode } from 'react'
import {
  ArrowLeft,
  Box,
  Check,
  Copy,
  Eye,
  EyeOff,
  Focus,
  LockKeyhole,
  MoreHorizontal,
  MousePointer2,
  Plus,
  Redo2,
  RotateCw,
  Ruler,
  Settings2,
  Trash2,
  Undo2,
  X,
} from 'lucide-react'
import { ACESFilmicToneMapping, PCFSoftShadowMap } from 'three'
import { polygonCentroid, spaceFootprint } from '../domain/geometry'
import { interiorCatalog, availableInteriorHeight } from '../domain/interior'
import { createIkeaItem } from '../domain/ikeaCatalog'
import { placementWarnings, snapFurniture, type SnapSettings } from '../domain/interiorPlacement'
import { parseProject } from '../domain/schema'
import { validateProject } from '../domain/commands'
import { isZielonkiProject } from '../domain/terrain'
import type { InteriorItem, ProjectCommand, Vec2 } from '../domain/types'
import { useStudioStore } from '../state/store'
import { saveWorkspace } from '../services/persistence'
import { AdaptiveSheet, useCompactLayout } from './AdaptiveSheet'
import {
  FurnitureCatalog,
  ItemInspector,
  OpeningInspector,
  PrecisionControls,
  PrecisionField,
  RoomInspector,
  WallInspector,
} from './InteriorPanels'
import { InteriorScene } from './InteriorScene'
import type { InteriorView } from './InteriorCamera'
import { downloadInteriorFile, furnitureCsv, furnitureList, printInteriorPlan } from './interiorExports'
import './interior.css'

type Panel = 'catalog' | 'edit' | 'more' | 'review' | null

export function InteriorEditor({ onBack, approval }: { onBack: () => void; approval: ReactNode }) {
  const project = useStudioStore((s) => s.project)
  const toast = useStudioStore((s) => s.toast)
  const history = useStudioStore((s) => s.history)
  const future = useStudioStore((s) => s.future)
  const confirmationRef = useStudioStore((s) => s.confirmationVariantRef)
  const variants = useStudioStore((s) => s.variants)
  const proposals = useStudioStore((s) => s.proposals)
  const preview = variants.find((v) => v.ref === confirmationRef)?.project
  const compact = useCompactLayout()
  const root = useRef<HTMLElement>(null)
  const importInput = useRef<HTMLInputElement>(null)
  const [buildingRef, setBuildingRef] = useState(project.buildings.find((b) => b.kind === 'house')?.ref)
  const building = project.buildings.find((b) => b.ref === buildingRef) ?? project.buildings[0]
  const [storeyRef, setStoreyRef] = useState(building?.storeys[0]?.ref)
  const storey = building?.storeys.find((s) => s.ref === storeyRef) ?? building?.storeys[0]
  const [view, setView] = useState<InteriorView>('cutaway')
  const [reset, setReset] = useState(0)
  const [fitRoom, setFitRoom] = useState(false)
  const [panel, setPanel] = useState<Panel>(null)
  const [expanded, setExpanded] = useState(false)
  const [hidden, setHidden] = useState(false)
  const [selectedRefs, setSelectedRefs] = useState<string[]>([])
  const [multi, setMulti] = useState(false)
  const [ghost, setGhost] = useState<InteriorItem | null>(null)
  const [replacing, setReplacing] = useState<string | null>(null)
  const [mode, setMode] = useState<'select' | 'measure' | 'partition'>('select')
  const [points, setPoints] = useState<Vec2[]>([])
  const [snap, setSnap] = useState<SnapSettings>({ enabled: true, gridM: 0.1, alignment: true })
  const [labels, setLabels] = useState(false)
  const [dimensions, setDimensions] = useState(true)
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null)
  useEffect(() => {
    if (toast?.includes('autosave failed')) setNotice({ text: toast, error: true })
  }, [toast])
  const [fitting, setFitting] = useState(false)
  const items = building?.furniture?.filter((i) => i.storeyRef === storey?.ref) ?? []
  const selected = selectedRefs[0] ?? null
  const item = items.find((i) => i.ref === selected)
  const room = building?.spaces.find((r) => r.ref === selected && storey?.spaceRefs.includes(r.ref))
  const wall = building?.walls.find((w) => w.ref === selected && storey?.wallRefs.includes(w.ref))
  const openingWall = building?.walls.find(
    (w) => storey?.wallRefs.includes(w.ref) && w.openings.some((o) => o.ref === selected),
  )
  const opening = openingWall?.openings.find((o) => o.ref === selected)
  const floorWalls = building?.walls.filter(w => storey?.wallRefs.includes(w.ref)) ?? []
  const selectedWalls = floorWalls.filter(w => selectedRefs.includes(w.ref))
  const wallGroup = selectedWalls[0]?.groupRef
  const wallsGrouped = !!wallGroup && selectedWalls.every(w => w.groupRef === wallGroup)
  const canGroupWalls = selectedWalls.length >= 2 && selectedWalls.every(w => !w.locked && !isEnvelopeWall(building, storey, w))
  const selectedItems = items.filter((i) => selectedRefs.includes(i.ref))
  useEffect(() => {
    if (confirmationRef) {
      setPanel('review')
      setExpanded(true)
      setHidden(false)
      setGhost(null)
    } else setPanel((value) => (value === 'review' ? null : value))
  }, [confirmationRef])
  const tell = (text: string, error = false) => setNotice({ text, error })
  useEffect(() => {
    if (!notice || notice.error) return
    const timer = setTimeout(() => setNotice(null), 3500)
    return () => clearTimeout(timer)
  }, [notice])
  useEffect(() => {
    setSelectedRefs([])
    setGhost(null)
    setPoints([])
    setMode('select')
    setFitRoom(false)
  }, [building?.ref, storey?.ref])
  const commit = (commands: ProjectCommand | ProjectCommand[]) => {
    if (confirmationRef) {
      tell('Apply or reject the pending proposal before editing.', true)
      return false
    }
    try {
      useStudioStore.getState().commitCommands(Array.isArray(commands) ? commands : [commands])
      tell('Saved to this project.')
      return true
    } catch (error) {
      tell(error instanceof Error ? error.message : 'Could not apply this edit.', true)
      return false
    }
  }
  const base = { type: 'interior.update' as const, buildingRef: building?.ref, storeyRef: storey?.ref }
  const put = (value: InteriorItem): ProjectCommand => ({ ...base, action: 'put', item: value })
  const clearTool = () => {
    setGhost(null)
    setReplacing(null)
    setMode('select')
    setPoints([])
    setNotice(null)
  }
  const select = (ref: string | null, additive = false) => {
    if (!ref) {
      if (!multi) setSelectedRefs([])
      return
    }
    const candidates = floorWalls.some(w => w.ref === ref) ? floorWalls : items
    const target = candidates.find(i => i.ref === ref)
    const refs = target?.groupRef ? candidates.filter(i => i.groupRef === target.groupRef).map(i => i.ref) : [ref]
    setSelectedRefs((previous) =>
      additive || multi
        ? previous.includes(ref)
          ? previous.filter((r) => !refs.includes(r))
          : [...new Set([...previous, ...refs])]
        : [ref, ...refs.filter((r) => r !== ref)],
    )
    if (!compact && mode === 'select') setPanel('edit')
  }
  const saveItem = (changed: InteriorItem) => {
    const original = items.find((i) => i.ref === changed.ref)
    if (!original?.groupRef) {
      return commit(put(changed))
    }
    const angle = ((changed.rotationDegrees - original.rotationDegrees) * Math.PI) / 180
    const members = items.filter((i) => i.groupRef === original.groupRef)
    return commit(
      members.map((i) => {
        if (i.ref === original.ref) return put(changed)
        const dx = i.position.x - original.position.x
        const dz = i.position.z - original.position.z
        return put({
          ...i,
          position: {
            x: changed.position.x + dx * Math.cos(angle) + dz * Math.sin(angle),
            z: changed.position.z - dx * Math.sin(angle) + dz * Math.cos(angle),
          },
          rotationDegrees: i.rotationDegrees + changed.rotationDegrees - original.rotationDegrees,
          elevationM: (i.elevationM ?? 0) + (changed.elevationM ?? 0) - (original.elevationM ?? 0),
        })
      }),
    )
  }
  const move = (changed: InteriorItem) => {
    const original = items.find((i) => i.ref === changed.ref)
    if (!original) return
    const members = items.filter(
      (i) =>
        i.ref === original.ref ||
        selectedRefs.includes(i.ref) ||
        (original.groupRef && original.groupRef === i.groupRef),
    )
    commit(
      members.map((i) =>
        put({
          ...i,
          position: {
            x: i.position.x + changed.position.x - original.position.x,
            z: i.position.z + changed.position.z - original.position.z,
          },
        }),
      ),
    )
  }
  const rotate = () => {
    if (ghost) {
      setGhost({ ...ghost, rotationDegrees: (ghost.rotationDegrees + 90) % 360 })
      return
    }
    if (!selectedItems.length) return
    const pivot =
      selectedItems.length > 1
        ? {
            x: selectedItems.reduce((s, i) => s + i.position.x, 0) / selectedItems.length,
            z: selectedItems.reduce((s, i) => s + i.position.z, 0) / selectedItems.length,
          }
        : item!.position
    commit(
      selectedItems.map((i) =>
        put({
          ...i,
          rotationDegrees: (i.rotationDegrees + 90) % 360,
          position: { x: pivot.x + i.position.z - pivot.z, z: pivot.z - i.position.x + pivot.x },
        }),
      ),
    )
  }
  const remove = () => {
    if (selectedItems.length && commit(selectedItems.map((i) => ({ ...base, action: 'remove', itemRef: i.ref }))))
      setSelectedRefs([])
  }
  const duplicate = () => {
    const groupRef = selectedItems.length > 1 ? `group/${randomId()}` : undefined
    const copies = selectedItems.map((i) => ({
      ...i,
      ref: `interior/${randomId()}`,
      locked: false,
      groupRef,
      position: { x: i.position.x + 0.3, z: i.position.z + 0.3 },
    }))
    if (copies.length && commit(copies.map(put))) setSelectedRefs(copies.map((i) => i.ref))
  }
  const group = () => {
    const grouped =
      selectedItems.length > 0 && selectedItems.every((i) => i.groupRef && i.groupRef === selectedItems[0].groupRef)
    const groupRef = grouped ? undefined : `group/${randomId()}`
    commit(selectedItems.map((i) => put({ ...i, groupRef })))
  }
  const choose = (id: string, generic: boolean) => {
    const slab = building.slabs.find((s) => s.ref === storey.baseSlabRef)!
    const position = polygonCentroid(slab.footprint)
    const product = interiorCatalog.find((p) => p.id === id)
    const value: InteriorItem =
      generic && product
        ? {
            ref: `interior/${randomId()}`,
            catalogId: product.id,
            storeyRef: storey.ref,
            name: product.name,
            position,
            widthM: product.size[0],
            depthM: product.size[1],
            heightM: product.size[2],
            rotationDegrees: 0,
            color: product.color,
          }
        : createIkeaItem(id, storey.ref, position)
    if (replacing) {
      const original = items.find((i) => i.ref === replacing)
      if (
        original &&
        commit(
          put({
            ...value,
            ref: original.ref,
            position: original.position,
            rotationDegrees: original.rotationDegrees,
            elevationM: value.elevationM ?? 0,
            groupRef: original.groupRef,
          }),
        )
      ) {
        setReplacing(null)
        setPanel(compact ? null : 'edit')
      }
      return
    }
    setGhost(value)
    setSelectedRefs([])
    setMode('select')
    setPanel(null)
    setNotice(null)
  }
  const place = (point: Vec2) => {
    if (!ghost) return
    const value = { ...ghost, position: snapFurniture({ ...ghost, position: point }, building, storey, snap) }
    if (commit(put(value))) {
      setGhost(null)
      setSelectedRefs([value.ref])
    }
  }
  const pick = (point: Vec2) => {
    if (mode === 'measure') {
      setPoints((previous) => (previous.length === 1 ? [...previous, point] : [point]))
      return
    }
    if (mode === 'partition') {
      if (!room) return
      if (!points.length) setPoints([point])
      else if (
        commit({
          ...base,
          action: 'split',
          spaceRef: room.ref,
          start: points[0],
          end: point,
          partitionRef: `wall/${randomId()}`,
          newSpaceRef: `space/${randomId()}`,
          name: `${room.name} 2`,
          thicknessM: 0.12,
        })
      )
        clearTool()
      return
    }
    if (ghost) place(point)
    else select(null)
  }
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (
        event.target instanceof HTMLElement &&
        (event.target.matches('input,textarea,select') || event.target.isContentEditable)
      )
        return
      if (event.key === 'Escape') {
        clearTool()
        setPanel(null)
        setSelectedRefs([])
      }
      if ((event.ctrlKey || event.metaKey) && ['z', 'y'].includes(event.key.toLowerCase())) {
        event.preventDefault()
        const state = useStudioStore.getState()
        if ((event.shiftKey || event.key === 'y') && state.future.length) state.redo()
        else if (event.key === 'z' && state.history.length) state.undo()
        return
      }
      if (event.key.toLowerCase() === 'r' && !event.ctrlKey && !event.metaKey) rotate()
      if (['Delete', 'Backspace'].includes(event.key) && item) {
        event.preventDefault()
        remove()
      }
      if (item && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
        event.preventDefault()
        const step = event.shiftKey ? 0.5 : snap.gridM
        move({
          ...item,
          position: {
            x: item.position.x + (event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0),
            z: item.position.z + (event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0),
          },
        })
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  })
  if (!building || !storey)
    return (
      <main className="interior-editor">
        <button onClick={onBack}>Back to plot</button>
        <p>Add a house on the plot to edit its interior.</p>
      </main>
    )
  const rooms = building.spaces.filter((r) => storey.spaceRefs.includes(r.ref))
  const warnings = item ? placementWarnings(item, building, storey) : []
  const context = { building, storey, commit }
  const openPanel = (value: Panel) => {
    setPanel(panel === value ? null : value)
    setExpanded(false)
    if (value !== 'catalog') setReplacing(null)
  }
  const duplicateProject = async () => {
    try {
      const state = useStudioStore.getState()
      await saveWorkspace({
        version: 1,
        project: state.project,
        proposals: state.proposals,
        draftChangeSets: state.draftChangeSets,
      })
      const copy = structuredClone(project)
      copy.ref = `project/${randomId()}`
      copy.name = `${project.name} — alternative`
      copy.revision = 1
      copy.updatedAt = new Date().toISOString()
      await saveWorkspace({ version: 1, project: copy, proposals: [], draftChangeSets: [] })
      state.replaceProject(copy)
      tell('Working on a separate project alternative.')
    } catch (error) {
      tell(String(error), true)
    }
  }
  return (
    <PrecisionControls>
      <main
        ref={root}
        className={`interior-editor ${hidden ? 'controls-hidden' : ''}`}
        aria-label="House interior editor"
      >
        <section className={`interior-stage ${ghost ? 'is-placing' : ''}`} aria-label="Interior floor view">
          <Canvas
            shadows
            dpr={[1, compact ? 1.5 : 2]}
            gl={{ antialias: true, preserveDrawingBuffer: true }}
            onCreated={({ gl }) => {
              gl.toneMapping = ACESFilmicToneMapping
              gl.toneMappingExposure = 1
              gl.shadowMap.type = PCFSoftShadowMap
              gl.domElement.setAttribute('aria-label', 'Interactive interior floor')
              gl.domElement.setAttribute('role', 'application')
              gl.domElement.tabIndex = 0
            }}
          >
            <Suspense fallback={null}>
              <InteriorScene
                projectRef={project.ref}
                key={`${building.ref}/${storey.ref}`}
                {...context}
                building={preview?.buildings.find((b) => b.ref === building.ref) ?? building}
                view={view}
                plan={view === 'plan'}
                reset={reset}
                selected={selected}
                selectedRefs={selectedRefs}
                mode={mode}
                placing={!!ghost}
                ghost={ghost}
                mobile={compact}
                snap={snap.enabled}
                snapSettings={snap}
                labels={labels}
                dimensions={dimensions}
                points={points}
                onPointsChange={setPoints}
                onPick={pick}
                onSelect={select}
                project={project}
                onCommit={commit}
                onNotice={tell}
                interactionDisabled={!!confirmationRef}
                selectOnly={multi}
                onHover={(point) => {
                  if (ghost && !compact)
                    setGhost({
                      ...ghost,
                      position: snapFurniture({ ...ghost, position: point }, building, storey, snap),
                    })
                }}
                focusFootprint={fitRoom && room ? spaceFootprint(building, room) : undefined}
                bottomInset={
                  panel && compact && window.innerHeight > window.innerWidth
                    ? window.innerHeight * (expanded ? 0.75 : 0.4)
                    : 0
                }
                rightInset={
                  panel && (!compact || window.innerWidth > window.innerHeight)
                    ? Math.min(340, window.innerWidth * 0.44)
                    : 0
                }
              />
            </Suspense>
          </Canvas>
        </section>
        {hidden ? (
          <button className="interior-restore" onClick={() => setHidden(false)}>
            <Eye size={18} /> Show controls
          </button>
        ) : (
          <>
            <header className="interior-header">
              <button aria-label="Back to plot" onClick={onBack}>
                <ArrowLeft size={19} />
                <span className="desktop-label">Plot</span>
              </button>
              <div className="interior-title">
                <strong>House interior</strong>
                <small>{storey.name}</small>
              </div>
              <div className="interior-segment" aria-label="Interior view mode">
                {(['plan', 'cutaway', 'room'] as const).map((value) => (
                  <button
                    key={value}
                    aria-label={
                      value === 'plan' ? '2D Plan' : value === 'cutaway' ? '3D Interior' : 'Perspective room view'
                    }
                    aria-pressed={view === value}
                    onClick={() => {
                      setView(value)
                      setLabels(value === 'plan')
                    }}
                  >
                    {value === 'plan' ? '2D' : value === 'cutaway' ? '3D' : <Box size={18} />}
                  </button>
                ))}
              </div>
              <button
                aria-label="Fit floor in view"
                onClick={() => {
                  setFitRoom(false)
                  setReset((r) => r + 1)
                }}
              >
                <Focus size={19} />
              </button>
              <button
                className="desktop-only"
                aria-label="Undo"
                disabled={!history.length}
                onClick={() => useStudioStore.getState().undo()}
              >
                <Undo2 size={18} />
              </button>
              <button
                className="desktop-only"
                aria-label="Redo"
                disabled={!future.length}
                onClick={() => useStudioStore.getState().redo()}
              >
                <Redo2 size={18} />
              </button>
            </header>
            <nav className="interior-action-bar" aria-label="Interior actions">
              {ghost ? (
                <>
                  <button onClick={rotate}>
                    <RotateCw size={19} />
                    Rotate
                  </button>
                  <button className="interior-primary" onClick={() => place(ghost.position)}>
                    <Check size={19} />
                    Place here
                  </button>
                  <button onClick={clearTool}>
                    <X size={19} />
                    Cancel
                  </button>
                </>
              ) : mode !== 'select' ? (
                <>
                  <button onClick={() => setPoints([])}>
                    <RotateCw size={19} />
                    Restart
                  </button>
                  <span>
                    {mode === 'partition' ? 'Draw partition' : 'Measure'}
                    {points.length === 2 &&
                      ` · ${Math.hypot(points[1].x - points[0].x, points[1].z - points[0].z).toFixed(2)} m`}
                  </span>
                  <button onClick={clearTool}>
                    <Check size={19} />
                    Done
                  </button>
                </>
              ) : item ? (
                <>
                  <button onClick={() => openPanel('edit')}>
                    <Settings2 size={19} />
                    Edit{selectedItems.length > 1 ? ` (${selectedItems.length})` : ''}
                  </button>
                  <button disabled={selectedItems.some((i) => i.locked)} onClick={rotate}>
                    <RotateCw size={19} />
                    Rotate
                  </button>
                  <button onClick={duplicate}>
                    <Copy size={19} />
                    Duplicate
                  </button>
                  <button onClick={() => openPanel('more')}>
                    <MoreHorizontal size={19} />
                    More
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => {
                      clearTool()
                      openPanel('catalog')
                    }}
                  >
                    <Plus size={20} />
                    Add
                  </button>
                  <button onClick={() => openPanel('edit')}>
                    <Settings2 size={19} />
                    Edit
                  </button>
                  <button
                    onClick={() => {
                      clearTool()
                      setSelectedRefs([])
                      setMode('measure')
                      setPanel(null)
                    }}
                  >
                    <Ruler size={19} />
                    Measure
                  </button>
                  <button onClick={() => openPanel('more')}>
                    <MoreHorizontal size={19} />
                    More
                  </button>
                </>
              )}
            </nav>
            {(ghost || mode !== 'select') && (
              <div className="interior-tool-prompt" role="status">
                {ghost
                  ? `Tap the floor to place ${ghost.name}`
                  : mode === 'partition'
                    ? `Tap ${points.length ? 'the opposite' : 'a'} room wall to ${points.length ? 'finish' : 'start'}`
                    : points.length < 2
                      ? 'Tap two points. Drag endpoints to adjust.'
                      : 'Drag either endpoint to adjust.'}
              </div>
            )}
            <AdaptiveSheet
              open={!!panel}
              title={
                panel === 'review'
                  ? 'Review proposed changes'
                  : panel === 'catalog'
                    ? replacing
                      ? 'Replace furniture'
                      : 'Furniture & fittings'
                    : panel === 'edit'
                      ? selectedItems.length > 1
                        ? `${selectedItems.length} selected`
                        : 'Selection & rooms'
                      : 'View & project'
              }
              expanded={expanded}
              onExpanded={setExpanded}
              onClose={() => {
                setPanel(null)
                setReplacing(null)
              }}
            >
              {panel === 'review' && approval}
              {panel === 'catalog' && <FurnitureCatalog onChoose={choose} />}
              {panel === 'edit' && (
                <>
                  <section className="interior-menu" aria-label="Wall groups">
                    <h3>Wall groups{selectedWalls.length ? ` · ${selectedWalls.length} selected` : ''}</h3>
                    <button aria-pressed={multi} onClick={() => setMulti(!multi)}>{multi ? 'Finish selecting walls' : 'Select walls'}</button>
                    {multi && <>
                      <p className="interior-hint">Tap walls in the plan or choose them below. Finish selecting to drag the selection.</p>
                      {floorWalls.filter(w => !isEnvelopeWall(building, storey, w)).map((w, index) => <button key={w.ref} disabled={w.locked} aria-pressed={selectedRefs.includes(w.ref)} onClick={() => select(w.ref)} aria-label={`Select wall ${w.ref}`}>
                        Wall {index + 1} · {Math.hypot(w.end.x-w.start.x, w.end.z-w.start.z).toFixed(2)} m{w.groupRef ? ' · Grouped' : ''}
                      </button>)}
                    </>}
                    {selectedWalls.length > 0 && <>
                      <button disabled={!canGroupWalls && !wallsGrouped} onClick={() => {
                        if (commit({ ...base, action: 'wall-group', wallRefs: selectedWalls.map(w => w.ref), groupRef: wallsGrouped ? null : `wall-group/${randomId()}` })) {
                          setMulti(false)
                          if (compact) setPanel(null)
                        }
                      }}>{wallsGrouped ? 'Ungroup walls' : 'Group walls'}</button>
                      {(wallsGrouped || selectedWalls.length > 1) && <>
                        <p className="interior-hint">Drag any selected wall to move the whole set. Connected corners and openings follow. Or move 10 cm:</p>
                        <div className="interior-actions">{([{ x: -.1, z: 0 }, { x: .1, z: 0 }, { x: 0, z: -.1 }, { x: 0, z: .1 }]).map((delta, index) => <button key={index} aria-label={['Move walls left', 'Move walls right', 'Move walls up', 'Move walls down'][index]} onClick={() => commit({ ...base, action: 'walls-move', wallRefs: selectedWalls.map(w => w.ref), delta })}>{['Left', 'Right', 'Up', 'Down'][index]}</button>)}</div>
                      </>}
                    </>}
                  </section>
                  {item && <ItemInspector item={item} onSave={saveItem} availableHeight={availableInteriorHeight(item, building, storey)} />}
                  {!!warnings.length && (
                    <div className="interior-warnings" aria-label="Placement warnings">
                      <strong>Check this placement</strong>
                      {warnings.map((warning, i) => (
                        <p key={`${warning.ref}/${i}`}>{warning.message}</p>
                      ))}
                    </div>
                  )}
                  {room && (
                    <RoomInspector
                      {...context}
                      room={room}
                      onPartition={() => {
                        setView('plan')
                        setMode('partition')
                        setPoints([])
                        setPanel(null)
                      }}
                    />
                  )}
                  {wall && <WallInspector {...context} wall={wall} onSelect={select} />}
                  {opening && openingWall && <OpeningInspector {...context} opening={opening} wall={openingWall} />}
                  {!item && !room && !wall && !opening && (
                    <p className="interior-note">Select furniture, a wall or a room to edit it.</p>
                  )}
                  <section className="interior-room-list" aria-label="Rooms on this level">
                    <h3>Rooms on this level</h3>
                    {rooms.map((r) => (
                      <button
                        key={r.ref}
                        aria-pressed={selected === r.ref}
                        onClick={() => {
                          clearTool()
                          select(r.ref)
                        }}
                      >
                        {r.name}
                      </button>
                    ))}
                  </section>
                  <section className="interior-room-list" aria-label="Placed objects">
                    <h3>Placed objects · {items.length}</h3>
                    <button aria-pressed={multi} onClick={() => setMulti(!multi)}>
                      <MousePointer2 size={17} /> {multi ? 'Finish selecting' : 'Select multiple objects'}
                    </button>
                    {items.map((i) => (
                      <button key={i.ref} aria-pressed={selectedRefs.includes(i.ref)} onClick={() => select(i.ref)}>
                        {i.name}
                        {i.locked && <LockKeyhole size={15} />}
                      </button>
                    ))}
                  </section>
                </>
              )}
              {panel === 'more' && (
                <>
                  {item && (
                    <section className="interior-menu">
                      <h3>Selection</h3>
                      <button
                        onClick={() => {
                          setReplacing(item.ref)
                          setPanel('catalog')
                        }}
                        disabled={item.locked}
                      >
                        Replace furniture
                      </button>
                      <button
                        onClick={() =>
                          commit({
                            ...base,
                            action: 'lock',
                            itemRefs: selectedItems.map((i) => i.ref),
                            locked: !selectedItems.every((i) => i.locked),
                          })
                        }
                      >
                        {selectedItems.every((i) => i.locked) ? 'Unlock selection' : 'Lock selection'}
                      </button>
                      <button
                        disabled={selectedItems.length < 2 || selectedItems.some((i) => i.locked)}
                        onClick={group}
                      >
                        {selectedItems.every((i) => i.groupRef && i.groupRef === item.groupRef)
                          ? 'Ungroup selection'
                          : 'Group selection'}
                      </button>
                      <button
                        aria-pressed={multi}
                        onClick={() => {
                          setMulti(!multi)
                          setPanel('edit')
                        }}
                      >
                        Select multiple objects
                      </button>
                      <button
                        className="interior-danger"
                        disabled={selectedItems.some((i) => i.locked)}
                        onClick={remove}
                      >
                        <Trash2 size={17} />
                        Delete selection
                      </button>
                      <button
                        onClick={() => {
                          setSelectedRefs([])
                          setPanel(null)
                        }}
                      >
                        Clear selection
                      </button>
                    </section>
                  )}
                  <section className="interior-menu">
                    <h3>View</h3>
                    <label className="interior-field">
                      Building
                      <select
                        aria-label="Interior building"
                        value={building.ref}
                        onChange={(e) => {
                          setBuildingRef(e.target.value)
                          setStoreyRef('')
                        }}
                      >
                        {project.buildings.map((b) => (
                          <option key={b.ref} value={b.ref}>
                            {b.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="interior-field">
                      Floor
                      <select
                        aria-label="Interior floor"
                        value={storey.ref}
                        onChange={(e) => setStoreyRef(e.target.value)}
                      >
                        {building.storeys.map((s) => (
                          <option key={s.ref} value={s.ref}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      onClick={() => {
                        setFitRoom(false)
                        setReset((r) => r + 1)
                      }}
                    >
                      <Focus size={17} />
                      Fit house
                    </button>
                    <button
                      disabled={!room}
                      onClick={() => {
                        setFitRoom(true)
                        setReset((r) => r + 1)
                      }}
                    >
                      Fit selected room
                    </button>
                    <button aria-pressed={labels} onClick={() => setLabels(!labels)}>
                      Room labels
                    </button>
                    <button
                      aria-pressed={dimensions}
                      onClick={() => {
                        setDimensions(!dimensions)
                        setView('plan')
                      }}
                    >
                      Plan dimensions
                    </button>
                    <button
                      onClick={() => {
                        setHidden(true)
                        setPanel(null)
                      }}
                    >
                      <EyeOff size={17} />
                      Hide controls
                    </button>
                  </section>
                  <section className="interior-menu">
                    <h3>Precision</h3>
                    <button aria-pressed={snap.enabled} onClick={() => setSnap({ ...snap, enabled: !snap.enabled })}>
                      Grid snapping {snap.enabled ? 'on' : 'off'}
                    </button>
                    <button
                      aria-pressed={snap.alignment}
                      onClick={() => setSnap({ ...snap, alignment: !snap.alignment })}
                    >
                      Wall & object alignment {snap.alignment ? 'on' : 'off'}
                    </button>
                    <PrecisionField
                      label="Grid step (m)"
                      min={0.01}
                      max={1}
                      value={snap.gridM}
                      onChange={(gridM) => {
                        if (Number.isFinite(gridM)) setSnap({ ...snap, gridM })
                      }}
                    />
                  </section>
                  {!!proposals.length && (
                    <section className="interior-menu">
                      <h3>Proposals</h3>
                      {proposals.map((proposal) => (
                        <button
                          key={proposal.ref}
                          disabled={proposal.status !== 'pending'}
                          onClick={() => {
                            useStudioStore.getState().reopenProposal(proposal.ref)
                            setPanel('review')
                          }}
                        >
                          {proposal.label} · {proposal.status}
                        </button>
                      ))}
                    </section>
                  )}
                  <section className="interior-menu">
                    <h3>Project · {project.name}</h3>
                    <div className="interior-button-row">
                      <button disabled={!history.length} onClick={() => useStudioStore.getState().undo()}>
                        <Undo2 size={17} />
                        Undo
                      </button>
                      <button disabled={!future.length} onClick={() => useStudioStore.getState().redo()}>
                        <Redo2 size={17} />
                        Redo
                      </button>
                    </div>
                    <button onClick={duplicateProject}>
                      <Copy size={17} />
                      Duplicate project for an alternative
                    </button>
                    <button
                      onClick={() =>
                        downloadInteriorFile('house-project.json', JSON.stringify(project, null, 2), 'application/json')
                      }
                    >
                      Export project JSON
                    </button>
                    <button onClick={() => importInput.current?.click()}>Import project JSON</button>
                    <button
                      onClick={() => {
                        const canvas = root.current?.querySelector('canvas')
                        canvas?.toBlob((blob) => {
                          if (blob) downloadInteriorFile('interior-scene.png', blob, 'image/png')
                        })
                      }}
                    >
                      Export scene PNG
                    </button>
                    <button
                      onClick={() => {
                        try {
                          printInteriorPlan(project, building, storey)
                        } catch (error) {
                          tell(String(error), true)
                        }
                      }}
                    >
                      Print dimensioned plan / PDF
                    </button>
                    <button
                      onClick={() =>
                        downloadInteriorFile('furniture-list.csv', furnitureCsv(project), 'text/csv;charset=utf-8')
                      }
                    >
                      Export furniture list
                    </button>
                  </section>
                  <details className="interior-reference-notes">
                    <summary>Furniture list · {furnitureList(project).length} configurations</summary>
                    {furnitureList(project).map((r, i) => (
                      <p key={i}>
                        {r.quantity} ×{' '}
                        {r.url ? (
                          <a href={r.url} target="_blank" rel="noreferrer">
                            {r.name}
                          </a>
                        ) : (
                          r.name
                        )}
                        <small> · {r.size} cm</small>
                      </p>
                    ))}
                  </details>
                  {(building.interiorSource || project.site.knowledgeBase.datasetVersion === 'reference-house-v1') && (
                    <details className="interior-reference-notes">
                      <summary>Plan dimensions & source notes</summary>
                      {(building.interiorSource?.notes ?? project.site.knowledgeBase.caveats).map((note, i) => (
                        <p key={i}>{note}</p>
                      ))}
                    </details>
                  )}
                  {!building.interiorSource &&
                    (isZielonkiProject(project) ||
                      project.site.knowledgeBase.datasetVersion === 'reference-house-v1') && (
                      <button
                        disabled={fitting}
                        onClick={async () => {
                          setFitting(true)
                          try {
                            await useStudioStore.getState().fitReferenceToZielonki()
                            setSelectedRefs([])
                            setReset((r) => r + 1)
                            tell('Reference interior fitted to Zielonki.')
                          } catch (error) {
                            tell(String(error), true)
                          } finally {
                            setFitting(false)
                          }
                        }}
                      >
                        {fitting ? 'Fitting Zielonki…' : 'Fit reference interior to Zielonki'}
                      </button>
                    )}
                </>
              )}
            </AdaptiveSheet>
          </>
        )}
        {notice && (
          <div className={`interior-toast ${notice.error ? 'has-error' : ''}`} role={notice.error ? 'alert' : 'status'}>
            <span>{notice.text}</span>
            <button aria-label="Dismiss message" onClick={() => setNotice(null)}>
              <X size={16} />
            </button>
          </div>
        )}
        <input
          hidden
          type="file"
          accept=".json,application/json"
          ref={importInput}
          aria-label="Import interior project file"
          onChange={async (e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (!file) return
            try {
              const imported = parseProject(JSON.parse(await file.text()))
              const error = validateProject(imported).find((i) => i.severity === 'error')
              if (error) throw new Error(error.message)
              imported.ref = `project/${randomId()}`
              imported.name += ' — imported'
              const state = useStudioStore.getState()
              await saveWorkspace({
                version: 1,
                project: state.project,
                proposals: state.proposals,
                draftChangeSets: state.draftChangeSets,
              })
              state.replaceProject(imported)
              tell('Imported as a separate project.')
            } catch (error) {
              tell(String(error), true)
            }
          }}
        />
      </main>
    </PrecisionControls>
  )
}
