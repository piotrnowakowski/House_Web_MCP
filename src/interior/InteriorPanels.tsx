import { createContext, useContext, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Heart, Pencil, SlidersHorizontal, X } from 'lucide-react'
import { interiorCatalog, interiorOriginalSize } from '../domain/interior'
import { ikeaCatalog, ikeaProduct } from '../domain/ikeaCatalog'
import { finishFromPreset, interiorFinishes } from '../domain/interiorFinishes'
import { polygonBounds, spaceFootprint, wallLength } from '../domain/geometry'
import { roomDimensions } from '../domain/roomDimensions'
import { isEnvelopeWall } from '../domain/interiorLayout'
import type {
  BuildingModel,
  InteriorFinish,
  InteriorItem,
  OpeningModel,
  ProjectCommand,
  SpaceModel,
  StoreyModel,
  WallModel,
} from '../domain/types'

const PrecisionContext = createContext<{ active: string | null; setActive: (id: string | null) => void }>({
  active: null,
  setActive: () => {},
})
export function PrecisionControls({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<string | null>(null)
  return <PrecisionContext.Provider value={{ active, setActive }}>{children}</PrecisionContext.Provider>
}

export function PrecisionField({
  label,
  value,
  onChange,
  min = 0,
  max = 50,
  step = 0.01,
  disabled = false,
}: {
  label: string
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  disabled?: boolean
}) {
  const id = useId()
  const { active, setActive } = useContext(PrecisionContext)
  const adjusting = active === id
  const setAdjusting = (value: boolean) => setActive(value ? id : null)
  const stepBy = (direction: number) => onChange(Math.max(min, Math.min(max, +(value + direction * step).toFixed(4))))
  return (
    <div className="precision-field">
      <label className="interior-field">
        <span>{label}</span>
        <span className="precision-entry">
          <input
            aria-label={label}
            type="number"
            value={Number.isNaN(value) ? '' : value}
            min={min}
            max={max}
            step="any"
            disabled={disabled}
            required
            onChange={(e) => onChange(e.target.valueAsNumber)}
          />
          <button
            type="button"
            aria-label={`Adjust ${label}`}
            aria-expanded={adjusting}
            disabled={disabled}
            onClick={() => setAdjusting(!adjusting)}
          >
            <SlidersHorizontal size={16} />
          </button>
        </span>
      </label>
      {adjusting && (
        <div className="precision-strip">
          <button type="button" aria-label={`Decrease ${label}`} onClick={() => stepBy(-1)}>
            −
          </button>
          <input
            aria-label={`${label} slider`}
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => onChange(e.target.valueAsNumber)}
          />
          <button type="button" aria-label={`Increase ${label}`} onClick={() => stepBy(1)}>
            +
          </button>
        </div>
      )}
    </div>
  )
}

const searchText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()

export function FurnitureCatalog({ onChoose }: { onChoose: (id: string, generic: boolean) => void }) {
  const [generic, setGeneric] = useState(false)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All')
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('interior.favorites') ?? '[]')
    } catch {
      return []
    }
  })
  const entries = generic
    ? interiorCatalog.map((p) => ({
        ...p,
        family: '',
        thumbnail: '',
        finish: 'Original catalogue size',
        assemblyNote: '',
      }))
    : ikeaCatalog
  const categories = ['All', 'Favorites', ...new Set(entries.map((p) => p.category))]
  const filtered = entries.filter(
    (p) =>
      (category === 'All' || (category === 'Favorites' ? favorites.includes(p.id) : p.category === category)) &&
      searchText(`${p.family} ${p.name}`).includes(searchText(query)),
  )
  const favorite = (id: string) => {
    const next = favorites.includes(id) ? favorites.filter((v) => v !== id) : [...favorites, id]
    setFavorites(next)
    localStorage.setItem('interior.favorites', JSON.stringify(next))
  }
  return (
    <section className="interior-catalog" aria-label="Furniture catalog">
      <div className="interior-segment">
        <button
          aria-pressed={!generic}
          onClick={() => {
            setGeneric(false)
            setCategory('All')
          }}
        >
          IKEA · 24
        </button>
        <button
          aria-pressed={generic}
          onClick={() => {
            setGeneric(true)
            setCategory('All')
          }}
        >
          Generic fittings
        </button>
      </div>
      <input
        type="search"
        aria-label="Search furniture"
        placeholder="Search furniture…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="interior-categories">
        {categories.map((c) => (
          <button key={c} aria-pressed={c === category} onClick={() => setCategory(c)}>
            {c}
          </button>
        ))}
      </div>
      <div className="interior-catalog-grid">
        {filtered.map((p) => (
          <article key={p.id}>
            <button
              className="catalog-product"
              aria-label={`Place ${p.family ? `${p.family} ` : ''}${p.name}`}
              onClick={() => onChoose(p.id, generic)}
            >
              {p.thumbnail ? (
                <img src={`${import.meta.env.BASE_URL}${p.thumbnail}`} alt="" loading="lazy" />
              ) : (
                <span className="generic-thumbnail" style={{ background: p.color }}>
                  {p.name.slice(0, 1)}
                </span>
              )}
              <strong>{p.family || p.name}</strong>
              {p.family && <span>{p.name}</span>}
              <small>{p.size.map((n) => +(n * 100).toFixed(1)).join(' × ')} cm</small>
              <small>{p.finish}</small>
              {p.assemblyNote && <small className="assembly-note">{p.assemblyNote}</small>}
            </button>
            <button
              className="favorite-button"
              aria-label={`${favorites.includes(p.id) ? 'Unfavorite' : 'Favorite'} ${p.family || p.name}`}
              aria-pressed={favorites.includes(p.id)}
              onClick={() => favorite(p.id)}
            >
              <Heart size={17} fill={favorites.includes(p.id) ? 'currentColor' : 'none'} />
            </button>
          </article>
        ))}
      </div>
      {!filtered.length && <p>No matching furniture.</p>}
      <p className="interior-note">
        Objects start at their original catalogue size. Use the pencil beside Dimensions to enlarge a placed object.
      </p>
    </section>
  )
}

type Commit = (command: ProjectCommand) => boolean
type Context = { building: BuildingModel; storey: StoreyModel; commit: Commit }

const sizeLabel = (size: number[]) => `${size.map((value) => +(value * 100).toFixed(1)).join(' × ')} cm`

export function ItemInspector({ item, onSave }: { item: InteriorItem; onSave: (item: InteriorItem) => boolean }) {
  const [draft, setDraft] = useState(item)
  const [dimensionsOpen, setDimensionsOpen] = useState(false)
  useEffect(() => setDraft(item), [item])
  const product = ikeaProduct(item.productId)
  const originalSize = interiorOriginalSize(item)
  const currentSize = [item.widthM, item.depthM, item.heightM]
  const isOriginal = currentSize.every((value, index) => Math.abs(value - originalSize[index]) < 1e-6)
  return (
    <>
      <form
        className="interior-inspector-form"
        onSubmit={(e) => {
          e.preventDefault()
          onSave(draft)
        }}
      >
        <h3>{item.name}</h3>
        <div className="interior-size-summary">
          <div>
            <span>Dimensions · W × D × H</span>
            <strong>{sizeLabel(currentSize)}</strong>
            <small>{isOriginal ? 'Original catalogue size' : `Catalogue: ${sizeLabel(originalSize)}`}</small>
          </div>
          <button
            type="button"
            title="Edit dimensions"
            aria-label="Edit dimensions"
            disabled={item.locked}
            onClick={() => setDimensionsOpen(true)}
          >
            <Pencil size={16} />
          </button>
        </div>
        {product && (
          <>
            <a href={product.productUrl} target="_blank" rel="noreferrer">
              IKEA Poland · {product.articleNumber}
            </a>
            <p className="interior-note">
              {product.finish} · {product.assemblyNote || 'Assembled dimensions'}
              {product.availabilityNote && ` · ${product.availabilityNote}`}
            </p>
          </>
        )}
        <label className="interior-field">
          <span>Object name</span>
          <input
            value={draft.name}
            maxLength={100}
            required
            disabled={item.locked}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
        </label>
        <fieldset disabled={item.locked} className="interior-fields">
          <PrecisionField
            label="Position X (m)"
            min={-100}
            max={100}
            value={draft.position.x}
            onChange={(x) => setDraft({ ...draft, position: { ...draft.position, x } })}
          />
          <PrecisionField
            label="Position Z (m)"
            min={-100}
            max={100}
            value={draft.position.z}
            onChange={(z) => setDraft({ ...draft, position: { ...draft.position, z } })}
          />
          <PrecisionField
            label="Rotation (°)"
            min={-360}
            max={360}
            step={1}
            value={draft.rotationDegrees}
            onChange={(rotationDegrees) => setDraft({ ...draft, rotationDegrees })}
          />
          <PrecisionField
            label="Elevation (m)"
            max={8}
            value={draft.elevationM ?? 0}
            onChange={(elevationM) => setDraft({ ...draft, elevationM })}
          />
          {!product && (
            <label className="interior-field">
              Finish color
              <input type="color" value={draft.color} onChange={(e) => setDraft({ ...draft, color: e.target.value })} />
            </label>
          )}
        </fieldset>
        <button className="interior-primary" disabled={item.locked}>
          Apply changes
        </button>
        <p className="interior-note">
          {item.locked
            ? 'Unlock to edit this object.'
            : 'Tap to select, then drag to move. R rotates; arrow keys move; Shift selects more.'}
        </p>
      </form>
      {dimensionsOpen && (
        <ItemDimensionsDialog key={item.ref} item={item} onSave={onSave} onClose={() => setDimensionsOpen(false)} />
      )}
    </>
  )
}

function ItemDimensionsDialog({
  item,
  onSave,
  onClose,
}: {
  item: InteriorItem
  onSave: (item: InteriorItem) => boolean
  onClose: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const heading = useId()
  const description = useId()
  const original = interiorOriginalSize(item)
  const [size, setSize] = useState(() =>
    [item.widthM, item.depthM, item.heightM].map((value, index) => Math.max(value, original[index])),
  )
  const [error, setError] = useState('')
  useEffect(() => {
    const element = dialog.current!
    const opener = document.activeElement as HTMLElement | null
    const viewport = window.visualViewport
    const update = () => {
      element.style.setProperty('--dialog-height', `${viewport?.height ?? window.innerHeight}px`)
      element.style.setProperty('--dialog-top', `${viewport?.offsetTop ?? 0}px`)
    }
    update()
    element.showModal()
    viewport?.addEventListener('resize', update)
    viewport?.addEventListener('scroll', update)
    return () => {
      viewport?.removeEventListener('resize', update)
      viewport?.removeEventListener('scroll', update)
      element.close()
      opener?.focus({ preventScroll: true })
    }
  }, [])
  return (
    <dialog
      ref={dialog}
      className="interior-dimensions-dialog"
      aria-labelledby={heading}
      aria-describedby={description}
      onKeyDown={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
    >
      <header>
        <h2 id={heading}>Dimensions</h2>
        <button type="button" aria-label="Close dimensions" onClick={onClose}>
          <X size={18} />
        </button>
      </header>
      <form
        className="interior-inspector-form"
        onSubmit={(event) => {
          event.preventDefault()
          if (size[0] === item.widthM && size[1] === item.depthM && size[2] === item.heightM) {
            onClose()
            return
          }
          if (onSave({ ...item, widthM: size[0], depthM: size[1], heightM: size[2] })) onClose()
          else setError('Cannot apply these dimensions. Check available floor space, room height and object locks.')
        }}
      >
        <p className="interior-note" id={description}>
          Original: {sizeLabel(original)}. You can enlarge each dimension; the catalogue size is the minimum.
        </p>
        <fieldset disabled={item.locked} className="dimension-dialog-fields">
          {['Width (m)', 'Depth (m)', 'Height (m)'].map((label, index) => (
            <PrecisionField
              key={label}
              label={label}
              min={original[index]}
              max={index === 2 ? 5 : 20}
              value={size[index]}
              onChange={(value) => {
                setSize(size.map((current, i) => (i === index ? value : current)))
                setError('')
              }}
            />
          ))}
        </fieldset>
        {error && (
          <p className="interior-warnings" role="alert">
            {error}
          </p>
        )}
        <button
          type="button"
          disabled={item.locked}
          onClick={() => {
            setSize([...original])
            setError('')
          }}
        >
          Original size
        </button>
        <div className="interior-button-row">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="interior-primary" disabled={item.locked}>
            Save dimensions
          </button>
        </div>
      </form>
    </dialog>
  )
}

function FinishPicker({
  targetRef,
  surfaces,
  current,
  ...context
}: Context & {
  targetRef: string
  surfaces: ('floor' | 'ceiling' | 'left' | 'right')[]
  current: Partial<Record<'floor' | 'ceiling' | 'left' | 'right', InteriorFinish>>
}) {
  const [surface, setSurface] = useState(surfaces[0])
  const [finish, setFinish] = useState(current[surface] ?? finishFromPreset('warm-white'))
  useEffect(() => setFinish(current[surface] ?? finishFromPreset('warm-white')), [surface, targetRef, current[surface]])
  return (
    <form
      className="interior-inspector-form"
      onSubmit={(e) => {
        e.preventDefault()
        context.commit({
          type: 'interior.update',
          action: 'finish',
          buildingRef: context.building.ref,
          storeyRef: context.storey.ref,
          targetRef,
          surface,
          finish,
        })
      }}
    >
      <h3>Surface finish</h3>
      <label className="interior-field">
        Surface
        <select
          aria-label="Finish surface"
          value={surface}
          onChange={(e) => setSurface(e.target.value as typeof surface)}
        >
          {surfaces.map((s) => (
            <option key={s} value={s}>
              {s === 'left'
                ? 'Left face · looking start → end'
                : s === 'right'
                  ? 'Right face · looking start → end'
                  : s}
            </option>
          ))}
        </select>
      </label>
      <div className="finish-swatches">
        {interiorFinishes.map((preset) => (
          <button
            type="button"
            key={preset.id}
            aria-label={`Finish ${preset.name}`}
            aria-pressed={finish.presetId === preset.id}
            onClick={() => setFinish(finishFromPreset(preset.id))}
          >
            <i style={{ background: preset.color }} />
            {preset.name}
          </button>
        ))}
      </div>
      <div className="interior-fields">
        <PrecisionField
          label="Texture rotation (°)"
          min={0}
          max={360}
          step={1}
          value={finish.rotationDegrees}
          onChange={(rotationDegrees) => setFinish({ ...finish, rotationDegrees })}
        />
        <PrecisionField
          label="Texture repeat (m)"
          min={0.05}
          max={20}
          value={finish.tileM}
          onChange={(tileM) => setFinish({ ...finish, tileM })}
        />
      </div>
      <button className="interior-primary">Apply finish</button>
    </form>
  )
}

export function RoomInspector({
  room,
  onPartition,
  ...context
}: Context & { room: SpaceModel; onPartition: () => void }) {
  const { building, storey, commit } = context
  const bounds = polygonBounds(spaceFootprint(building, room))
  const measured = roomDimensions(building, room)
  const [name, setName] = useState(room.name)
  const [usage, setUsage] = useState(room.usage)
  const [width, setWidth] = useState(measured.width)
  const [depth, setDepth] = useState(measured.depth)
  useEffect(() => {
    setName(room.name)
    setUsage(room.usage)
    setWidth(+measured.width.toFixed(3))
    setDepth(+measured.depth.toFixed(3))
  }, [room, measured.width, measured.depth])
  return (
    <>
      <form
        className="interior-inspector-form"
        onSubmit={(e) => {
          e.preventDefault()
          commit({
            type: 'interior.update',
            action: 'room',
            buildingRef: building.ref,
            storeyRef: storey.ref,
            spaceRef: room.ref,
            name,
            usage,
            ...(Math.abs(width - measured.width) > 0.002
              ? { widthM: width + bounds.maxX - bounds.minX - measured.width }
              : {}),
            ...(Math.abs(depth - measured.depth) > 0.002
              ? { depthM: depth + bounds.maxZ - bounds.minZ - measured.depth }
              : {}),
          })
        }}
      >
        <h3>{room.name}</h3>
        <label className="interior-field">
          Room name
          <input value={name} required maxLength={100} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="interior-field">
          Room usage
          <input value={usage} required maxLength={100} onChange={(e) => setUsage(e.target.value)} />
        </label>
        <div className="interior-fields">
          <PrecisionField label="Room width (m)" min={1} value={width} onChange={setWidth} />
          <PrecisionField label="Room depth (m)" min={1} value={depth} onChange={setDepth} />
        </div>
        <p className="interior-note">
          {measured.area.toFixed(2)} m² · Inside wall dimensions. Resizing moves internal walls and adjoining rooms; the
          exterior envelope stays fixed.
        </p>
        <button className="interior-primary" disabled={room.locked}>
          Save room
        </button>
        <button type="button" disabled={room.locked} onClick={onPartition}>
          Draw partition in this room
        </button>
      </form>
      <FinishPicker
        {...context}
        targetRef={room.ref}
        surfaces={['floor', 'ceiling']}
        current={{ floor: room.floorFinish, ceiling: room.ceilingFinish }}
      />
    </>
  )
}

export function OpeningInspector({ wall, opening, ...context }: Context & { wall: WallModel; opening: OpeningModel }) {
  const [draft, setDraft] = useState(opening)
  useEffect(() => setDraft(opening), [opening])
  const command = {
    type: 'interior.update' as const,
    buildingRef: context.building.ref,
    storeyRef: context.storey.ref,
    wallRef: wall.ref,
  }
  return (
    <form
      className="interior-inspector-form"
      onSubmit={(e) => {
        e.preventDefault()
        context.commit({ ...command, action: 'opening', opening: draft })
      }}
    >
      <h3>{opening.kind === 'door' ? 'Door' : 'Window'}</h3>
      <div className="interior-fields">
        <PrecisionField
          label="Distance from wall start (m)"
          value={draft.offsetM}
          max={wallLength(wall)}
          onChange={(offsetM) => setDraft({ ...draft, offsetM })}
        />
        <PrecisionField
          label="Opening width (m)"
          min={0.2}
          max={wallLength(wall)}
          value={draft.widthM}
          onChange={(widthM) => setDraft({ ...draft, widthM })}
        />
        <PrecisionField
          label="Opening height (m)"
          min={0.2}
          max={wall.heightM}
          value={draft.heightM}
          onChange={(heightM) => setDraft({ ...draft, heightM })}
        />
        <PrecisionField
          label="Sill height (m)"
          max={wall.heightM}
          value={draft.sillM}
          onChange={(sillM) => setDraft({ ...draft, sillM })}
        />
      </div>
      {opening.kind === 'door' && (
        <div className="interior-fields">
          <label className="interior-field">
            Hinge
            <select
              aria-label="Door hinge"
              value={draft.hinge ?? 'left'}
              onChange={(e) => setDraft({ ...draft, hinge: e.target.value as 'left' | 'right' })}
            >
              <option>left</option>
              <option>right</option>
            </select>
          </label>
          <label className="interior-field">
            Swing
            <select
              aria-label="Door swing"
              value={draft.swing ?? 'in'}
              onChange={(e) => setDraft({ ...draft, swing: e.target.value as 'in' | 'out' })}
            >
              <option>in</option>
              <option>out</option>
            </select>
          </label>
        </div>
      )}
      <button className="interior-primary" disabled={wall.locked}>
        Save opening
      </button>
      <button
        type="button"
        className="interior-danger"
        disabled={wall.locked}
        onClick={() => context.commit({ ...command, action: 'opening-remove', openingRef: opening.ref })}
      >
        Remove opening
      </button>
    </form>
  )
}

export function WallInspector({
  wall,
  onSelect,
  ...context
}: Context & { wall: WallModel; onSelect: (ref: string) => void }) {
  const [draft, setDraft] = useState(wall)
  useEffect(() => setDraft(wall), [wall])
  const exterior = isEnvelopeWall(context.building, context.storey, wall)
  const command = {
    type: 'interior.update' as const,
    buildingRef: context.building.ref,
    storeyRef: context.storey.ref,
    wallRef: wall.ref,
  }
  const addOpening = (kind: 'door' | 'window') => {
    const opening: OpeningModel = {
      ref: `opening/${crypto.randomUUID()}`,
      wallRef: wall.ref,
      kind,
      offsetM: wallLength(wall) / 2,
      widthM: kind === 'door' ? 0.9 : 1.2,
      heightM: kind === 'door' ? 2.05 : 1.2,
      sillM: kind === 'door' ? 0 : 0.9,
      hinge: 'left',
      swing: 'in',
    }
    if (context.commit({ ...command, action: 'opening', opening })) onSelect(opening.ref)
  }
  return (
    <>
      <form
        className="interior-inspector-form"
        onSubmit={(e) => {
          e.preventDefault()
          context.commit({
            ...command,
            action: 'wall',
            start: draft.start,
            end: draft.end,
            thicknessM: draft.thicknessM,
            heightM: draft.heightM,
          })
        }}
      >
        <h3>{exterior ? 'Exterior wall' : 'Partition wall'}</h3>
        <p className="interior-note">
          {wallLength(wall).toFixed(2)} m ·{' '}
          {exterior
            ? 'Use plot tools to change the building envelope.'
            : 'Shared endpoints and hosted openings move together.'}
        </p>
        <fieldset disabled={exterior || wall.locked} className="interior-fields">
          {(['start', 'end'] as const).flatMap((end) =>
            (['x', 'z'] as const).map((axis) => (
              <PrecisionField
                key={`${end}-${axis}`}
                label={`${end === 'start' ? 'Start' : 'End'} ${axis.toUpperCase()} (m)`}
                min={-100}
                max={100}
                value={draft[end][axis]}
                onChange={(value) => setDraft({ ...draft, [end]: { ...draft[end], [axis]: value } })}
              />
            )),
          )}
          <PrecisionField
            label="Wall thickness (m)"
            min={0.06}
            max={0.5}
            value={draft.thicknessM}
            onChange={(thicknessM) => setDraft({ ...draft, thicknessM })}
          />
        </fieldset>
        <button className="interior-primary" disabled={exterior || wall.locked}>
          Move connected wall
        </button>
        <button
          type="button"
          className="interior-danger"
          disabled={exterior || wall.locked}
          onClick={() => context.commit({ ...command, action: 'merge' })}
        >
          Remove partition & merge rooms
        </button>
      </form>
      <div className="interior-button-row">
        <button disabled={wall.locked} onClick={() => addOpening('door')}>
          Add door
        </button>
        <button disabled={wall.locked} onClick={() => addOpening('window')}>
          Add window
        </button>
      </div>
      {wall.openings.map((opening) => (
        <button className="interior-list-item" key={opening.ref} onClick={() => onSelect(opening.ref)}>
          {opening.kind} · {opening.widthM.toFixed(2)} × {opening.heightM.toFixed(2)} m
        </button>
      ))}
      <FinishPicker {...context} targetRef={wall.ref} surfaces={['left', 'right']} current={wall.faceFinishes ?? {}} />
    </>
  )
}
