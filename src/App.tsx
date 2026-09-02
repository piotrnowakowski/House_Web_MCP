import { Canvas } from '@react-three/fiber'
import { Suspense, useEffect, useState } from 'react'
import { ACESFilmicToneMapping, PCFSoftShadowMap, SRGBColorSpace } from 'three'
import { dayParts } from './domain/climate'
import { calculateMetrics } from './domain/commands'
import { ensureStarterGarden, gardenFixtureCatalog, nextFixturePosition, starterGardenCommands } from './domain/gardenFixtures'
import { applyModernBarnPreset, isModernBarnPreset } from './domain/presets'
import type { ClimateDayPart, GardenFixtureCatalogId, PlantingGuideCategory } from './domain/types'
import { CLEAR_MEASUREMENT_EVENT, StudioScene } from './scene/StudioScene'
import { loadProject, saveProject } from './services/persistence'
import { showStructureViews } from './services/structureViews'
import { registerWebMcpTools, resolveVariantConfirmation } from './services/webmcp'
import type { WebMcpManifest } from './services/webmcpDefinitions'
import { useStudioStore } from './state/store'

const modes = [
  ['edit', 'Edit'], ['measure-length', 'Length'], ['measure-area', 'Area'], ['section', 'Section'], ['plan', 'Plan'],
] as const

const modeTitles = {
  edit: 'Select and move semantic objects',
  'measure-length': 'Click two points to measure the distance',
  'measure-area': 'Drag a rectangle across the ground to measure its area',
  section: 'Cut through the model to inspect the interior',
  plan: 'Switch to a top-down orthographic view',
} as const

function Toolbar({ onOpenClimate, onOpenPlanting, onOpenMcpTools }: { onOpenClimate: () => void; onOpenPlanting: () => void; onOpenMcpTools: () => void }) {
  const project = useStudioStore((state) => state.project); const viewerMode = useStudioStore((state) => state.viewerMode); const setViewerMode = useStudioStore((state) => state.setViewerMode)
  const viewMode = useStudioStore((state) => state.viewMode); const setViewMode = useStudioStore((state) => state.setViewMode); const explode = useStudioStore((state) => state.explodeStoreys); const setExplode = useStudioStore((state) => state.setExplodeStoreys)
  const setActivePlan = useStudioStore((state) => state.setActivePlanStoreyRef); const webMcp = useStudioStore((state) => state.webMcpAvailable); const setToast = useStudioStore((state) => state.setToast)
  const [busy, setBusy] = useState(false)
  const generateReport = async () => {
    setBusy(true)
    try { await showStructureViews({ mode: 'architectural-set' }, new AbortController().signal) }
    catch (error) { setToast(error instanceof Error ? error.message : 'Report generation failed.') }
    finally { setBusy(false) }
  }
  return <header className="topbar">
    <div className="brand"><span className="brand-mark">V2</span><div><strong>Spatial Editor</strong><small>{project.name} · r{project.revision}</small></div></div>
    <nav aria-label="Viewer tools">{modes.map(([value, label]) => <button key={value} className={viewerMode === value ? 'active' : ''} onClick={() => {
      if (value === 'plan') { const first = project.buildings[0]?.storeys[0]; if (first) setActivePlan(first.ref) }
      else setViewerMode(value)
    }} title={modeTitles[value]}>{label}</button>)}</nav>
    <div className="top-actions">
      <button onClick={() => setViewMode(viewMode === 'technical' ? 'realistic' : 'technical')}>{viewMode === 'technical' ? 'Technical' : 'Realistic'}</button>
      <button className={explode ? 'active' : ''} aria-pressed={explode} title="Separate every room, storey and the roof" onClick={() => {
        const next = !explode; setViewerMode('edit'); setExplode(next)
        const rooms = project.buildings.reduce((sum, building) => sum + building.spaces.length, 0)
        setToast(next ? `Exploded ${rooms} rooms across every level.` : 'Room explosion collapsed.')
      }}>Explode</button>
      <button onClick={onOpenClimate}>Climate</button>
      <button onClick={onOpenPlanting}>Planting</button>
      <button onClick={onOpenMcpTools}>MCP Tools</button>
      <button className="report-button" disabled={busy} onClick={generateReport}>{busy ? 'Rendering…' : 'Architectural set'}</button>
      <span className={`connection ${webMcp ? 'online' : ''}`}>{webMcp ? 'WebMCP ready' : 'local'}</span>
    </div>
  </header>
}

const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const dayPartColors: Record<ClimateDayPart, string> = { night: '#7d91c9', morning: '#e6bb68', day: '#e98245', evening: '#b58ac8' }

function ClimatePanel({ onClose }: { onClose: () => void }) {
  const project = useStudioStore((state) => state.project); const month = useStudioStore((state) => state.month); const setMonth = useStudioStore((state) => state.setMonth)
  const months = project.climateProfile.months; const selected = months.find((item) => item.month === month) ?? months[0]
  const temperatures = months.flatMap((item) => Object.values(item.temperatureByDayPartC))
  const minTemperature = Math.floor(Math.min(...temperatures) / 5) * 5; const maxTemperature = Math.ceil(Math.max(...temperatures) / 5) * 5
  const chart = { left: 48, right: 748, top: 16, bottom: 204 }; const range = Math.max(5, maxTemperature - minTemperature)
  const x = (index: number) => chart.left + index * ((chart.right - chart.left) / 11)
  const y = (temperature: number) => chart.bottom - ((temperature - minTemperature) / range) * (chart.bottom - chart.top)
  const ticks = Array.from({ length: Math.floor(range / 5) + 1 }, (_, index) => minTemperature + index * 5)
  return <section className="climate-panel" aria-label="Monthly temperature by part of day">
    <header><div><p className="eyebrow">CLIMATE / LOCAL TIME</p><h2>Temperature through the day</h2><small>Representative monthly averages · °C</small></div><button className="close" onClick={onClose} aria-label="Close climate panel">×</button></header>
    <div className="climate-body">
      <div className="climate-overview">
        <div className="climate-legend">{dayParts.map((part) => <span key={part.key}><i style={{ background: dayPartColors[part.key] }} />{part.label}<small>{part.hours}</small></span>)}</div>
        <svg className="climate-chart" viewBox="0 0 780 238" role="img" aria-label="Twelve-month line chart of night, morning, day and evening average temperatures">
          {ticks.map((tick) => <g key={tick}><line x1={chart.left} x2={chart.right} y1={y(tick)} y2={y(tick)} /><text x={chart.left - 9} y={y(tick) + 4}>{tick}°</text></g>)}
          {minTemperature <= 0 && maxTemperature >= 0 && <line className="zero-line" x1={chart.left} x2={chart.right} y1={y(0)} y2={y(0)} />}
          <rect className="month-focus" x={x(month - 1) - 22} y={chart.top} width="44" height={chart.bottom - chart.top} />
          {dayParts.map((part) => <polyline key={part.key} points={months.map((item, index) => `${x(index)},${y(item.temperatureByDayPartC[part.key])}`).join(' ')} fill="none" stroke={dayPartColors[part.key]} />)}
          {months.map((item, index) => <text key={item.month} className={item.month === month ? 'active' : ''} x={x(index)} y="228">{monthNames[index]}</text>)}
        </svg>
        <p className="climate-note">Day-part values are planning estimates derived from this profile’s monthly mean minimum and maximum temperatures. They are not hourly station observations.</p>
      </div>
      <aside className="climate-detail">
        <p className="eyebrow">{monthNames[selected.month - 1].toUpperCase()} / MONTH {selected.month}</p><h3>{project.climateProfile.name}</h3>
        <div className="daypart-readout">{dayParts.map((part) => <div key={part.key}><span><i style={{ background: dayPartColors[part.key] }} />{part.label}<small>{part.hours}</small></span><strong>{selected.temperatureByDayPartC[part.key].toFixed(1)}°</strong></div>)}</div>
        <dl className="climate-secondary"><div><dt>Mean range</dt><dd>{selected.meanMinC.toFixed(1)}° to {selected.meanMaxC.toFixed(1)}°</dd></div><div><dt>Rain</dt><dd>{selected.precipitationMm} mm</dd></div><div><dt>Sunshine</dt><dd>{selected.sunshineHours} h</dd></div><div><dt>Wind</dt><dd>{selected.windKph} km/h</dd></div></dl>
      </aside>
      <div className="climate-table-wrap"><table className="climate-table"><thead><tr><th>Month</th>{dayParts.map((part) => <th key={part.key}>{part.label}<small>{part.hours}</small></th>)}</tr></thead><tbody>{months.map((item, index) => <tr key={item.month} className={item.month === month ? 'active' : ''}><td><button onClick={() => setMonth(item.month)} aria-label={`Show ${monthNames[index]} climate in the scene`}>{monthNames[index]}</button></td>{dayParts.map((part) => <td key={part.key}>{item.temperatureByDayPartC[part.key].toFixed(1)}°</td>)}</tr>)}</tbody></table></div>
    </div>
  </section>
}

type PlantingFilter = 'productive' | 'landscape' | 'all'
const categoryLabels: Record<PlantingGuideCategory, string> = { structure: 'Structure', ornamental: 'Ornamental', vegetable: 'Vegetable', 'fruit-tree': 'Fruit tree' }
const categoryOrder: Record<PlantingGuideCategory, number> = { vegetable: 0, 'fruit-tree': 1, structure: 0, ornamental: 1 }

function PlantingGuidePanel({ onClose }: { onClose: () => void }) {
  const guide = useStudioStore((state) => state.project.site.knowledgeBase.planting); const [filter, setFilter] = useState<PlantingFilter>('productive')
  const recommendations = guide.recommendations.filter((plant) => filter === 'all' || (filter === 'productive' ? plant.category === 'vegetable' || plant.category === 'fruit-tree' : plant.category === 'structure' || plant.category === 'ornamental')).sort((a, b) => categoryOrder[a.category] - categoryOrder[b.category])
  return <section className="planting-panel" aria-label="Planting guide and soil analysis">
    <header><div><p className="eyebrow">SITE / PLANTING GUIDE</p><h2>Planting and soil</h2><small>{guide.recommendations.length} recommendations · evidence-linked planning guidance</small></div><button className="close" onClick={onClose} aria-label="Close planting guide">×</button></header>
    <div className="planting-body">
      <aside className="soil-analysis">
        <p className="eyebrow">SOIL ANALYSIS</p><h3>Known ground conditions</h3><p className="soil-summary">{guide.soilAnalysis.summary}</p>
        <div className="soil-findings">{guide.soilAnalysis.findings.map((finding) => <section key={finding.ref}><header><strong>{finding.label}</strong><span className={finding.confidence}>{finding.confidence}</span></header><p>{finding.observed}</p><small>{finding.plantingImplication}</small></section>)}</div>
        <div className="soil-actions"><h4>Tests before planting</h4><ol>{guide.soilAnalysis.testsNeeded.map((item) => <li key={item.test}><strong>{item.test}</strong><span>{item.reason}</span></li>)}</ol><h4>Preparation principles</h4><ul>{guide.soilAnalysis.preparation.map((item) => <li key={item}>{item}</li>)}</ul></div>
      </aside>
      <div className="planting-catalog">
        <div className="catalog-controls"><div><p className="eyebrow">PLANT CATALOG</p><h3>{filter === 'productive' ? 'Food crops and orchard' : filter === 'landscape' ? 'Landscape planting' : 'All recommendations'}</h3></div><div className="guide-tabs" role="group" aria-label="Planting guide filter"><button className={filter === 'productive' ? 'active' : ''} onClick={() => setFilter('productive')}>Productive</button><button className={filter === 'landscape' ? 'active' : ''} onClick={() => setFilter('landscape')}>Landscape</button><button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>All</button></div></div>
        <div className="plant-list">{recommendations.map((plant) => <article key={plant.ref}>
          <div className="plant-title"><span className="plant-index">{categoryLabels[plant.category]}</span><div><h4>{plant.commonName}</h4><em>{plant.botanicalName}</em></div><span className={`fit ${plant.priority}`}>{plant.priority === 'best-fit' ? 'Best fit' : 'Conditional'}</span></div>
          <p>{plant.siteFit}</p><p className="plant-placement"><strong>Placement</strong>{plant.placement}</p>
          <dl><div><dt>Light</dt><dd>{plant.sunNeed}</dd></div><div><dt>Moisture</dt><dd>{plant.preferredMoisture}</dd></div><div><dt>Hardiness</dt><dd>{plant.minHardinessC}°C</dd></div>{plant.plantingWindow && <div><dt>Plant</dt><dd>{plant.plantingWindow}</dd></div>}{plant.harvestWindow && <div><dt>Harvest</dt><dd>{plant.harvestWindow}</dd></div>}</dl>
          <small className="plant-caution">{plant.caution}</small>
        </article>)}</div>
      </div>
    </div>
  </section>
}

type ToolDetailTab = 'prompt' | 'input' | 'example' | 'result'
const prettyJson = (value: unknown) => JSON.stringify(value, null, 2)

function McpToolsPanel({ onClose }: { onClose: () => void }) {
  const [manifest, setManifest] = useState<WebMcpManifest | null>(null); const [error, setError] = useState<string | null>(null); const [query, setQuery] = useState(''); const [selectedName, setSelectedName] = useState<string | null>(null); const [tab, setTab] = useState<ToolDetailTab>('prompt')
  useEffect(() => {
    const controller = new AbortController()
    fetch(`${import.meta.env.BASE_URL}webmcp-tools.json`, { signal: controller.signal }).then((response) => {
      if (!response.ok) throw new Error(`Manifest request failed with ${response.status}.`)
      return response.json() as Promise<WebMcpManifest>
    }).then((value) => { setManifest(value); setSelectedName(value.tools[0]?.name ?? null) }).catch((reason: unknown) => { if (!(reason instanceof DOMException && reason.name === 'AbortError')) setError(reason instanceof Error ? reason.message : 'Manifest could not be loaded.') })
    return () => controller.abort()
  }, [])
  const normalized = query.trim().toLowerCase()
  const tools = manifest?.tools.filter((tool) => !normalized || `${tool.name} ${tool.title} ${tool.description}`.toLowerCase().includes(normalized)) ?? []
  const selected = tools.find((tool) => tool.name === selectedName) ?? tools[0] ?? null
  const choose = (name: string) => { setSelectedName(name); setTab('prompt') }
  return <section className="mcp-tools-panel" aria-label="WebMCP tool catalog">
    <header><div><p className="eyebrow">GENERATED MANIFEST / WEBMCP</p><h2>MCP Tools</h2><small>{manifest ? `${manifest.toolCount} registered tools · runtime Zod schemas` : 'Loading generated manifest…'}</small></div><div className="mcp-header-actions"><a href={`${import.meta.env.BASE_URL}webmcp-tools.json`} target="_blank" rel="noreferrer">Open JSON</a><button className="close" onClick={onClose} aria-label="Close MCP tools">×</button></div></header>
    {error ? <div className="manifest-error"><strong>Manifest unavailable</strong><p>{error}</p></div> : <div className="mcp-tools-body">
      <aside className="tool-browser"><label htmlFor="tool-search">Search tools</label><input id="tool-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, title or prompt text" autoFocus /><div className="tool-count">{tools.length} of {manifest?.toolCount ?? 0}</div><nav aria-label="WebMCP tools">{tools.map((tool) => <button key={tool.name} className={selected?.name === tool.name ? 'active' : ''} onClick={() => choose(tool.name)}><span>{tool.title}</span><code>{tool.name}</code><small className={tool.readOnly ? 'read-only' : 'mutating'}>{tool.readOnly ? 'Read only' : 'Creates or changes state'}</small></button>)}</nav></aside>
      <article className="tool-detail">{selected ? <>
        <header><div><span className={selected.readOnly ? 'read-only' : 'mutating'}>{selected.readOnly ? 'READ ONLY' : 'STATEFUL'}</span><h3>{selected.title}</h3><code>{selected.name}</code></div><nav aria-label="Tool detail sections">{(['prompt', 'input', 'example', 'result'] as const).map((value) => <button key={value} className={tab === value ? 'active' : ''} onClick={() => setTab(value)}>{value === 'input' ? 'Input schema' : value === 'result' ? 'Result shape' : value}</button>)}</nav></header>
        <div className="tool-document">{tab === 'prompt' ? <><p className="tool-intro">Complete registered description, assembled from the structured role, task, input, tools, output and example-output blocks.</p><pre>{selected.description}</pre></> : <><p className="tool-intro">{tab === 'input' ? 'Draft-7 JSON Schema generated from the exact Zod schema used during tool execution.' : tab === 'example' ? 'Valid example arguments extracted from the prompt definition.' : 'Documented JSON result contract for successful execution.'}</p><pre>{prettyJson(tab === 'input' ? selected.inputSchema : tab === 'example' ? selected.exampleInput : selected.resultShape)}</pre></>}</div>
      </> : <div className="no-tools"><strong>No matching tools</strong><p>Try a broader name or prompt term.</p></div>}</article>
    </div>}
  </section>
}

function GardenFixturesPanel({ onClose }: { onClose: () => void }) {
  const project = useStudioStore((state) => state.project); const commitCommand = useStudioStore((state) => state.commitCommand); const commitCommands = useStudioStore((state) => state.commitCommands); const setSelectedRef = useStudioStore((state) => state.setSelectedRef); const setToast = useStudioStore((state) => state.setToast); const focusGardenFixtures = useStudioStore((state) => state.focusGardenFixtures)
  const placeOne = (catalogId: GardenFixtureCatalogId) => {
    const count = project.landscape.fixtures.filter((fixture) => fixture.catalogId === catalogId).length + 1
    const fixtureRef = `fixture/${catalogId}-${count}`
    try {
      commitCommand({ type: 'garden-fixture.update', action: 'add', fixtureRef, catalogId, position: nextFixturePosition(project) })
      setSelectedRef(fixtureRef)
      window.setTimeout(focusGardenFixtures, 0)
    } catch (error) { setToast(error instanceof Error ? error.message : 'Fixture could not be placed.') }
  }
  const placeStarter = () => {
    const setNumber = project.landscape.fixtures.filter((fixture) => fixture.ref.startsWith('fixture-set/starter-')).reduce((max, fixture) => Math.max(max, Number(fixture.ref.match(/starter-(\d+)/)?.[1] ?? 0)), 0) + 1
    const setRef = `fixture-set/starter-${setNumber}`; const origin = { x: 8.4, z: 5.5 + (setNumber - 1) * 2.65 }
    try {
      const commands = starterGardenCommands(setRef, origin)
      commitCommands(commands, 'Starter kitchen garden placed.')
      setSelectedRef(commands[0]?.fixtureRef ?? null)
      window.setTimeout(focusGardenFixtures, 0)
    } catch (error) { setToast(error instanceof Error ? error.message : 'Starter garden could not be placed.') }
  }
  const structures = gardenFixtureCatalog.filter((item) => item.category === 'structure'); const crops = gardenFixtureCatalog.filter((item) => item.category === 'crop')
  const viewPlaced = () => { onClose(); window.setTimeout(focusGardenFixtures, 0) }
  const fixtureRows = (items: typeof gardenFixtureCatalog) => items.map((item) => <article className="fixture-row" key={item.id}>
    <span className={`fixture-thumb ${item.id}`} aria-hidden="true"><i /><i /><i /><i /></span>
    <div><h3>{item.name}</h3><p>{item.description}</p><small>{item.widthM.toFixed(1)} × {item.depthM.toFixed(1)} m · {project.landscape.fixtures.filter((fixture) => fixture.catalogId === item.id).length} placed</small></div>
    <button onClick={() => placeOne(item.id)}>Add</button>
  </article>)
  return <section className="garden-fixtures-panel" aria-label="Garden fixture library">
    <header><div><p className="eyebrow">SEMANTIC GARDEN / FIXTURES</p><h2>Garden fixtures</h2><small>{project.landscape.fixtures.length} placed · shared by editor and WebMCP</small></div><button className="close" onClick={onClose} aria-label="Close garden fixtures">×</button></header>
    <div className="fixture-starter"><div><span>READY SET</span><h3>Starter kitchen garden</h3><p>Three raised beds with tomatoes, potatoes and a cucumber trellis.</p></div><div className="fixture-starter-actions"><button onClick={viewPlaced}>View placed</button><button onClick={placeStarter}>Place another set</button></div></div>
    <div className="fixture-library"><section><h2>Structures</h2>{fixtureRows(structures)}</section><section><h2>Standard crops</h2>{fixtureRows(crops)}</section></div>
    <footer><span>WebMCP</span><code>list_garden_fixtures</code><code>propose_garden_fixture_set</code></footer>
  </section>
}

function Inspector() {
  const project = useStudioStore((state) => state.project); const selectedRef = useStudioStore((state) => state.selectedRef); const issues = useStudioStore((state) => state.variants)
  const useModernBarnPreset = useStudioStore((state) => state.useModernBarnPreset)
  const metrics = calculateMetrics(project); const building = project.buildings.find((item) => item.ref === selectedRef); const fixture = project.landscape.fixtures.find((item) => item.ref === selectedRef)
  const modernBarnActive = isModernBarnPreset(project)
  return <aside className="inspector">
    <p className="eyebrow">PROJECTV2 / SEMANTIC MODEL</p>
    <h2>{building?.name ?? fixture?.name ?? (selectedRef ? selectedRef.split('/').at(-1) : 'Project overview')}</h2>
    <p className="muted">{selectedRef ?? 'Select a wall, shared slab, space, roof, landscape zone or plant.'}</p>
    {building && <dl className="readout"><div><dt>Position</dt><dd>{building.position.x.toFixed(2)}, {building.position.z.toFixed(2)} m</dd></div><div><dt>Rotation</dt><dd>{building.rotationDegrees.toFixed(1)}°</dd></div><div><dt>Storeys</dt><dd>{building.storeys.length}</dd></div></dl>}
    {fixture && <dl className="readout"><div><dt>Fixture</dt><dd>{fixture.catalogId}</dd></div><div><dt>Position</dt><dd>{fixture.position.x.toFixed(2)}, {fixture.position.z.toFixed(2)} m</dd></div><div><dt>Rotation</dt><dd>{fixture.rotationDegrees.toFixed(1)}°</dd></div></dl>}
    <section className="house-presets"><h3>House preset</h3><button className={modernBarnActive ? 'active' : ''} onClick={() => useModernBarnPreset()}><span>Modern barn</span><small>2 levels · 45° gable</small><b>{modernBarnActive ? 'ACTIVE' : 'USE'}</b></button></section>
    <div className="metric-grid"><div><span>Home</span><strong>{metrics.homeAreaM2.toFixed(0)} m²</strong></div><div><span>Green</span><strong>{metrics.greenAreaM2.toFixed(0)} m²</strong></div><div><span>Plants</span><strong>{metrics.plantCount}</strong></div><div><span>Fixtures</span><strong>{metrics.fixtureCount}</strong></div></div>
    <section className="model-tree"><h3>Buildings</h3>{project.buildings.map((item) => <button key={item.ref} onClick={() => useStudioStore.getState().setSelectedRef(item.ref)}><span>{item.name}</span><small>{item.storeys.length} storey</small></button>)}</section>
    <p className="muted footer-note">{issues.length} ghost variant{issues.length === 1 ? '' : 's'} · local metres · north {project.site.northDegrees.toFixed(1)}°</p>
  </aside>
}

function ReportPanel() {
  const report = useStudioStore((state) => state.structureReport); const setReport = useStudioStore((state) => state.setStructureReport); const [selected, setSelected] = useState(0)
  useEffect(() => setSelected(0), [report?.ref])
  if (!report) return null
  const view = report.views[selected] ?? report.views[0]
  return <section className="report-panel" aria-label="Architectural structure report">
    <header><div><p className="eyebrow">VISIBLE-IN-PAGE REPORT</p><h2>Architectural set</h2><small>{report.views.length} drawings · project r{report.projectRevision}</small></div><button className="close" onClick={() => setReport(null)} aria-label="Close report">×</button></header>
    <div className="report-body">
      <div className="thumbs">{report.views.map((item, index) => <button key={`${item.type}-${index}`} className={selected === index ? 'active' : ''} onClick={() => setSelected(index)}><img src={item.imageUrl} alt={item.title} /><span>{item.title}</span></button>)}</div>
      <div className="drawing"><img src={view.imageUrl} alt={view.title} /><div><strong>{view.title}</strong><span>960 × 640 · ephemeral view</span></div></div>
      <div className="placement"><h3>Building placement</h3><table><thead><tr><th>Building</th><th>X / Z</th><th>Rotation</th><th>W × D × H</th><th>Base</th></tr></thead><tbody>{report.buildings.map((item) => <tr key={item.ref}><td>{item.name}<small>{item.ref}</small></td><td>{item.positionM.x.toFixed(2)} / {item.positionM.z.toFixed(2)} m</td><td>{item.rotationDegrees.toFixed(1)}°</td><td>{item.widthM.toFixed(2)} × {item.depthM.toFixed(2)} × {item.heightM.toFixed(2)} m</td><td>{item.baseElevationM.toFixed(2)} m</td></tr>)}</tbody></table></div>
    </div>
  </section>
}

function VariantApproval() {
  const ref = useStudioStore((state) => state.confirmationVariantRef); if (!ref) return null
  return <div className="approval"><p className="eyebrow">GHOST VARIANT</p><h2>Apply this spatial change?</h2><p>Review the translucent proposal in the scene.</p><div><button className="report-button" onClick={() => resolveVariantConfirmation(true)}>Apply variant</button><button onClick={() => resolveVariantConfirmation(false)}>Reject</button></div></div>
}

export function App() {
  const project = useStudioStore((state) => state.project); const toast = useStudioStore((state) => state.toast); const hydrated = useStudioStore((state) => state.hydrated); const viewerMode = useStudioStore((state) => state.viewerMode); const explode = useStudioStore((state) => state.explodeStoreys)
  const replaceProject = useStudioStore((state) => state.replaceProject); const setHydrated = useStudioStore((state) => state.setHydrated); const setToast = useStudioStore((state) => state.setToast); const undo = useStudioStore((state) => state.undo)
  const refocusCamera = useStudioStore((state) => state.refocusCamera)
  const focusGardenFixtures = useStudioStore((state) => state.focusGardenFixtures)
  const [dataPanel, setDataPanel] = useState<'climate' | 'planting' | 'fixtures' | 'mcp-tools' | null>(null)
  useEffect(() => { let active = true; loadProject().then((saved) => { if (active && saved) replaceProject(ensureStarterGarden(applyModernBarnPreset(saved))) }).catch(() => setToast('ProjectV2 autosave could not be restored.')).finally(() => { if (active) setHydrated(true) }); return () => { active = false } }, [replaceProject, setHydrated, setToast])
  useEffect(() => { if (!hydrated) return; const timer = window.setTimeout(() => saveProject(project).catch(() => setToast('ProjectV2 autosave failed.')), 350); return () => window.clearTimeout(timer) }, [project, hydrated, setToast])
  useEffect(() => registerWebMcpTools(), [])
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(null), 4200); return () => window.clearTimeout(timer) }, [setToast, toast])
  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); try { undo() } catch (error) { setToast(error instanceof Error ? error.message : 'Undo failed.') } }
      if (event.key === 'Escape') { useStudioStore.getState().setViewerMode('edit'); useStudioStore.getState().setSelectedRef(null); setDataPanel(null) }
    }
    window.addEventListener('keydown', keyboard); return () => window.removeEventListener('keydown', keyboard)
  }, [setToast, undo])
  useEffect(() => () => useStudioStore.getState().setStructureReport(null), [])
  return <main aria-label="ProjectV2 spatial planning workspace"><Toolbar onOpenClimate={() => setDataPanel('climate')} onOpenPlanting={() => setDataPanel('planting')} onOpenMcpTools={() => setDataPanel('mcp-tools')} /><Inspector />
    <div className="viewport"><Canvas shadows dpr={[1, 2]} camera={{ position: [29, 23, 32], fov: 38, near: 0.1, far: 1200 }} gl={{ antialias: true, alpha: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' }} onCreated={({ gl }) => { gl.outputColorSpace = SRGBColorSpace; gl.toneMapping = ACESFilmicToneMapping; gl.toneMappingExposure = 1.08; gl.shadowMap.type = PCFSoftShadowMap; gl.domElement.setAttribute('role', 'application'); gl.domElement.setAttribute('aria-label', 'Interactive ProjectV2 spatial editor'); gl.domElement.tabIndex = 0 }}><Suspense fallback={null}><StudioScene /></Suspense></Canvas>
      <button className="refocus-button" onClick={refocusCamera} aria-label="Refocus on Main house">
        <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" /><circle cx="12" cy="12" r="3.25" /></svg>
        <span>Refocus building</span>
      </button>
      <button className="fixtures-button" onClick={() => { const opening = dataPanel !== 'fixtures'; setDataPanel(opening ? 'fixtures' : null); if (opening) focusGardenFixtures() }} aria-label="Open garden fixtures"><span>Garden fixtures</span><small>{project.landscape.fixtures.length} placed</small></button>
      <div className="navigation-hint" aria-label="Garden navigation controls"><span>Move across garden</span><kbd>←</kbd><kbd>↑</kbd><kbd>↓</kbd><kbd>→</kbd><i>or hold wheel + drag</i></div>
      {(viewerMode === 'measure-length' || viewerMode === 'measure-area') && <section className="measurement-guide" aria-label={`${viewerMode === 'measure-length' ? 'Length' : 'Area'} measurement instructions`}>
        <span>{viewerMode === 'measure-length' ? 'LENGTH' : 'AREA'}</span>
        <strong>{viewerMode === 'measure-length' ? 'Click point 1, then point 2' : 'Hold and drag a rectangle on the ground'}</strong>
        <button onClick={() => window.dispatchEvent(new Event(CLEAR_MEASUREMENT_EVENT))}>Clear</button>
      </section>}
      {explode && <section className="explode-guide" aria-label="Exploded room view">
        <span>EXPLODED ROOMS</span>
        <strong>{project.buildings.reduce((sum, building) => sum + building.spaces.length, 0)} rooms · {project.buildings.reduce((sum, building) => sum + building.storeys.length, 0)} levels · roof separated</strong>
      </section>}
      <div className="land-legend" aria-label="Land-use legend"><span><i className="construction" />House land</span><span><i className="garden" />Garden / agricultural land</span></div>
    </div>
    {dataPanel === 'climate' && <ClimatePanel onClose={() => setDataPanel(null)} />}{dataPanel === 'planting' && <PlantingGuidePanel onClose={() => setDataPanel(null)} />}{dataPanel === 'fixtures' && <GardenFixturesPanel onClose={() => setDataPanel(null)} />}{dataPanel === 'mcp-tools' && <McpToolsPanel onClose={() => setDataPanel(null)} />}<ReportPanel /><VariantApproval />{toast && <div className="toast" role="status">{toast}</div>}
  </main>
}
