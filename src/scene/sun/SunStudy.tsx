import { Suspense, useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Canvas, events } from '@react-three/fiber'
import { ArrowLeft, MapPin, Pause, Play, RotateCcw, Sun } from 'lucide-react'
import type { MeshBVH } from 'three-mesh-bvh'
import { ACESFilmicToneMapping, PCFSoftShadowMap, type Group } from 'three'
import { polygonBounds, polygonCentroid, spaceFootprint } from '../../domain/geometry'
import { interiorCorners } from '../../domain/interior'
import { REFERENCE_YEAR, solarPosition, sunDirectionModel, sunriseSunset } from '../../domain/solar'
import type { BuildingModel, Polygon2, StoreyModel, Vec2 } from '../../domain/types'
import { useStudioStore } from '../../state/store'
import { SunStudyScene } from '../StudioScene'
import { RendererLifecycle, ViewportBoundary } from '../ViewportBoundary'
import { ObserverCamera } from './ObserverCamera'
import { firstObserverPoint, observerPointIssue, observerWorldPosition, studyClock } from './observer'
import { architecturalShadowMesh, DAYLIGHT_USES, daylightAdvice, LIGHT_LEVELS } from './daylight'
import { useDaylight } from './useDaylight'
import './sun-study.css'

const polygonPoints = (polygon: Polygon2) => polygon.map(p => `${p.x},${p.z}`).join(' ')
const LAST_HOUR = 1439 / 60

function ObserverPlan({ building, storey, point, yaw, onPick, zones, probe, paths, probeColor }: {
  building: BuildingModel; storey: StoreyModel; point: Vec2 | null; yaw: number; onPick: (point: Vec2) => void
  zones: boolean; probe: Vec2 | null; paths: string[] | null; probeColor?: string
}) {
  const clip = useId()
  const cursor = zones ? probe : point
  const slab = building.slabs.find(s => s.ref === storey.baseSlabRef)!
  const bounds = polygonBounds(slab.footprint)
  const padding = .8
  const rooms = building.spaces.filter(room => storey.spaceRefs.includes(room.ref))
  const localYaw = (yaw - building.rotationDegrees) * Math.PI / 180
  return <svg className="observer-plan" role="application" aria-label="Plan domu — wybierz miejsce obserwacji" tabIndex={0}
    viewBox={`${bounds.minX - padding} ${bounds.minZ - padding} ${bounds.maxX - bounds.minX + padding * 2} ${bounds.maxZ - bounds.minZ + padding * 2}`}
    onClick={event => {
      const svg = event.currentTarget
      const matrix = svg.getScreenCTM()
      if (!matrix) return
      const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse())
      onPick({ x: p.x, z: p.y })
    }} onKeyDown={event => {
      if (!cursor || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return
      event.preventDefault()
      const step = event.shiftKey ? .5 : .2
      onPick({ x: cursor.x + (event.key === 'ArrowRight' ? step : event.key === 'ArrowLeft' ? -step : 0),
        z: cursor.z + (event.key === 'ArrowDown' ? step : event.key === 'ArrowUp' ? -step : 0) })
    }}>
    <polygon points={polygonPoints(slab.footprint)} fill="#fffdf6" stroke="#a3b3ad" strokeWidth=".05" />
    {rooms.map(room => {
      const polygon = spaceFootprint(building, room)
      return <polygon key={room.ref} points={polygonPoints(polygon)} fill="#e9eee7" stroke="#fff" strokeWidth=".06" />
    })}
    {zones && paths && <g data-testid="daylight-zones">
      <defs><clipPath id={clip}><path clipRule="evenodd" d={[slab.footprint, ...(slab.holes ?? [])].map(poly => 'M' + polygonPoints(poly) + 'Z').join(' ')} /></clipPath></defs>
      <g clipPath={`url(#${clip})`}>{paths.map((path, level) => path && <path key={level} data-level={level} d={path} fill={LIGHT_LEVELS[level].color} />)}</g>
    </g>}
    {slab.holes?.map((hole, i) => <polygon key={i} points={polygonPoints(hole)} fill="#c4cbd0" stroke="#7c8a92" strokeWidth=".04" strokeDasharray=".12 .1" />)}
    {building.furniture?.filter(item => item.storeyRef === storey.ref).map(item => <polygon key={item.ref} points={polygonPoints(interiorCorners(item))} fill="#c9bca4" fillOpacity={zones ? .12 : .8} stroke="#ae9e83" strokeWidth=".03" />)}
    {building.walls.filter(wall => storey.wallRefs.includes(wall.ref) && wall.heightM > .1).map(wall => {
      const length = Math.hypot(wall.end.x - wall.start.x, wall.end.z - wall.start.z)
      return <g key={wall.ref}>
        <line x1={wall.start.x} y1={wall.start.z} x2={wall.end.x} y2={wall.end.z} stroke="#3a5048" strokeWidth={wall.thicknessM} />
        {wall.openings.map(opening => {
          const a = (opening.offsetM - opening.widthM / 2) / length, b = (opening.offsetM + opening.widthM / 2) / length
          return <line key={opening.ref} x1={wall.start.x + (wall.end.x - wall.start.x) * a} y1={wall.start.z + (wall.end.z - wall.start.z) * a}
            x2={wall.start.x + (wall.end.x - wall.start.x) * b} y2={wall.start.z + (wall.end.z - wall.start.z) * b}
            stroke={opening.kind === 'window' || opening.glazed ? '#83bdd2' : '#fffdf6'} strokeWidth={wall.thicknessM + .025} />
        })}
      </g>
    })}
    {rooms.map(room => {
      const centre = polygonCentroid(spaceFootprint(building, room))
      return <text key={room.ref} x={centre.x} y={centre.z} fontSize=".32" textAnchor="middle" fill="#293b35" stroke="#fffdf6" strokeWidth=".06" paintOrder="stroke"><title>{room.name}</title>{room.name.split(' · ')[0].replace('Przestrzeń pod otwartymi schodami', 'Schody')}</text>
    })}
    {zones && probe && <g data-testid="daylight-probe" transform={`translate(${probe.x},${probe.z})`}>
      <circle r=".31" fill="white" stroke="#263b34" strokeWidth=".07" /><circle r=".19" fill={probeColor ?? '#263b34'} stroke="#263b34" strokeWidth=".04" />
    </g>}
    {!zones && point && <g data-testid="observer-marker" transform={`translate(${point.x},${point.z})`}>
      <path d={`M0,0 L${-Math.sin(localYaw - .55) * 1.3},${-Math.cos(localYaw - .55) * 1.3} A1.3,1.3 0 0 0 ${-Math.sin(localYaw + .55) * 1.3},${-Math.cos(localYaw + .55) * 1.3} Z`} fill="#ecac3b" fillOpacity=".35" />
      <circle r=".19" fill="#c8701b" stroke="white" strokeWidth=".075" />
      <circle r=".06" fill="white" />
    </g>}
  </svg>
}

export default function SunStudy({ initialStoreyRef, onBack }: { initialStoreyRef?: string; onBack: () => void }) {
  const project = useStudioStore(state => state.project)
  const building = project.buildings.find(b => b.kind === 'house') ?? project.buildings[0]
  if (!building?.storeys.length) return <main className="sun-study"><button onClick={onBack}>Wróć</button><p>Ten projekt nie ma jeszcze kondygnacji domu.</p></main>
  return <Study key={`${project.ref}/${building.ref}`} building={building} initialStoreyRef={initialStoreyRef} onBack={onBack} />
}

function Study({ building, initialStoreyRef, onBack }: { building: BuildingModel; initialStoreyRef?: string; onBack: () => void }) {
  const project = useStudioStore(state => state.project)
  const time = useStudioStore(state => state.sunTime)
  const treesVisible = useStudioStore(state => state.treesVisible)
  const neighborsVisible = useStudioStore(state => state.neighborsVisible)
  const setTime = useStudioStore(state => state.setSunTime)
  const [floorRef, setFloorRef] = useState(initialStoreyRef ?? building.storeys[0].ref)
  const storey = building.storeys.find(s => s.ref === floorRef) ?? building.storeys[0]
  const [eyeHeight, setEyeHeight] = useState(1.6)
  const [points, setPoints] = useState<Record<string, Vec2>>({})
  const defaultPoint = useMemo(() => firstObserverPoint(building, storey, eyeHeight), [building, storey, eyeHeight])
  const point = points[storey.ref] ?? defaultPoint
  const [yaw, setYaw] = useState(building.rotationDegrees)
  const [pitch, setPitch] = useState(0)
  const [fieldOfView, setFieldOfView] = useState(85)
  const [fullBrightness, setFullBrightness] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [planOpen, setPlanOpen] = useState(() => !window.matchMedia('(max-width: 900px)').matches)
  const [zones, setZones] = useState(false)
  const [probes, setProbes] = useState<Record<string, Vec2>>({})
  const probe = probes[storey.ref] ?? point
  const [envelope, setEnvelope] = useState<MeshBVH | null>(null)
  const onGeometry = useCallback((root: Group, model: BuildingModel) => setEnvelope(architecturalShadowMesh(root, model)), [])
  const [notice, setNotice] = useState('')
  const stage = useRef<HTMLElement>(null)
  const dragging = useRef<{ x: number; y: number; id: number } | null>(null)
  const site = project.climateProfile
  const year = time.year ?? REFERENCE_YEAR
  const dateValue = `${year}-${String(time.month).padStart(2, '0')}-${String(time.day).padStart(2, '0')}`
  const sun = solarPosition(site, time)
  const sunDirection = useMemo(() => sunDirectionModel(sun.azimuthDeg, sun.altitudeDeg, project.site.northDegrees), [sun.azimuthDeg, sun.altitudeDeg, project.site.northDegrees])
  const { grid, reading, paths } = useDaylight(envelope, project, building, storey, zones ? probe : point, zones && planOpen, sunDirection, treesVisible, neighborsVisible)
  const level = reading && LIGHT_LEVELS[reading.level]
  const closePlan = () => { setZones(false); setPlanOpen(false); setNotice('') }
  const daylight = useMemo(() => sunriseSunset(site, { year, month: time.month, day: time.day, hour: 12 }), [site, year, time.month, time.day])
  const position = useMemo(() => point ? observerWorldPosition(building, storey, point, eyeHeight) : null, [building, storey, point, eyeHeight])
  const pointIssue = point ? observerPointIssue(building, storey, point, eyeHeight) : 'Wybierz miejsce na planie.'
  useEffect(() => {
    const state = useStudioStore.getState()
    const previous = { selectedRef: state.selectedRef, repositioningRef: state.repositioningRef, viewerMode: state.viewerMode }
    useStudioStore.setState({ selectedRef: null, repositioningRef: null, viewerMode: 'edit', sunAnimation: 'none' })
    const pauseHidden = () => { if (document.hidden) setPlaying(false) }
    document.addEventListener('visibilitychange', pauseHidden)
    return () => {
      document.removeEventListener('visibilitychange', pauseHidden)
      if (useStudioStore.getState().project.ref === project.ref) useStudioStore.setState(previous)
    }
  }, [])
  useEffect(() => {
    if (!playing) return
    let last = performance.now()
    const timer = window.setInterval(() => {
      const now = performance.now(), elapsed = Math.min(.5, (now - last) / 1000)
      last = now
      const next = Math.min(LAST_HOUR, useStudioStore.getState().sunTime.hour + elapsed * speed / 4)
      setTime({ hour: next })
      if (next >= LAST_HOUR) setPlaying(false)
    }, 100)
    return () => window.clearInterval(timer)
  }, [playing, speed, setTime])
  const seek = (hour: number) => { setPlaying(false); setTime({ hour: Math.max(0, Math.min(LAST_HOUR, hour)) }) }
  const pick = (next: Vec2) => {
    if (zones) {
      if (!grid.contains(next)) { setNotice('Wskaż punkt na podłodze lub blacie, poza ścianą i otworem w stropie.'); return }
      setProbes(current => ({ ...current, [storey.ref]: next })); setNotice('')
      return
    }
    const issue = observerPointIssue(building, storey, next, eyeHeight)
    if (issue) { setNotice(issue); return }
    setNotice(''); setPoints(current => ({ ...current, [storey.ref]: next }))
    if (window.innerWidth <= 900) setPlanOpen(false)
  }
  const turn = (horizontal: number, vertical = 0) => {
    setYaw(value => (value + horizontal + 360) % 360)
    setPitch(value => Math.min(85, Math.max(-85, value + vertical)))
  }
  const start = () => {
    if (time.hour >= LAST_HOUR) setTime({ hour: 0 })
    setPlaying(value => !value)
  }
  const compass = ((Math.atan2(-Math.sin(yaw * Math.PI / 180), -Math.cos(yaw * Math.PI / 180)) * 180 / Math.PI - project.site.northDegrees) * -1 + 360) % 360
  const timelineStyle = { '--sunrise': `${Math.max(0, Math.min(100, (daylight?.sunriseHour ?? (sun.altitudeDeg > 0 ? 0 : 24)) / 24 * 100))}%`,
    '--sunset': `${Math.max(0, Math.min(100, (daylight?.sunsetHour ?? (sun.altitudeDeg > 0 ? 24 : 24)) / 24 * 100))}%` } as CSSProperties
  return <main className="sun-study" lang="pl" aria-label="Światło 360°">
    <header className="sun-study-header">
      <button onClick={onBack}><ArrowLeft size={18} /><span>Wróć</span></button>
      <div><strong><Sun size={19} /> Światło 360°</strong><small>{project.name} · {storey.name}</small></div>
      <button className={planOpen ? 'active' : ''} aria-expanded={planOpen} aria-controls="observer-plan-panel" onClick={() => { setPlanOpen(!planOpen || zones); setZones(false); setNotice('') }}><MapPin size={17} /> Miejsce</button>
    </header>
    <div className={`sun-study-workspace ${planOpen ? 'with-plan' : ''}`}>
      {planOpen && <aside id="observer-plan-panel" className={`sun-study-plan-panel ${zones ? 'daylight-panel' : ''}`} aria-label="Miejsce obserwacji">
        <div className="sun-study-plan-heading"><strong>{zones ? 'Strefy światła · ' + studyClock(time.hour) : 'Zaznacz, gdzie stoisz'}</strong><p>{zones ? 'Dotknij miejsca na planie i przesuń godzinę poniżej.' : 'Kliknij wolne miejsce. Kropka to Ty, wachlarz pokazuje kierunek patrzenia.'}</p></div>
        <button className="sun-study-show-preview" onClick={closePlan}>Pokaż symulację</button>
        <label>Kondygnacja<select aria-label="Kondygnacja obserwacji" value={storey.ref} onChange={event => { setFloorRef(event.target.value); setNotice(''); setPlaying(false) }}>{building.storeys.map(floor => <option key={floor.ref} value={floor.ref}>{floor.name}</option>)}</select></label>
        <ObserverPlan building={building} storey={storey} point={point} yaw={yaw} onPick={pick} zones={zones} probe={probe} paths={paths} probeColor={level?.color} />
        {zones && <>
          <div className="daylight-result" data-testid="zone-reading">
            {reading && level ? <>
              <strong><i style={{ background: level.color }} />{reading.level}/10 · {level.name}</strong>
              <span>{reading.direct ? 'Bezpośrednie słońce · możliwe odblaski' : 'Bez bezpośredniego słońca'}</span>
            </> : 'Obliczanie dostępu światła…'}
          </div>
          <div className="daylight-legend" aria-label="Skala światła dziennego od 0 do 10">
            <div className="daylight-bands">{LIGHT_LEVELS.map((item, i) => <span key={item.name} title={`${i}/10 · ${item.name}`} aria-current={reading?.level === i ? 'true' : undefined} style={{ background: item.color, color: i <= 1 ? '#fff' : '#182821' }}>{i}</span>)}</div>
            <div className="daylight-band-labels"><span>Ciemno</span><span>Umiarkowanie</span><span>Najwięcej światła</span></div>
          </div>
          {reading && <dl className="daylight-uses">{DAYLIGHT_USES.map(use => <div key={use.name}><dt>{use.name}</dt><dd>{daylightAdvice(reading.level, use.adequate)}</dd></div>)}</dl>}
          {!paths && <small role="status">Obliczanie stref na planie…</small>}
          <small className="daylight-method">Ocena orientacyjna na wysokości blatu (80 cm), przy bezchmurnym niebie. Model uwzględnia okna, przeszkody i uproszczone odbicie od wnętrza. Pomija rolety i meble.</small>
        </>}
        {!zones && <div className="sun-study-eye"><label>Wysokość oczu<select aria-label="Wysokość oczu" value={eyeHeight} onChange={event => {
          const next = Number(event.target.value)
          if (point && observerPointIssue(building, storey, point, next)) { setNotice('W tym miejscu jest za nisko dla tej wysokości oczu.'); return }
          setEyeHeight(next); setNotice('')
        }}><option value={1.2}>Siedząc · 1,20 m</option><option value={1.6}>Stojąc · 1,60 m</option><option value={1.75}>Stojąc · 1,75 m</option></select></label>
        <small>Na planie możesz też używać strzałek klawiatury.</small></div>}
        <div className="sun-study-context"><label><input type="checkbox" checked={treesVisible} onChange={event => useStudioStore.getState().setTreesVisible(event.target.checked)} />Drzewa</label>
          {!!project.site.neighbors?.length && <label><input type="checkbox" checked={neighborsVisible} onChange={event => useStudioStore.getState().setNeighborsVisible(event.target.checked)} />Zabudowa sąsiadów</label>}</div>
        <p className="sun-study-notice" role="status">{notice || (!zones && (pointIssue || 'Miejsce gotowe. Rozejrzyj się w podglądzie.'))}</p>
      </aside>}
      <section ref={stage} className="sun-study-stage" aria-label="Podgląd z wybranego miejsca" tabIndex={0}
        onPointerDown={event => {
          if (!(event.target instanceof HTMLCanvasElement) || event.button !== 0) return
          event.currentTarget.focus({ preventScroll: true }); event.currentTarget.setPointerCapture(event.pointerId)
          dragging.current = { x: event.clientX, y: event.clientY, id: event.pointerId }
        }} onPointerMove={event => {
          const drag = dragging.current
          if (!drag || drag.id !== event.pointerId) return
          turn((event.clientX - drag.x) * .22, (event.clientY - drag.y) * .18)
          dragging.current = { x: event.clientX, y: event.clientY, id: event.pointerId }
        }} onPointerUp={() => { dragging.current = null }} onPointerCancel={() => { dragging.current = null }} onLostPointerCapture={() => { dragging.current = null }}
        onKeyDown={event => {
          if (event.target !== event.currentTarget) return
          if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
            event.preventDefault(); turn(event.key === 'ArrowLeft' ? 5 : event.key === 'ArrowRight' ? -5 : 0, event.key === 'ArrowUp' ? 5 : event.key === 'ArrowDown' ? -5 : 0)
          }
        }}>
        {position && !pointIssue ? <ViewportBoundary><Canvas frameloop="demand" shadows dpr={[1, 1.5]} events={state => ({ ...events(state), enabled: false })}
          gl={{ antialias: true }} onCreated={({ gl }) => { gl.toneMapping = ACESFilmicToneMapping; gl.toneMappingExposure = 1.2; gl.shadowMap.type = PCFSoftShadowMap; gl.domElement.setAttribute('aria-label', 'Widok światła 360°') }}>
          <RendererLifecycle /><ObserverCamera position={position} yaw={yaw} pitch={pitch} fieldOfView={fieldOfView} />
          <Suspense fallback={null}><SunStudyScene focus={position} fullBrightness={fullBrightness} studyBuildingRef={building.ref} onGeometry={onGeometry} /></Suspense>
        </Canvas></ViewportBoundary> : <p className="sun-study-empty">Wskaż wolne miejsce na planie, aby zobaczyć wnętrze.</p>}
        <div className="sun-study-view-label"><span>{studyClock(time.hour)}</span><small>{fullBrightness ? 'Pełna jasność · podgląd wnętrza' : sun.altitudeDeg > 0 ? 'Słońce nad horyzontem' : 'Słońce pod horyzontem'} · kierunek {Math.round(compass)}°</small>
          {!zones && <button className="daylight-open" aria-controls="observer-plan-panel" onClick={() => { setPlanOpen(true); setZones(true); setNotice('') }}>
            <i style={{ background: level?.color }} /><strong>{reading && level ? `${reading.level}/10 · ${level.name}` : 'Światło dzienne'}</strong><span>Strefy światła ›</span>
          </button>}
        </div>
        <div className="sun-study-look"><span>Przeciągnij, aby się rozejrzeć · 360°</span><div>
          <button aria-label="Spójrz w lewo" onClick={() => turn(30)}>←</button><button aria-label="Spójrz w górę" onClick={() => turn(0, 15)}>↑</button>
          <button aria-label="Wyprostuj widok" onClick={() => setPitch(0)}><RotateCcw size={16} /></button>
          <button aria-label="Spójrz w dół" onClick={() => turn(0, -15)}>↓</button><button aria-label="Spójrz w prawo" onClick={() => turn(-30)}>→</button>
        </div></div>
      </section>
    </div>
    <footer className="sun-study-time" aria-label="Oś czasu wybranego dnia">
      <div className="sun-study-display-controls">
        <button className={fullBrightness ? 'active' : ''} aria-pressed={fullBrightness} onClick={() => setFullBrightness(value => !value)}><Sun size={17} />Pełna jasność</button>
        <label><span>Wężej</span><input type="range" aria-label="Szerokość widoku" aria-valuetext={`${fieldOfView} stopni`} min="55" max="110" step="1" value={fieldOfView} onChange={event => setFieldOfView(Number(event.target.value))} /><span>Szerzej</span></label>
      </div>
      <div className="sun-study-time-controls">
        <label>Data<input aria-label="Data obserwacji" type="date" min="1900-01-01" max="2100-12-31" value={dateValue} onChange={event => {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(event.target.value) || !event.target.validity.valid) return
          const [nextYear, month, day] = event.target.value.split('-').map(Number)
          setPlaying(false); setTime({ year: nextYear, month, day })
        }} /></label>
        <label>Godzina<input aria-label="Godzina obserwacji" type="time" step="60" value={studyClock(time.hour)} onChange={event => {
          if (!event.target.value) return
          const [hours, minutes] = event.target.value.split(':').map(Number)
          seek(hours + minutes / 60)
        }} /></label>
        <button className="sun-study-play" aria-label={playing ? 'Zatrzymaj animację' : 'Odtwórz dzień'} onClick={start} disabled={!position || !!pointIssue}>{playing ? <Pause size={18} /> : <Play size={18} />}{playing ? 'Pauza' : 'Odtwórz'}</button>
        <label>Tempo<select aria-label="Tempo animacji" value={speed} onChange={event => setSpeed(Number(event.target.value))}><option value={.5}>0,5×</option><option value={1}>1×</option><option value={2}>2×</option><option value={4}>4×</option></select></label>
        <div className="sun-study-jumps"><button onClick={() => seek(time.hour - 1)} aria-label="Godzinę wcześniej">−1 h</button><button onClick={() => seek(time.hour + 1)} aria-label="Godzinę później">+1 h</button></div>
        <small className="sun-study-zone">Czas lokalny · {site.timezone}<br />1× = godzina w 4 sekundy</small>
      </div>
      <div className="sun-study-timeline" style={timelineStyle}>
        <input type="range" aria-label="Oś czasu dnia" aria-valuetext={studyClock(time.hour)} min="0" max="1439" step="1" value={Math.min(1439, Math.round(time.hour * 60))}
          onPointerDown={() => setPlaying(false)} onKeyDown={() => setPlaying(false)} onChange={event => seek(Number(event.target.value) / 60)} />
        <div className="sun-study-hours" aria-hidden="true">{[0, 3, 6, 9, 12, 15, 18, 21, 24].map(hour => <span key={hour}>{hour === 24 ? '24:00' : studyClock(hour)}</span>)}</div>
      </div>
      <div className="sun-study-footnote"><div>{daylight ? <><button onClick={() => seek(daylight.sunriseHour)}>Wschód {studyClock(daylight.sunriseHour)}</button><button onClick={() => seek(daylight.solarNoonHour)}>Południe {studyClock(daylight.solarNoonHour)}</button><button onClick={() => seek(daylight.sunsetHour)}>Zachód {studyClock(daylight.sunsetHour)}</button></> : <span>Brak wschodu lub zachodu tego dnia.</span>}</div>
        <small>Symulacja bezchmurnego nieba na podstawie modelu. Bez pogody i pomiaru jasności.</small></div>
    </footer>
  </main>
}
