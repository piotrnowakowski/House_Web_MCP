import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Focus, List, Minus, Plus } from 'lucide-react'
import { polygonCentroid } from '../domain/geometry'
import { planMetres, sitePlanBounds, sitePlanCategories, sitePlanEdges, sitePlanElements, type SitePlanElement } from '../domain/sitePlan'
import { layoutPlanLabels } from '../interior/labelLayout'
import { useStudioStore } from '../state/store'
import type { Vec2 } from '../domain/types'
import './site-plan.css'

export default function SitePlan({ onBack }: { onBack: () => void }) {
  const project = useStudioStore(s => s.project)
  const elements = useMemo(() => sitePlanElements(project), [project])
  const [selectedRef, setSelectedRef] = useState<string | null>(null)
  const [query, setQuery] = useState(''), [category, setCategory] = useState('')
  const [listOpen, setListOpen] = useState(false), [labels, setLabels] = useState(true)
  const [size, setSize] = useState({ width: 1, height: 1 })
  const [camera, setCamera] = useState<{ x: number; z: number; scale: number } | null>(null)
  const viewport = useRef<HTMLDivElement>(null)
  const sidebar = useRef<HTMLElement>(null)
  const drag = useRef<{ x: number; y: number; cameraX: number; cameraZ: number; ref: string | null; moved: boolean } | null>(null)
  const selected = elements.find(e => e.ref === selectedRef)
  const fit = (items: SitePlanElement[]) => {
    const bounds = sitePlanBounds(items.length ? items : elements)
    return { x: (bounds.minX + bounds.maxX) / 2, z: (bounds.minZ + bounds.maxZ) / 2, scale: Math.max(.2, Math.min(250, (size.width - 110) / Math.max(2, bounds.maxX - bounds.minX), (size.height - 120) / Math.max(2, bounds.maxZ - bounds.minZ))) }
  }
  const view = camera ?? fit(elements.filter(e => e.developed))
  const screen = (p: Vec2) => ({ x: (p.x - view.x) * view.scale + size.width / 2, y: (p.z - view.z) * view.scale + size.height / 2 })
  const zoom = (factor: number) => setCamera({ ...view, scale: Math.max(.2, Math.min(250, view.scale * factor)) })
  const choose = (element: SitePlanElement, focus = false) => {
    setSelectedRef(element.ref)
    if (focus) setCamera(fit([element]))
  }
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setSize({ width: entry.contentRect.width, height: entry.contentRect.height }))
    if (viewport.current) observer.observe(viewport.current)
    return () => observer.disconnect()
  }, [])
  useEffect(() => { sidebar.current?.scrollTo({ top: 0 }) }, [selectedRef])
  useEffect(() => {
    const node = viewport.current
    const wheel = (event: WheelEvent) => {
      event.preventDefault()
      const rect = node!.getBoundingClientRect(), scale = Math.max(.2, Math.min(250, view.scale * Math.exp(-event.deltaY * .0015)))
      const dx = event.clientX - rect.left - size.width / 2, dz = event.clientY - rect.top - size.height / 2
      setCamera({ x: view.x + dx / view.scale - dx / scale, z: view.z + dz / view.scale - dz / scale, scale })
    }
    node?.addEventListener('wheel', wheel, { passive: false })
    return () => node?.removeEventListener('wheel', wheel)
  }, [view.x, view.z, view.scale, size.width, size.height])

  const filtered = elements.filter(e => (!category || e.category === category) && `${e.name} ${e.note ?? ''}`.toLocaleLowerCase('pl').includes(query.toLocaleLowerCase('pl')))
  const labelCandidates = elements.map((e, id) => {
    const p = screen(polygonCentroid(e.points)), title = `${id + 1}. ${e.name.length > 27 ? `${e.name.slice(0, 26)}…` : e.name}`
    const text = `${e.summary}${e.heightM !== undefined ? ` · h ${planMetres(e.heightM)}` : ''}`
    const width = Math.max(title.length, text.length) * 6.2 + 16
    return { id, x: p.x - width / 2, y: p.y - 18, width, height: 36, priority: e.ref === selectedRef ? 100 : e.priority, movable: true, title, text, point: p }
  })
  const dimensionLabels = selected ? sitePlanEdges(selected).flatMap(([a, b]) => {
    const p = screen(a), q = screen(b), length = Math.hypot(q.x - p.x, q.y - p.y)
    if (length <= 42) return []
    return [{ x: (p.x + q.x) / 2 - (q.y - p.y) / length * 18 - 38, y: (p.y + q.y) / 2 + (q.x - p.x) / length * 18 - 20, width: 76, height: 22 }]
  }) : []
  const labelLayout = layoutPlanLabels(labelCandidates.filter(l => elements[l.id].ref === selectedRef || (labels && (l.priority > 0 || view.scale > 35))), { x: 6, y: 6, width: size.width - 12, height: size.height - 74 }, [{ x: 0, y: 0, width: 90, height: 92 }, ...dimensionLabels])
  const scaleLength = view.scale >= 18 ? 1 : view.scale >= 5 ? 5 : 20
  const north = project.site.northDegrees * Math.PI / 180
  const drawShape = (e: SitePlanElement, highlight = false) => {
    const points = e.points.map(screen), center = screen(polygonCentroid(e.points))
    const props = { fill: highlight ? 'none' : e.color, stroke: highlight ? '#bd4c29' : e.category === 'Rośliny' ? '#64885b' : '#64746f', strokeWidth: highlight ? 3 : e.points.length === 2 && !e.diameterM ? 3 : 1, 'data-ref': e.ref }
    if (e.diameterM) return <circle {...props} cx={center.x} cy={center.y} r={e.diameterM * view.scale / 2} fillOpacity={highlight ? 0 : .55} />
    if (e.points.length === 2) return <line {...props} stroke={highlight ? '#bd4c29' : e.color} x1={points[0].x} y1={points[0].y} x2={points[1].x} y2={points[1].y} />
    return <polygon {...props} points={points.map(p => `${p.x},${p.y}`).join(' ')} strokeDasharray={e.category === 'Dachy' || e.category === 'Działka' ? '5 4' : undefined} fillOpacity={e.category === 'Dachy' ? .4 : 1} />
  }
  return <main className={`site-plan${listOpen ? ' site-plan-list-open' : ''}`} aria-label="Plan 2D terenu z wymiarami">
    <header className="site-plan-header"><button autoFocus onClick={onBack}><ArrowLeft size={18} />Wróć do 3D</button><div><h1>Plan terenu <span>2D</span></h1><p>{project.name} · r{project.revision}</p></div><button className="site-plan-list-toggle" aria-expanded={listOpen} onClick={() => setListOpen(!listOpen)}><List size={18} />Elementy ({elements.length})</button></header>
    <div className="site-plan-tools" role="group" aria-label="Narzędzia planu 2D">
      <button aria-label="Powiększ plan" onClick={() => zoom(1.4)}><Plus size={18} /></button><button aria-label="Pomniejsz plan" onClick={() => zoom(1 / 1.4)}><Minus size={18} /></button>
      <button onClick={() => setCamera(fit(elements.filter(e => e.developed)))}><Focus size={17} />Zagospodarowanie</button><button onClick={() => setCamera(fit(elements))}>Cała działka</button>
      <label><input type="checkbox" checked={labels} onChange={event => setLabels(event.target.checked)} />Wymiary na planie</label>
    </div>
    <div className="site-plan-drawing" ref={viewport}>
      <svg width="100%" height="100%" role="img" aria-label="Rzut z góry: wybierz element, aby zobaczyć jego wymiary" onPointerDown={event => {
        if (event.button !== 0 || !event.isPrimary) return
        drag.current = { x: event.clientX, y: event.clientY, cameraX: view.x, cameraZ: view.z, ref: (event.target as Element).closest('[data-ref]')?.getAttribute('data-ref') ?? null, moved: false }
        event.currentTarget.setPointerCapture(event.pointerId)
      }} onPointerMove={event => {
        const d = drag.current
        if (!d || !event.isPrimary) return
        const dx = event.clientX - d.x, dy = event.clientY - d.y
        if (Math.hypot(dx, dy) > 4) d.moved = true
        if (d.moved) setCamera({ ...view, x: d.cameraX - dx / view.scale, z: d.cameraZ - dy / view.scale })
      }} onPointerUp={() => {
        const d = drag.current
        if (d && !d.moved) { setSelectedRef(d.ref); if (d.ref) setListOpen(true) }
        drag.current = null
      }} onPointerCancel={() => { drag.current = null }}>
        <defs><pattern id="site-plan-grid" width={5 * view.scale} height={5 * view.scale} patternUnits="userSpaceOnUse" x={screen({ x: 0, z: 0 }).x} y={screen({ x: 0, z: 0 }).y}><path d={`M ${5 * view.scale} 0 H 0 V ${5 * view.scale}`} fill="none" stroke="#dae0d7" strokeWidth=".7" /></pattern></defs>
        <rect width="100%" height="100%" fill="url(#site-plan-grid)" />
        {elements.map(e => <g key={e.ref} className="site-plan-object"><title>{e.name}: {e.summary}{e.heightM !== undefined ? `; wysokość ${planMetres(e.heightM)}` : ''}</title>{drawShape(e)}</g>)}
        {selected && <g className="site-plan-selected">{drawShape(selected, true)}{sitePlanEdges(selected).map(([a, b], index) => {
          const p = screen(a), q = screen(b), length = Math.hypot(q.x - p.x, q.y - p.y)
          if (length < 1) return null
          const nx = -(q.y - p.y) / length * 18, ny = (q.x - p.x) / length * 18
          return <g key={index} className="site-plan-dimension"><path d={`M ${p.x} ${p.y} l ${nx * 1.3} ${ny * 1.3} M ${q.x} ${q.y} l ${nx * 1.3} ${ny * 1.3} M ${p.x + nx} ${p.y + ny} L ${q.x + nx} ${q.y + ny}`} />{length > 42 && <text x={(p.x + q.x) / 2 + nx} y={(p.y + q.y) / 2 + ny - 5}>{selected.diameterM ? 'Ø ' : ''}{planMetres(Math.hypot(b.x - a.x, b.z - a.z))}</text>}</g>
        })}</g>}
        {labelCandidates.map(l => {
          const placement = labelLayout.get(l.id)
          if (!placement?.visible) return null
          const e = elements[l.id], x = l.x + placement.dx, y = l.y + placement.dy
          return <g key={e.ref} data-ref={e.ref} className={`site-plan-label${e.ref === selectedRef ? ' selected' : ''}`}>
            <line x1={l.point.x} y1={l.point.y} x2={x + l.width / 2} y2={y + l.height / 2} />
            <rect x={x} y={y} width={l.width} height={l.height} rx="4" /><text x={x + 8} y={y + 14}>{l.title}</text><text className="site-plan-label-value" x={x + 8} y={y + 28}>{l.text}</text>
          </g>
        })}
        <g className="site-plan-north" transform="translate(43 45)"><circle r="30" /><path d={`M 0 0 L ${Math.sin(north) * 24} ${Math.cos(north) * 24}`} /><text x={Math.sin(north) * 40} y={Math.cos(north) * 40 + 4}>N</text><circle r="2" /></g>
        <g className="site-plan-scale" transform={`translate(24 ${size.height - 38})`}><path d={`M 0 -5 V 0 H ${scaleLength * view.scale} V -5`} /><text y="17">{scaleLength} m · rzut poziomy</text></g>
      </svg>
      <p className="site-plan-hint">Przeciągnij, aby przesunąć · + / − powiększa · kliknij element po szczegóły</p>
    </div>
    <aside ref={sidebar} className="site-plan-sidebar" aria-label="Wymiary wszystkich elementów">
      <h2>Wymiary elementów <span>{elements.length}</span></h2>
      <p className="site-plan-note">Metry z modelu. Etykiety ujawniają się przy powiększeniu; komplet wymiarów jest na liście.</p>
      {selected && <section className="site-plan-detail" aria-label="Wymiary wybranego elementu"><div><strong>{selected.name}</strong><button aria-label="Zamknij szczegóły elementu" onClick={() => setSelectedRef(null)}>×</button></div><b>{selected.summary}</b>{selected.heightM !== undefined && <p>Wysokość: {planMetres(selected.heightM)}</p>}<p>{selected.note}</p><p>Boki / odcinki: {sitePlanEdges(selected).map(([a, b]) => planMetres(Math.hypot(b.x - a.x, b.z - a.z))).join(' · ')}</p><button onClick={() => setCamera(fit([selected]))}>Powiększ wybrany element</button></section>}
      <input type="search" aria-label="Szukaj elementu na planie" placeholder="Szukaj: sosna, PV, furtka…" value={query} onChange={event => setQuery(event.target.value)} />
      <select aria-label="Rodzaj elementów na planie" value={category} onChange={event => setCategory(event.target.value)}><option value="">Wszystkie rodzaje</option>{sitePlanCategories.map(c => <option key={c}>{c}</option>)}</select>
      <div className="site-plan-elements"><p>Elementy: {filtered.length} · wybierz, aby przybliżyć</p>{filtered.map(e => <button key={e.ref} aria-pressed={e.ref === selectedRef} onClick={() => choose(e, true)}><span><i style={{ background: e.color === 'none' ? '#b0bbb3' : e.color }} />{elements.indexOf(e) + 1}. {e.name}</span><strong>{e.summary}{e.heightM !== undefined && <small>h = {planMetres(e.heightM)}</small>}</strong></button>)}{!filtered.length && <p>Brak pasujących elementów.</p>}</div>
      <p className="site-plan-note">Wymiary nie zastępują pomiaru geodezyjnego ani projektu wykonawczego. Wysokości roślin są szacunkowe.</p>
    </aside>
  </main>
}
