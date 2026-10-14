import { interiorText } from './interiorLocale'
import { staticAssetUrl } from '../services/staticAssets'
import { useStudioStore } from '../state/store'
import { stableJson } from '../domain/workspaceSync'
import { randomId } from '../domain/randomId'
import { createContext, useContext, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { Heart, Pencil, SlidersHorizontal, X } from 'lucide-react'
import { interiorCatalog, interiorOriginalSize } from '../domain/interior'
import { ikeaCatalog, ikeaProduct, ikeaHeightVariants, withIkeaHeightVariant } from '../domain/ikeaCatalog'
import { finishFromPreset, interiorFinishes } from '../domain/interiorFinishes'
import { polygonBounds, spaceFootprint, wallLength } from '../domain/geometry'
import { roomDimensions } from '../domain/roomDimensions'
import { isEnvelopeWall } from '../domain/interiorLayout'
import { wallLengthAnchors, wallWithLength } from '../domain/precisionEdits'
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

type ItemDraft = { base: InteriorItem; value: InteriorItem }
const PrecisionContext = createContext<{ active: string | null; setActive: (id: string | null) => void; drafts?: Map<string, ItemDraft> }>({
  active: null,
  setActive: () => {},
})
export function PrecisionControls({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<string | null>(null)
  const drafts = useRef(new Map<string, ItemDraft>())
  return <PrecisionContext.Provider value={{ active, setActive, drafts: drafts.current }}>{children}</PrecisionContext.Provider>
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
            inputMode="decimal"
            value={Number.isNaN(value) ? '' : Number(value.toPrecision(12))}
            min={min}
            max={max}
            step="any"
            disabled={disabled}
            required
            onChange={(e) => onChange(e.target.valueAsNumber)}
          />
          <button
            type="button"
            aria-label={`Dostosuj: ${label}`}
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
          <button type="button" aria-label={`Zmniejsz: ${label}`} onClick={() => stepBy(-1)}>
            −
          </button>
          <input
            aria-label={`Suwak: ${label}`}
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => onChange(e.target.valueAsNumber)}
          />
          <button type="button" aria-label={`Zwiększ: ${label}`} onClick={() => stepBy(1)}>
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
        finish: "Oryginalny rozmiar katalogowy",
        assemblyNote: '',
      }))
    : ikeaCatalog
  const categories = ['All', 'Favorites', ...new Set(entries.map((p) => p.category))]
  const filtered = entries.filter(
    (p) =>
      (category === 'All' || (category === 'Favorites' ? favorites.includes(p.id) : p.category === category)) &&
      searchText(`${p.family} ${p.name} ${interiorText(p.name)}`).includes(searchText(query)),
  )
  const favorite = (id: string) => {
    const next = favorites.includes(id) ? favorites.filter((v) => v !== id) : [...favorites, id]
    setFavorites(next)
    localStorage.setItem('interior.favorites', JSON.stringify(next))
  }
  return (
    <section className="interior-catalog" aria-label="Katalog mebli">
      <div className="interior-segment">
        <button
          aria-pressed={!generic}
          onClick={() => {
            setGeneric(false)
            setCategory('All')
          }}
        >
          IKEA · {ikeaCatalog.length}
        </button>
        <button
          aria-pressed={generic}
          onClick={() => {
            setGeneric(true)
            setCategory('All')
          }}
        >
          Wyposażenie ogólne
        </button>
      </div>
      <input
        type="search"
        aria-label="Szukaj mebli"
        placeholder="Szukaj mebli…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="interior-categories">
        {categories.map((c) => (
          <button key={interiorText(c)} aria-pressed={c === category} onClick={() => setCategory(c)}>
            {interiorText(c)}
          </button>
        ))}
      </div>
      <div className="interior-catalog-grid">
        {filtered.map((p) => (
          <article key={p.id}>
            <button
              className="catalog-product"
              aria-label={`Umieść ${p.family ? `${p.family} ` : ''}${interiorText(p.name)}`}
              onClick={() => onChoose(p.id, generic)}
            >
              {p.thumbnail ? (
                <img src={staticAssetUrl(p.thumbnail)} alt="" loading="lazy" />
              ) : (
                <span className="generic-thumbnail" style={{ background: p.color }}>
                  {p.name.slice(0, 1)}
                </span>
              )}
              <strong>{p.family || interiorText(p.name)}</strong>
              {p.family && <span>{interiorText(p.name)}</span>}
              <small>{p.size.map((n) => +(n * 100).toFixed(1)).join(' × ')} cm</small>
              <small>{interiorText(p.finish)}</small>
              {p.assemblyNote && <small className="assembly-note">{interiorText(p.assemblyNote)}</small>}
            </button>
            <button
              className="favorite-button"
              aria-label={`${favorites.includes(p.id) ? "Usuń z ulubionych" : "Dodaj do ulubionych"} ${p.family || interiorText(p.name)}`}
              aria-pressed={favorites.includes(p.id)}
              onClick={() => favorite(p.id)}
            >
              <Heart size={17} fill={favorites.includes(p.id) ? 'currentColor' : 'none'} />
            </button>
          </article>
        ))}
      </div>
      {!filtered.length && <p>Brak pasujących mebli.</p>}
      <p className="interior-note">
        Obiekty mają początkowo rozmiar katalogowy. Użyj ołówka obok wymiarów, aby powiększyć ustawiony obiekt.
      </p>
    </section>
  )
}

type Commit = (command: ProjectCommand) => boolean
type Context = { building: BuildingModel; storey: StoreyModel; commit: Commit; formId?: string; mobile?: boolean }

const sizeLabel = (size: number[]) => `${size.map((value) => +(value * 100).toFixed(1)).join(' × ')} cm`

export function ItemInspector({ item, onSave, availableHeight, interactionHint, formId }: {
  item: InteriorItem
  onSave: (item: InteriorItem) => boolean
  availableHeight: number
  interactionHint?: string
  formId?: string
}) {
  const projectRef = useStudioStore(state => state.project.ref)
  const { drafts } = useContext(PrecisionContext)
  const draftKey = `${projectRef}/${item.ref}`
  const readDraft = () => {
    const saved = drafts?.get(draftKey)
    return saved && stableJson(saved.base) === stableJson(item) ? saved.value : item
  }
  const [draft, setDraftValue] = useState(readDraft)
  const setDraft = (value: InteriorItem) => {
    drafts?.set(draftKey, { base: item, value })
    setDraftValue(value)
  }
  const [dimensionsOpen, setDimensionsOpen] = useState(false)
  useEffect(() => {
    const saved = drafts?.get(draftKey)
    const value = saved && stableJson(saved.base) === stableJson(item) ? saved.value : item
    if (value === item) drafts?.delete(draftKey)
    setDraftValue(value)
  }, [item, draftKey, drafts])
  const product = ikeaProduct(item.productId)
  const heightVariants = ikeaHeightVariants(item.productId)
  const originalSize = interiorOriginalSize(item)
  const currentSize = [item.widthM, item.depthM, item.heightM]
  const isOriginal = currentSize.every((value, index) => Math.abs(value - originalSize[index]) < 1e-6)
  return (
    <>
      <form
        id={formId}
        onReset={(event) => { event.preventDefault(); drafts?.delete(draftKey); setDraftValue(item) }}
        className="interior-inspector-form"
        onSubmit={(e) => {
          e.preventDefault()
          onSave(draft)
        }}
      >
        <h3>{item.name}</h3>
        {stableJson(draft) !== stableJson(item) && <p role="status" className="interior-note">Niezastosowane zmiany — szkic zostanie zachowany po zamknięciu panelu.<button type="button" onClick={() => { drafts?.delete(draftKey); setDraftValue(item) }}>Odrzuć szkic</button></p>}
        <div className="interior-size-summary">
          <div>
            <span>Wymiary · szer. × gł. × wys.</span>
            <strong>{sizeLabel(currentSize)}</strong>
            <small>{isOriginal ? "Oryginalny rozmiar katalogowy" : `Katalogowo: ${sizeLabel(originalSize)}`}</small>
          </div>
          <button
            type="button"
            title="Edytuj wymiary"
            aria-label="Edytuj wymiary"
            disabled={item.locked}
            onClick={() => setDimensionsOpen(true)}
          >
            <Pencil size={16} />
          </button>
        </div>
        {product && (
          <>
            {heightVariants.length > 1 && (
              <label className="interior-field">
                <span>Wariant wysokości IKEA</span>
                <select
                  aria-label="Wariant wysokości IKEA"
                  value={item.productId}
                  disabled={item.locked}
                  onChange={(event) => {
                    const next = withIkeaHeightVariant(draft, event.target.value)
                    const nextProduct = ikeaProduct(next.productId)!
                    if (draft.name === `${product.family} ${interiorText(product.name)}`)
                      next.name = `${nextProduct.family} ${interiorText(nextProduct.name)}`
                    onSave(next)
                  }}
                >
                  {heightVariants.map((variant) => {
                    const fits = Math.max(variant.size[2], variant.minimumCeilingM ?? 0) + (draft.elevationM ?? 0) <= availableHeight
                    return (
                      <option key={variant.id} value={variant.id} disabled={!fits}>
                        {variant.heightVariant === 'tall' ? "Wysoki" : "Standardowy"} · {+(variant.size[2] * 100).toFixed(1)} cm
                        {!fits ? " · Za wysoki do tego pomieszczenia" : ''}
                      </option>
                    )
                  })}
                </select>
                <small>Odstęp od sufitu: {+((availableHeight - item.heightM - (item.elevationM ?? 0)) * 100).toFixed(1)} cm. Każdy wariant zachowuje katalogowe wymiary IKEA.</small>
              </label>
            )}
            <a href={product.productUrl} target="_blank" rel="noreferrer">
              IKEA Polska · {product.articleNumber}
            </a>
            <p className="interior-note">
              {interiorText(product.finish)} · {interiorText(product.assemblyNote || "Wymiary po złożeniu")}
              {product.availabilityNote && ` · ${interiorText(product.availabilityNote)}`}
              {product.minimumCeilingM && ` · Minimalna wysokość do montażu: ${product.minimumCeilingM * 100} cm`}
            </p>
          </>
        )}
        <label className="interior-field">
          <span>Nazwa obiektu</span>
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
            label="Pozycja X (m)"
            min={-100}
            max={100}
            value={draft.position.x}
            onChange={(x) => setDraft({ ...draft, position: { ...draft.position, x } })}
          />
          <PrecisionField
            label="Pozycja Z (m)"
            min={-100}
            max={100}
            value={draft.position.z}
            onChange={(z) => setDraft({ ...draft, position: { ...draft.position, z } })}
          />
          <PrecisionField
            label="Obrót (°)"
            min={-360}
            max={360}
            step={1}
            value={draft.rotationDegrees}
            onChange={(rotationDegrees) => setDraft({ ...draft, rotationDegrees })}
          />
          <PrecisionField
            label="Wysokość nad podłogą (m)"
            max={8}
            value={draft.elevationM ?? 0}
            onChange={(elevationM) => setDraft({ ...draft, elevationM })}
          />
          {!product && (
            <label className="interior-field">
              Kolor wykończenia
              <input type="color" value={draft.color} onChange={(e) => setDraft({ ...draft, color: e.target.value })} />
            </label>
          )}
        </fieldset>
        <button className="interior-primary interior-inline-submit" disabled={item.locked}>
          Zastosuj zmiany
        </button>
        <p className="interior-note">
          {item.locked
            ? "Odblokuj obiekt, aby go edytować."
            : interactionHint ?? "Przeciągnij, aby przesunąć. R obraca; strzałki przesuwają; Shift dodaje do zaznaczenia."}
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
        <h2 id={heading}>Wymiary</h2>
        <button type="button" aria-label="Zamknij wymiary" onClick={onClose}>
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
          else setError("Nie można zastosować wymiarów. Sprawdź miejsce na podłodze, wysokość pomieszczenia i blokadę obiektu.")
        }}
      >
        <p className="interior-note" id={description}>
          Katalogowo: {sizeLabel(original)}. Możesz powiększyć każdy wymiar; rozmiar katalogowy jest minimum.
        </p>
        <fieldset disabled={item.locked} className="dimension-dialog-fields">
          {["Szerokość (m)", "Głębokość (m)", "Wysokość (m)"].map((label, index) => (
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
          Rozmiar katalogowy
        </button>
        <div className="interior-button-row">
          <button type="button" onClick={onClose}>
            Anuluj
          </button>
          <button className="interior-primary" disabled={item.locked}>
            Zapisz wymiary
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
      <h3>Wykończenie powierzchni</h3>
      <label className="interior-field">
        Powierzchnia
        <select
          aria-label="Powierzchnia do wykończenia"
          value={surface}
          onChange={(e) => setSurface(e.target.value as typeof surface)}
        >
          {surfaces.map((s) => (
            <option key={s} value={s}>
              {s === 'left'
                ? "Lewa strona · patrząc od początku do końca"
                : s === 'right'
                  ? "Prawa strona · patrząc od początku do końca"
                  : interiorText(s)}
            </option>
          ))}
        </select>
      </label>
      <div className="finish-swatches">
        {interiorFinishes.map((preset) => (
          <button
            type="button"
            key={preset.id}
            aria-label={`Wykończenie: ${interiorText(preset.name)}`}
            aria-pressed={finish.presetId === preset.id}
            onClick={() => setFinish(finishFromPreset(preset.id))}
          >
            <i style={{ background: preset.color }} />
            {interiorText(preset.name)}
          </button>
        ))}
      </div>
      <div className="interior-fields">
        <PrecisionField
          label="Obrót tekstury (°)"
          min={0}
          max={360}
          step={1}
          value={finish.rotationDegrees}
          onChange={(rotationDegrees) => setFinish({ ...finish, rotationDegrees })}
        />
        <PrecisionField
          label="Powtarzanie tekstury (m)"
          min={0.05}
          max={20}
          value={finish.tileM}
          onChange={(tileM) => setFinish({ ...finish, tileM })}
        />
      </div>
      <button className="interior-primary">Zastosuj wykończenie</button>
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
        id={context.formId}
        onReset={(event) => { event.preventDefault(); setName(room.name); setUsage(room.usage); setWidth(+measured.width.toFixed(3)); setDepth(+measured.depth.toFixed(3)) }}
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
        <div className="interior-fields">
          <PrecisionField label="Szerokość pomieszczenia (m)" min={1} value={width} onChange={setWidth} />
          <PrecisionField label="Głębokość pomieszczenia (m)" min={1} value={depth} onChange={setDepth} />
        </div>
        <label className="interior-field">
          Nazwa pomieszczenia
          <input value={name} required maxLength={100} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="interior-field">
          Funkcja pomieszczenia
          <input value={usage} required maxLength={100} onChange={(e) => setUsage(e.target.value)} />
        </label>
        <p className="interior-note">
          {measured.area.toFixed(2)} m² · Wymiary wewnątrz ścian. Zmiana rozmiaru przesuwa ściany działowe i sąsiednie pomieszczenia; obrys zewnętrzny pozostaje stały.
        </p>
        <button className="interior-primary interior-inline-submit" disabled={room.locked}>
          Zapisz pomieszczenie
        </button>
        <button type="button" disabled={room.locked} onClick={onPartition}>
          Dodaj ścianę w tym pomieszczeniu
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
      id={context.formId}
      onReset={(event) => { event.preventDefault(); setDraft(opening) }}
      className="interior-inspector-form"
      onSubmit={(e) => {
        e.preventDefault()
        context.commit({ ...command, action: 'opening', opening: draft })
      }}
    >
      <h3>{opening.kind === 'door' ? "Drzwi" : "Okno"}</h3>
      <p className="interior-note">Środek otworu mierzony wzdłuż ściany. Odstępy: {(draft.offsetM - draft.widthM / 2).toFixed(3)} m od początku · {(wallLength(wall) - draft.offsetM - draft.widthM / 2).toFixed(3)} m od końca.</p>
      <div className="interior-button-row"><button type="button" disabled={wall.locked} onClick={() => setDraft({ ...draft, offsetM: +(draft.offsetM - 0.01).toFixed(4) })}>← 1 cm</button><button type="button" disabled={wall.locked} onClick={() => setDraft({ ...draft, offsetM: +(draft.offsetM + 0.01).toFixed(4) })}>1 cm →</button></div>
      <div className="interior-fields">
        <PrecisionField
          label="Odległość od początku ściany (m)"
          value={draft.offsetM}
          max={wallLength(wall)}
          onChange={(offsetM) => setDraft({ ...draft, offsetM })}
        />
        <PrecisionField
          label="Szerokość otworu (m)"
          min={0.2}
          max={wallLength(wall)}
          value={draft.widthM}
          onChange={(widthM) => setDraft({ ...draft, widthM })}
        />
        <PrecisionField
          label="Wysokość otworu (m)"
          min={0.2}
          max={wall.heightM}
          value={draft.heightM}
          onChange={(heightM) => setDraft({ ...draft, heightM })}
        />
        <PrecisionField
          label="Wysokość parapetu (m)"
          max={wall.heightM}
          value={draft.sillM}
          onChange={(sillM) => setDraft({ ...draft, sillM })}
        />
      </div>
      {opening.kind === 'door' && (
        <div className="interior-fields">
          <label className="interior-field">
            Zawiasy
            <select
              aria-label="Strona zawiasów"
              value={draft.hinge ?? 'left'}
              onChange={(e) => setDraft({ ...draft, hinge: e.target.value as 'left' | 'right' })}
            >
              <option value="left">Lewa</option>
              <option value="right">Prawa</option>
            </select>
          </label>
          <label className="interior-field">
            Kierunek otwierania
            <select
              aria-label="Kierunek otwierania drzwi"
              value={draft.swing ?? 'in'}
              onChange={(e) => setDraft({ ...draft, swing: e.target.value as 'in' | 'out' })}
            >
              <option value="in">Do środka</option>
              <option value="out">Na zewnątrz</option>
            </select>
          </label>
        </div>
      )}
      <button className="interior-primary interior-inline-submit" disabled={wall.locked}>
        Zapisz otwór
      </button>
      <button
        type="button"
        className="interior-danger"
        disabled={wall.locked}
        onClick={() => context.commit({ ...command, action: 'opening-remove', openingRef: opening.ref })}
      >
        Usuń otwór
      </button>
    </form>
  )
}

export function WallInspector({
  wall,
  onSelect,
  onPreview,
  ...context
}: Context & { wall: WallModel; onSelect: (ref: string) => void; onPreview?: (wall: WallModel | null) => void }) {
  const [draft, setDraft] = useState(wall)
  const anchors = useMemo(() => wallLengthAnchors(context.building, context.storey, wall), [context.building, context.storey, wall])
  const [anchor, setAnchor] = useState<'start' | 'center' | 'end'>(anchors[0] ?? 'start')
  const [length, setLength] = useState(wallLength(wall))
  useEffect(() => { setDraft(wall); setLength(wallLength(wall)) }, [wall])
  useEffect(() => { setAnchor(current => anchors.includes(current) ? current : anchors[0] ?? 'start') }, [anchors])
  useEffect(() => { onPreview?.(draft); return () => onPreview?.(null) }, [draft, onPreview])
  const exterior = isEnvelopeWall(context.building, context.storey, wall)
  const command = {
    type: 'interior.update' as const,
    buildingRef: context.building.ref,
    storeyRef: context.storey.ref,
    wallRef: wall.ref,
  }
  const addOpening = (kind: 'door' | 'window') => {
    const opening: OpeningModel = {
      ref: `opening/${randomId()}`,
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
        id={context.formId}
        onReset={(event) => { event.preventDefault(); setDraft(wall); setLength(wallLength(wall)) }}
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
        <h3>{exterior ? "Ściana zewnętrzna" : "Ściana działowa"}</h3>
        <fieldset disabled={exterior || wall.locked} className="interior-fields">
          <label className="interior-field">Punkt stały<select aria-label="Punkt stały ściany" value={anchor} disabled={!anchors.length} onChange={e => {
            const next = e.target.value as typeof anchor
            setAnchor(next)
            if (Number.isFinite(length) && length >= .11) setDraft({ ...draft, ...wallWithLength({ ...draft, start: wall.start, end: wall.end }, length, next) })
          }}>{(['start', 'center', 'end'] as const).map((value, index) => <option key={value} value={value} disabled={!anchors.includes(value)}>{['A · Początek', 'Środek', 'B · Koniec'][index]}{!anchors.includes(value) ? ' · ograniczony' : ''}</option>)}</select></label>
          <PrecisionField label="Długość ściany (m)" disabled={!anchors.length} min={0.11} value={length} onChange={value => { setLength(value); if (Number.isFinite(value) && value >= 0.11) setDraft(wallWithLength({ ...draft, start: wall.start, end: wall.end }, value, anchor)) }} />
          <PrecisionField label="Wysokość ściany (m)" min={0.2} max={context.storey.clearHeightM} value={draft.heightM} onChange={heightM => setDraft({ ...draft, heightM })} />
          {(['start', 'end'] as const).flatMap((end) =>
            (['x', 'z'] as const).map((axis) => (
              <PrecisionField
                key={`${end}-${axis}`}
                label={`${end === 'start' ? "Początek" : "Koniec"} ${axis.toUpperCase()} (m)`}
                min={-100}
                max={100}
                value={draft[end][axis]}
                onChange={(value) => { const next = { ...draft, [end]: { ...draft[end], [axis]: value } }; setDraft(next); setLength(wallLength(next)) }}
              />
            )),
          )}
          <PrecisionField
            label="Grubość ściany (m)"
            min={0.06}
            max={0.5}
            value={draft.thicknessM}
            onChange={(thicknessM) => setDraft({ ...draft, thicknessM })}
          />
        </fieldset>
          {anchors.length < 3 && <p className="interior-note">{anchors.length ? 'Punkt stały dobrano do połączeń ścian. Niedostępne warianty naruszyłyby obrys zewnętrzny lub zablokowane połączenie.' : 'Połączenia blokują zmianę długości tej ściany. Możesz zmienić jej grubość i wysokość.'}</p>}
        <p className="interior-note">
          {wallLength(wall).toFixed(2)} m ·{' '}
          {exterior
            ? "Obrys zewnętrzny jest tutaj stały. Wybierz ścianę działową lub przesuń cały budynek."
              : `${context.mobile ? "Zamknij panel i wybierz Przesuń. Przeciągnij zaznaczoną ścianę." : "Przeciągnij ścianę."} Połączone ściany zachowają kąty proste, a granice pomieszczeń i otwory przesuną się razem.`}
        </p>
        <button className="interior-primary interior-inline-submit" disabled={exterior || wall.locked}>
          Zapisz zmianę ściany
        </button>
        <button
          type="button"
          className="interior-danger"
          disabled={exterior || wall.locked}
          onClick={() => context.commit({ ...command, action: 'merge' })}
        >
          Usuń ścianę i połącz pomieszczenia
        </button>
      </form>
      <div className="interior-button-row">
        <button disabled={wall.locked} onClick={() => addOpening('door')}>
          Dodaj drzwi
        </button>
        <button disabled={wall.locked} onClick={() => addOpening('window')}>
          Dodaj okno
        </button>
      </div>
      {wall.openings.map((opening) => (
        <button className="interior-list-item" key={opening.ref} onClick={() => onSelect(opening.ref)}>
          {interiorText(opening.kind)} · {opening.widthM.toFixed(2)} × {opening.heightM.toFixed(2)} m
        </button>
      ))}
      <FinishPicker {...context} targetRef={wall.ref} surfaces={['left', 'right']} current={wall.faceFinishes ?? {}} />
    </>
  )
}
