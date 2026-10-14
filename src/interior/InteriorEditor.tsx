import { RendererLifecycle, ViewportBoundary } from '../scene/ViewportBoundary'
import { useRenderQuality } from '../scene/renderingPreferences'
import { RenderingControls } from '../scene/RenderingControls'
import { isEnvelopeWall } from '../domain/interiorLayout'
import { randomId } from '../domain/randomId'
import { Canvas } from '@react-three/fiber'
import { Suspense, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
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
  Move,
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
import { polygonBounds, polygonCentroid, spaceFootprint } from '../domain/geometry'
import { interiorCatalog, interiorCorners, availableInteriorHeight } from '../domain/interior'
import { createIkeaItem, ikeaProduct } from '../domain/ikeaCatalog'
import { placementWarnings, snapFurniture, type SnapSettings } from '../domain/interiorPlacement'
import { parseProject } from '../domain/schema'
import { validateProject } from '../domain/commands'
import { isZielonkiProject } from '../domain/terrain'
import type { InteriorItem, ProjectCommand, Vec2, WallModel } from '../domain/types'
import { useStudioStore } from '../state/store'
import { saveWorkspace } from '../services/persistence'
import { flushAutosave } from '../services/autosave'
import { runWorkspaceActivity } from '../services/workspaceLock'
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
import { stableJson } from '../domain/workspaceSync'
import { interiorMessage, interiorText } from './interiorLocale'

type Panel = 'catalog' | 'wall' | 'edit' | 'more' | 'review' | null

export function InteriorEditor({ onBack, approval, initialStoreyRef }: { onBack: () => void; approval: ReactNode; initialStoreyRef?: string }) {
  const quality = useRenderQuality()
  const captureScene = useRef<(() => Promise<Blob | null>) | null>(null)
  const project = useStudioStore((s) => s.project)
  const toast = useStudioStore((s) => s.toast)
  const history = useStudioStore((s) => s.history)
  const future = useStudioStore((s) => s.future)
  const confirmationRef = useStudioStore((s) => s.confirmationVariantRef)
  const variants = useStudioStore((s) => s.variants)
  const proposals = useStudioStore((s) => s.proposals)
  const preview = variants.find((v) => v.ref === confirmationRef)?.project
  const compact = useCompactLayout()
  const formId = useId()
  const [wallPreview, setWallPreview] = useState<WallModel | null>(null)
  const [sheetInsets, setSheetInsets] = useState({ bottom: 0, right: 0 })
  const root = useRef<HTMLElement>(null)
  const importInput = useRef<HTMLInputElement>(null)
  const [buildingRef, setBuildingRef] = useState(project.buildings.find((b) => b.kind === 'house')?.ref)
  const building = project.buildings.find((b) => b.ref === buildingRef) ?? project.buildings[0]
  const [storeyRef, setStoreyRef] = useState(initialStoreyRef ?? building?.storeys[0]?.ref)
  const storey = building?.storeys.find((s) => s.ref === storeyRef) ?? building?.storeys[0]
  const [view, setView] = useState<InteriorView>('cutaway')
  const [reset, setReset] = useState(0)
  const [fitRoom, setFitRoom] = useState(false)
  const [panel, setPanel] = useState<Panel>(null)
  const [expanded, setExpanded] = useState(false)
  const [hidden, setHidden] = useState(false)
  const [selectedRefs, setSelectedRefs] = useState<string[]>([])
  const [multi, setMulti] = useState(false)
  const [moveMode, setMoveMode] = useState(false)
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
  const frameSelection = compact && panel === 'edit' && !multi && !!selected && view !== 'room'
  useLayoutEffect(() => {
    if (!frameSelection) return
    const element = root.current?.querySelector<HTMLElement>('.adaptive-sheet')
    if (!element) return
    const update = () => {
      const rect = element.getBoundingClientRect()
      const next = window.innerHeight > window.innerWidth
        ? { bottom: Math.round(window.innerHeight - rect.top), right: 0 }
        : { bottom: 68, right: Math.round(window.innerWidth - rect.left) }
      setSheetInsets(current => current.bottom === next.bottom && current.right === next.right ? current : next)
    }
    const observer = new ResizeObserver(update)
    observer.observe(element)
    window.addEventListener('resize', update)
    update()
    return () => { observer.disconnect(); window.removeEventListener('resize', update) }
  }, [frameSelection, expanded, selected])
  const movable = !!(item && !selectedItems.some(i => i.locked) || wall && !wall.locked && !isEnvelopeWall(building, storey, wall) || opening && !openingWall?.locked)
  useEffect(() => { setMoveMode(false) }, [selected, view, building?.ref, storey?.ref, confirmationRef])
  useEffect(() => {
    if (confirmationRef) {
      setPanel('review')
      setExpanded(true)
      setHidden(false)
      setGhost(null)
    } else setPanel((value) => (value === 'review' ? null : value))
  }, [confirmationRef])
  const tell = (text: string, error = false) => setNotice({ text: interiorMessage(text), error })
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
      tell("Zastosuj lub odrzuć oczekującą propozycję przed edycją.", true)
      return false
    }
    try {
      useStudioStore.getState().commitCommands(Array.isArray(commands) ? commands : [commands])
      tell("Zapisano w tym projekcie.")
      return true
    } catch (error) {
      tell(error instanceof Error ? error.message : "Nie udało się zastosować zmiany.", true)
      return false
    }
  }
  const base = { type: 'interior.update' as const, buildingRef: building?.ref, storeyRef: storey?.ref }
  const put = (value: InteriorItem): ProjectCommand => ({ ...base, action: 'put', item: value })
  const clearTool = () => {
    setMoveMode(false)
    setGhost(null)
    setReplacing(null)
    setMode('select')
    setPoints([])
    setNotice(null)
  }
  const startPartition = (ref: string) => {
    clearTool()
    setMulti(false)
    setSelectedRefs([ref])
    setView('plan')
    setLabels(true)
    setMode('partition')
    setPanel(null)
  }
  const addWall = () => {
    clearTool()
    if (room && !room.locked) startPartition(room.ref)
    else { setPanel('wall'); setExpanded(false) }
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
            name: interiorText(product.name),
            position,
            widthM: product.size[0],
            depthM: product.size[1],
            heightM: product.size[2],
            rotationDegrees: 0,
            color: product.color,
          }
        : createIkeaItem(id, storey.ref, position)
    const catalogProduct = ikeaProduct(value.productId)
    if (catalogProduct) value.name = `${catalogProduct.family} ${interiorText(catalogProduct.name)}`
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
        if (mode !== 'select' || ghost || confirmationRef) return
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
        <button onClick={onBack}>Wróć do działki</button>
        <p>Dodaj dom na działce, aby edytować wnętrze.</p>
      </main>
    )
  const rooms = building.spaces.filter((r) => storey.spaceRefs.includes(r.ref))
  const warnings = item ? placementWarnings(item, building, storey) : []
  const context = { building, storey, commit }
  const inspector = { ...context, formId, mobile: compact }
  const lastItem = item && history.at(-1)?.buildings.find(b => b.ref === building.ref)?.furniture?.find(i => i.ref === item.ref)
  const canUndoPlacement = !!(item && history.length && stableJson(lastItem) !== stableJson(item))
  const focusPoints = room ? spaceFootprint(building, room) : item ? interiorCorners(item) : wall ? [wall.start, wall.end] : openingWall ? [openingWall.start, openingWall.end] : undefined
  const focusBounds = focusPoints && polygonBounds(focusPoints)
  const focus = focusBounds && (() => {
    const cx = (focusBounds.minX + focusBounds.maxX) / 2, cz = (focusBounds.minZ + focusBounds.maxZ) / 2
    const dx = Math.max(1.2, (focusBounds.maxX - focusBounds.minX) / 2 + .3)
    const dz = Math.max(1.2, (focusBounds.maxZ - focusBounds.minZ) / 2 + .3)
    return [{ x: cx-dx, z: cz-dz }, { x: cx+dx, z: cz-dz }, { x: cx+dx, z: cz+dz }, { x: cx-dx, z: cz+dz }]
  })()
  const saveLabel = item ? 'Zastosuj zmiany' : room ? 'Zapisz pomieszczenie' : wall ? 'Zapisz zmianę ściany' : 'Zapisz otwór'
  const saveDisabled = !!(confirmationRef || item?.locked || room?.locked || wall && (wall.locked || isEnvelopeWall(building, storey, wall)) || openingWall?.locked)
  const openPanel = (value: Panel) => {
    setMoveMode(false)
    setPanel(panel === value ? null : value)
    setExpanded(false)
    if (value !== 'catalog') setReplacing(null)
  }
  const duplicateProject = async () => {
    try {
      await runWorkspaceActivity(async () => {
      await flushAutosave()
      const state = useStudioStore.getState()
      await saveWorkspace({
        version: 1,
        project: state.project,
        proposals: state.proposals,
        draftChangeSets: state.draftChangeSets,
      })
      const copy = structuredClone(project)
      copy.ref = `project/${randomId()}`
      copy.name = `${project.name} — kopia`
      copy.revision = 1
      copy.updatedAt = new Date().toISOString()
      await saveWorkspace({ version: 1, project: copy, proposals: [], draftChangeSets: [] })
      state.replaceProject(copy)
      tell("Utworzono osobną kopię. Znajdziesz ją w archiwum projektów.")
      })
    } catch (error) {
      tell(String(error), true)
    }
  }
  return (
    <PrecisionControls>
      <main
        ref={root}
        lang="pl"
        className={`interior-editor ${hidden ? 'controls-hidden' : ''}`}
        aria-label="Edytor wnętrza domu"
      >
        <section className={`interior-stage ${ghost ? 'is-placing' : ''}`} aria-label="Widok kondygnacji">
          <ViewportBoundary><Canvas
            frameloop="demand"
            shadows={quality !== 'fast'}
            dpr={quality === 'detailed' ? [1, compact ? 1.5 : 2] : 1}
            gl={{ antialias: true, preserveDrawingBuffer: false }}
            onCreated={({ gl, get }) => {
              captureScene.current = () => {
                const state = get()
                if (state.gl.getContext().isContextLost()) return Promise.resolve(null)
                state.gl.render(state.scene, state.camera)
                return new Promise(resolve => state.gl.domElement.toBlob(resolve, 'image/png'))
              }
              gl.toneMapping = ACESFilmicToneMapping
              gl.toneMappingExposure = 1
              gl.shadowMap.type = PCFSoftShadowMap
              gl.domElement.setAttribute('aria-label', "Interaktywny rzut wnętrza")
              gl.domElement.setAttribute('role', 'application')
              gl.domElement.tabIndex = 0
            }}
          >
            <RendererLifecycle /><Suspense fallback={null}>
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
                onCommit={(commands) => {
                  const saved = commit(commands)
                  if (saved) setMoveMode(false)
                  return saved
                }}
                onNotice={tell}
                interactionDisabled={!!confirmationRef}
                selectOnly={multi}
                touchMoveEnabled={!compact || moveMode}
                onHover={(point) => {
                  if (ghost && !compact)
                    setGhost({
                      ...ghost,
                      position: snapFurniture({ ...ghost, position: point }, building, storey, snap),
                    })
                }}
                focusFootprint={frameSelection ? focus : fitRoom && room ? spaceFootprint(building, room) : undefined}
                framingKey={frameSelection ? selected : undefined}
                topInset={frameSelection ? 116 : 0}
                wallPreview={panel === 'edit' && wallPreview?.ref === selected ? wallPreview : undefined}
                bottomInset={
                  frameSelection ? sheetInsets.bottom : panel && compact && window.innerHeight > window.innerWidth
                    ? window.innerHeight * (expanded ? 0.75 : 0.4)
                    : 0
                }
                rightInset={
                  frameSelection ? sheetInsets.right : panel && (!compact || window.innerWidth > window.innerHeight)
                    ? Math.min(340, window.innerWidth * 0.44)
                    : 0
                }
              />
            </Suspense>
          </Canvas></ViewportBoundary>
        </section>
        {hidden ? (
          <button className="interior-restore" onClick={() => setHidden(false)}>
            <Eye size={18} /> Pokaż narzędzia
          </button>
        ) : (
          <>
            <header className="interior-header">
              <button aria-label="Wróć do działki" onClick={onBack}>
                <ArrowLeft size={19} />
                <span className="desktop-label">Działka</span>
              </button>
              <div className="interior-title">
                <strong>Wnętrze domu</strong>
                <small>{storey.name}</small>
              </div>
              <div className="interior-segment" aria-label="Tryb widoku wnętrza">
                {(['plan', 'cutaway', 'room'] as const).map((value) => (
                  <button
                    key={value}
                    aria-label={
                      value === 'plan' ? "Rzut 2D" : value === 'cutaway' ? "Wnętrze 3D" : "Widok z pomieszczenia"
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
                aria-label="Dopasuj widok kondygnacji"
                onClick={() => {
                  setFitRoom(false)
                  setReset((r) => r + 1)
                }}
              >
                <Focus size={19} />
              </button>
              <button
                className="desktop-only"
                aria-label="Cofnij"
                disabled={!history.length || mode !== 'select' || !!ghost || !!confirmationRef}
                onClick={() => useStudioStore.getState().undo()}
              >
                <Undo2 size={18} />
              </button>
              <button
                className="desktop-only"
                aria-label="Ponów"
                disabled={!future.length || mode !== 'select' || !!ghost || !!confirmationRef}
                onClick={() => useStudioStore.getState().redo()}
              >
                <Redo2 size={18} />
              </button>
            </header>
            <nav className="interior-floor-switcher" aria-label="Kondygnacje domu">
              <span>Kondygnacja</span>
              {building.storeys.map((floor) => (
                <button
                  key={floor.ref}
                  aria-pressed={floor.ref === storey.ref}
                  onClick={() => { clearTool(); setStoreyRef(floor.ref) }}
                >
                  {floor.name}
                </button>
              ))}
            </nav>
            {compact && <nav className="interior-mobile-history" aria-label="Historia zmian">
              <button aria-label="Cofnij" title="Cofnij (Ctrl+Z)" disabled={!history.length || mode !== 'select' || !!ghost || !!confirmationRef} onClick={() => useStudioStore.getState().undo()}><Undo2 size={18} /><span>Cofnij</span></button>
              <button aria-label="Ponów" title="Ponów (Ctrl+Shift+Z)" disabled={!future.length || mode !== 'select' || !!ghost || !!confirmationRef} onClick={() => useStudioStore.getState().redo()}><Redo2 size={18} /></button>
            </nav>}
            <nav className="interior-action-bar" aria-label="Narzędzia wnętrza">
              {ghost ? (
                <>
                  <button onClick={rotate}>
                    <RotateCw size={19} />
                    Obróć
                  </button>
                  <button className="interior-primary" onClick={() => place(ghost.position)}>
                    <Check size={19} />
                    Umieść tutaj
                  </button>
                  <button onClick={clearTool}>
                    <X size={19} />
                    Anuluj
                  </button>
                </>
              ) : moveMode ? (
                <>
                  <span>Przeciągnij zaznaczenie. Puść, aby zapisać.</span>
                  <button onClick={() => setMoveMode(false)}><X size={19} />Anuluj przesuwanie</button>
                </>
              ) : mode !== 'select' ? (
                <>
                  <button onClick={() => setPoints([])}>
                    <RotateCw size={19} />
                    Od początku
                  </button>
                  <span>
                    {mode === 'partition' ? "Rysuj ścianę" : "Zmierz"}
                    {points.length === 2 &&
                      ` · ${Math.hypot(points[1].x - points[0].x, points[1].z - points[0].z).toFixed(2)} m`}
                  </span>
                  <button onClick={clearTool}>
                    {mode === 'partition' ? <X size={19} /> : <Check size={19} />}
                    {mode === 'partition' ? 'Anuluj' : 'Zakończ'}
                  </button>
                </>
              ) : item ? (
                <>
                  {compact && <button disabled={!movable} onClick={() => { setPanel(null); setMoveMode(true) }}><Move size={19} />Przesuń</button>}
                  <button onClick={() => openPanel('edit')}>
                    <Settings2 size={19} />
                    Edytuj{selectedItems.length > 1 ? ` (${selectedItems.length})` : ''}
                  </button>
                  <button disabled={selectedItems.some((i) => i.locked)} onClick={rotate}>
                    <RotateCw size={19} />
                    Obróć
                  </button>
                  <button onClick={duplicate}>
                    <Copy size={19} />
                    Duplikuj
                  </button>
                  <button onClick={() => openPanel('more')}>
                    <MoreHorizontal size={19} />
                    Więcej
                  </button>
                </>
              ) : (
                <>
                  {compact && movable && <button onClick={() => { setPanel(null); setMoveMode(true) }}><Move size={19} />Przesuń</button>}
                  <button
                    onClick={() => {
                      clearTool()
                      openPanel('catalog')
                    }}
                  >
                    <Plus size={20} />
                    Dodaj mebel
                  </button>
                  <button onClick={addWall} disabled={!!confirmationRef}>
                    <Plus size={19} />Dodaj ścianę
                  </button>
                  <button onClick={() => openPanel('edit')}>
                    <Settings2 size={19} />
                    Edytuj
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
                    Zmierz
                  </button>
                  <button onClick={() => openPanel('more')}>
                    <MoreHorizontal size={19} />
                    Więcej
                  </button>
                </>
              )}
            </nav>
            {(ghost || mode !== 'select') && (
              <div className="interior-tool-prompt" role="status">
                {ghost
                  ? `Wskaż podłogę, aby umieścić: ${ghost.name}`
                  : mode === 'partition'
                    ? `${points.length ? '2/2 · Wskaż koniec na drugiej ścianie' : '1/2 · Wskaż początek na ścianie'} · ${room?.name ?? ''}`
                    : points.length < 2
                      ? "Wskaż dwa punkty. Przeciągnij końce, aby poprawić pomiar."
                      : "Przeciągnij dowolny koniec, aby poprawić pomiar."}
              </div>
            )}
            <AdaptiveSheet
              open={!!panel}
              revealKey={panel === 'edit' && !multi ? selected : undefined}
              footer={compact && panel === 'edit' && !multi && (item || room || wall || opening) ? <>
                <button type="reset" form={formId}>Odrzuć zmiany</button>
                <button type="submit" form={formId} className="interior-primary" disabled={saveDisabled}>{saveLabel}</button>
              </> : undefined}
              title={
                panel === 'review'
                  ? "Sprawdź proponowane zmiany"
                  : panel === 'wall'
                    ? 'Dodaj ścianę'
                  : panel === 'catalog'
                    ? replacing
                      ? "Zamień mebel"
                      : "Meble i wyposażenie"
                    : panel === 'edit'
                      ? selectedItems.length > 1
                        ? `Zaznaczono: ${selectedItems.length}`
                        : "Zaznaczenie i pomieszczenia"
                      : "Widok i projekt"
              }
              expanded={expanded}
              onExpanded={setExpanded}
              onClose={() => {
                setPanel(null)
                setReplacing(null)
              }}
            >
              {panel === 'review' && approval}
              {panel === 'wall' && <section className="interior-room-list" aria-label="Wybierz pomieszczenie do podziału">
                <p className="interior-note">Wybierz pomieszczenie. Następnie wskaż na rzucie początek i koniec nowej ściany na dwóch ścianach pomieszczenia.</p>
                {rooms.map(r => <button key={r.ref} disabled={r.locked} onClick={() => startPartition(r.ref)}>{r.name}{r.locked && <LockKeyhole size={15} />}</button>)}
              </section>}
              {panel === 'catalog' && <>
                {!replacing && <button className="interior-add-wall" onClick={addWall}><Plus size={19} />Dodaj ścianę działową</button>}
                <FurnitureCatalog onChoose={choose} />
              </>}
              {panel === 'edit' && (
                <>
                  <div data-selection-inspector tabIndex={-1} role="group" aria-label="Edytuj zaznaczenie">
                  {!!warnings.length && <details className="interior-warnings" aria-label="Uwagi do ustawienia">
                    <summary>Sprawdź ustawienie · {warnings.length}</summary>
                    {warnings.map((warning, i) => <p key={`${warning.ref}/${i}`}>{interiorMessage(warning.message)}</p>)}
                  </details>}
                  {item && <ItemInspector formId={formId} interactionHint={compact ? "Zamknij panel, wybierz Przesuń i przeciągnij zaznaczenie. Obróć zmienia kąt; Cofnij przywraca ostatnią zmianę." : undefined} item={item} onSave={saveItem} availableHeight={availableInteriorHeight(item, building, storey)} />}
                  {room && (
                    <RoomInspector
                      {...inspector}
                      room={room}
                      onPartition={() => startPartition(room.ref)}
                    />
                  )}
                  {wall && <WallInspector {...inspector} onPreview={setWallPreview} wall={wall} onSelect={select} />}
                  {opening && openingWall && <OpeningInspector {...inspector} opening={opening} wall={openingWall} />}
                  </div>
                  <section className="interior-menu" aria-label="Grupy ścian">
                    <h3>Grupy ścian{selectedWalls.length ? ` · zaznaczono: ${selectedWalls.length}` : ''}</h3>
                    <button aria-pressed={multi} onClick={() => setMulti(!multi)}>{multi ? "Zakończ wybieranie ścian" : "Wybierz ściany"}</button>
                    {multi && <>
                      <p className="interior-hint">Wskaż ściany na rzucie lub wybierz je poniżej. Zakończ wybieranie, aby przesunąć zaznaczenie.</p>
                      {floorWalls.filter(w => !isEnvelopeWall(building, storey, w)).map((w, index) => <button key={w.ref} disabled={w.locked} aria-pressed={selectedRefs.includes(w.ref)} onClick={() => select(w.ref)} aria-label={`Wybierz ścianę ${w.ref}`}>
                        Ściana {index + 1} · {Math.hypot(w.end.x-w.start.x, w.end.z-w.start.z).toFixed(2)} m{w.groupRef ? " · W grupie" : ''}
                      </button>)}
                    </>}
                    {selectedWalls.length > 0 && <>
                      <button disabled={!canGroupWalls && !wallsGrouped} onClick={() => {
                        if (commit({ ...base, action: 'wall-group', wallRefs: selectedWalls.map(w => w.ref), groupRef: wallsGrouped ? null : `wall-group/${randomId()}` })) {
                          setMulti(false)
                          if (compact) setPanel(null)
                        }
                      }}>{wallsGrouped ? "Rozgrupuj ściany" : "Grupuj ściany"}</button>
                      {(wallsGrouped || selectedWalls.length > 1) && <>
                        <p className="interior-hint">Wybierz Przesuń i przeciągnij zaznaczoną ścianę, aby przesunąć całą grupę wraz z narożnikami i otworami. Lub przesuń o 10 cm:</p>
                        <div className="interior-actions">{([{ x: -.1, z: 0 }, { x: .1, z: 0 }, { x: 0, z: -.1 }, { x: 0, z: .1 }]).map((delta, index) => <button key={index} aria-label={["Przesuń ściany w lewo", "Przesuń ściany w prawo", "Przesuń ściany w górę", "Przesuń ściany w dół"][index]} onClick={() => commit({ ...base, action: 'walls-move', wallRefs: selectedWalls.map(w => w.ref), delta })}>{["W lewo", "W prawo", "W górę", "W dół"][index]}</button>)}</div>
                      </>}
                    </>}
                  </section>
                  {!item && !room && !wall && !opening && (
                    <p className="interior-note">Wybierz mebel, ścianę lub pomieszczenie do edycji.</p>
                  )}
                  <section className="interior-room-list" aria-label="Pomieszczenia na kondygnacji">
                    <h3>Pomieszczenia na kondygnacji</h3>
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
                  <section className="interior-room-list" aria-label="Ustawione obiekty">
                    <h3>Ustawione obiekty · {items.length}</h3>
                    <button aria-pressed={multi} onClick={() => setMulti(!multi)}>
                      <MousePointer2 size={17} /> {multi ? "Zakończ wybieranie" : "Zaznacz kilka obiektów"}
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
                      <h3>Zaznaczenie</h3>
                      <button
                        onClick={() => {
                          setReplacing(item.ref)
                          setPanel('catalog')
                        }}
                        disabled={item.locked}
                      >
                        Zamień mebel
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
                        {selectedItems.every((i) => i.locked) ? "Odblokuj zaznaczenie" : "Zablokuj zaznaczenie"}
                      </button>
                      <button
                        disabled={selectedItems.length < 2 || selectedItems.some((i) => i.locked)}
                        onClick={group}
                      >
                        {selectedItems.every((i) => i.groupRef && i.groupRef === item.groupRef)
                          ? "Rozgrupuj zaznaczenie"
                          : "Grupuj zaznaczenie"}
                      </button>
                      <button
                        aria-pressed={multi}
                        onClick={() => {
                          setMulti(!multi)
                          setPanel('edit')
                        }}
                      >
                        Zaznacz kilka obiektów
                      </button>
                      <button
                        className="interior-danger"
                        disabled={selectedItems.some((i) => i.locked)}
                        onClick={remove}
                      >
                        <Trash2 size={17} />
                        Usuń zaznaczenie
                      </button>
                      <button
                        onClick={() => {
                          setSelectedRefs([])
                          setPanel(null)
                        }}
                      >
                        Wyczyść zaznaczenie
                      </button>
                    </section>
                  )}
                  <section className="interior-menu">
                    <h3>Widok</h3>
                    <label className="interior-field">
                      Budynek
                      <select
                        aria-label="Budynek do edycji"
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
                      Kondygnacja
                      <select
                        aria-label="Kondygnacja do edycji"
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
                      Dopasuj widok domu
                    </button>
                    <button
                      disabled={!room}
                      onClick={() => {
                        setFitRoom(true)
                        setReset((r) => r + 1)
                      }}
                    >
                      Dopasuj widok pomieszczenia
                    </button>
                    <button aria-pressed={labels} onClick={() => setLabels(!labels)}>
                      Nazwy pomieszczeń
                    </button>
                    <button
                      aria-pressed={dimensions}
                      onClick={() => {
                        setDimensions(!dimensions)
                        setView('plan')
                      }}
                    >
                      Wymiary na rzucie
                    </button>
                    <button
                      onClick={() => {
                        setHidden(true)
                        setPanel(null)
                      }}
                    >
                      <EyeOff size={17} />
                      Ukryj narzędzia
                    </button>
                  </section>
                  <section className="interior-menu">
                    <h3>Precyzja</h3>
                    <button aria-pressed={snap.enabled} onClick={() => setSnap({ ...snap, enabled: !snap.enabled })}>
                      Przyciąganie do siatki: {snap.enabled ? 'włączone' : 'wyłączone'}
                    </button>
                    <button
                      aria-pressed={snap.alignment}
                      onClick={() => setSnap({ ...snap, alignment: !snap.alignment })}
                    >
                      Wyrównywanie do ścian i obiektów: {snap.alignment ? 'włączone' : 'wyłączone'}
                    </button>
                    <PrecisionField
                      label="Krok siatki (m)"
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
                      <h3>Propozycje</h3>
                      {proposals.map((proposal) => (
                        <button
                          key={proposal.ref}
                          disabled={proposal.status !== 'pending'}
                          onClick={() => {
                            useStudioStore.getState().reopenProposal(proposal.ref)
                            setPanel('review')
                          }}
                        >
                          {proposal.label} · {interiorText(proposal.status)}
                        </button>
                      ))}
                    </section>
                  )}
                  <section className="interior-menu">
                    <h3>Projekt · {project.name}</h3>
                    <button onClick={duplicateProject}>
                      <Copy size={17} />
                      Utwórz kopię projektu
                    </button>
                    <button
                      onClick={() =>
                        downloadInteriorFile('house-project.json', JSON.stringify(project, null, 2), 'application/json')
                      }
                    >
                      Eksportuj projekt JSON
                    </button>
                    <RenderingControls />
                    <button onClick={() => importInput.current?.click()}>Importuj projekt JSON</button>
                    <button
                      onClick={async () => {
                        try {
                          const blob = await captureScene.current?.()
                          if (!blob) throw new Error("Widok 3D nie jest gotowy. Otwórz go ponownie przed eksportem.")
                          downloadInteriorFile('interior-scene.png', blob, 'image/png')
                        } catch (error) { tell(String(error), true) }
                      }}
                    >
                      Eksportuj widok PNG
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
                      Drukuj rzut z wymiarami / PDF
                    </button>
                    <button
                      onClick={() =>
                        downloadInteriorFile('furniture-list.csv', furnitureCsv(project), 'text/csv;charset=utf-8')
                      }
                    >
                      Eksportuj listę mebli
                    </button>
                  </section>
                  <details className="interior-reference-notes">
                    <summary>Lista mebli · {furnitureList(project).length} konfiguracji</summary>
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
                      <summary>Wymiary i źródła projektu</summary>
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
                            tell("Dopasowano wnętrze wzorcowe do Zielonek.")
                          } catch (error) {
                            tell(String(error), true)
                          } finally {
                            setFitting(false)
                          }
                        }}
                      >
                        {fitting ? "Dopasowywanie…" : "Dopasuj wnętrze wzorcowe do Zielonek"}
                      </button>
                    )}
                </>
              )}
            </AdaptiveSheet>
          </>
        )}
        {!!warnings.length && !panel && !hidden && !moveMode && !ghost && <aside className="interior-placement-warning" aria-label="Ostrzeżenie ustawienia" role="status">
          <strong>{canUndoPlacement ? 'Zapisano z ostrzeżeniem' : 'Sprawdź ustawienie'}</strong>
          <span>{interiorMessage(warnings[0].message)}{warnings.length > 1 ? ` (+${warnings.length - 1})` : ''}</span>
          <div><button onClick={() => { setPanel('edit'); setExpanded(false) }}>Popraw ustawienie</button>
          {canUndoPlacement && <button onClick={() => { useStudioStore.getState().undo(); setNotice(null) }}>Cofnij ruch</button>}</div>
        </aside>}
        {notice && (notice.error || !warnings.length) && (
          <div className={`interior-toast ${notice.error ? 'has-error' : ''}`} role={notice.error ? 'alert' : 'status'}>
            <span>{notice.text}</span>
            <button aria-label="Zamknij komunikat" onClick={() => setNotice(null)}>
              <X size={16} />
            </button>
          </div>
        )}
        <input
          hidden
          type="file"
          accept=".json,application/json"
          ref={importInput}
          aria-label="Importuj plik projektu wnętrza"
          onChange={async (e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (!file) return
            try {
              await runWorkspaceActivity(async () => {
              await flushAutosave()
              const imported = parseProject(JSON.parse(await file.text()))
              const error = validateProject(imported).find((i) => i.severity === 'error')
              if (error) throw new Error(error.message)
              imported.ref = `project/${randomId()}`
              imported.name += " — import"
              const state = useStudioStore.getState()
              await saveWorkspace({
                version: 1,
                project: state.project,
                proposals: state.proposals,
                draftChangeSets: state.draftChangeSets,
              })
              state.replaceProject(imported)
              tell("Zaimportowano jako osobny projekt.")
              })
            } catch (error) {
              tell(String(error), true)
            }
          }}
        />
      </main>
    </PrecisionControls>
  )
}
