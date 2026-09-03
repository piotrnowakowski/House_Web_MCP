import { Canvas } from '@react-three/fiber'
import { Suspense, useEffect, useState } from 'react'
import { ACESFilmicToneMapping, PCFSoftShadowMap, SRGBColorSpace } from 'three'
import { dayParts } from './domain/climate'
import { calculateMetrics } from './domain/commands'
import { ensureStarterGarden, gardenFixtureCatalog, nextFixturePosition, starterGardenCommands } from './domain/gardenFixtures'
import { wallLength } from './domain/geometry'
import { applyModernBarnPreset, isModernBarnPreset } from './domain/presets'
import type { BuildingModel, ClimateDayPart, GardenFixtureCatalogId, HeightMeasureKind, PlantingGuideCategory, ProjectCommand, WallMaterial, WallModel } from './domain/types'
import { inferWallOpeningLayout, wallOpeningLayoutCommands, wallOpeningLayoutPresets, type WallOpeningLayoutPreset } from './domain/wallOpeningLayouts'
import { resolveWallFinish, wallFinishCatalog, wallFinishCommands, type WallFinishScope } from './domain/wallFinishes'
import { CLEAR_MEASUREMENT_EVENT, StudioScene } from './scene/StudioScene'
import { sunHoursColor } from './scene/sun'
import { solarPosition, sunriseSunset } from './domain/solar'
import { formatSunMoment } from './domain/sunlight'
import { loadProject, saveProject } from './services/persistence'
import { showStructureViews } from './services/structureViews'
import { registerWebMcpTools, resolveVariantConfirmation } from './services/webmcp'
import type { WebMcpManifest } from './services/webmcpDefinitions'
import { useStudioStore } from './state/store'

const modes = [
  ['edit', 'Edit'], ['measure-length', 'Length'], ['measure-area', 'Area'], ['measure-height', 'Height'], ['section', 'Section'], ['plan', 'Plan'],
] as const

const modeTitles = {
  edit: 'Select and move semantic objects',
  'measure-length': 'Click two points to measure the distance',
  'measure-area': 'Drag a rectangle across the ground to measure its area',
  'measure-height': 'Select a semantic object or Shift-click two points to measure vertically',
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
const promptText = (prompt: WebMcpManifest['tools'][number]['prompt']) => [
  `<role>\n${prompt.role}\n</role>`,
  `<task>\n${prompt.task}\n</task>`,
  `<input>\n${prompt.input}\n</input>`,
  `<tools>\n${prompt.tools}\n</tools>`,
  `<output>\n${prompt.output}\n</output>`,
  `<example_output>\n${prompt.exampleOutput}\n</example_output>`,
].join('\n\n')

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
  const tools = manifest?.tools.filter((tool) => !normalized || `${tool.name} ${tool.title} ${tool.description} ${promptText(tool.prompt)}`.toLowerCase().includes(normalized)) ?? []
  const selected = tools.find((tool) => tool.name === selectedName) ?? tools[0] ?? null
  const choose = (name: string) => { setSelectedName(name); setTab('prompt') }
  return <section className="mcp-tools-panel" aria-label="WebMCP tool catalog">
    <header><div><p className="eyebrow">GENERATED MANIFEST / WEBMCP</p><h2>MCP Tools</h2><small>{manifest ? `${manifest.toolCount} registered tools · runtime Zod schemas` : 'Loading generated manifest…'}</small></div><div className="mcp-header-actions"><a href={`${import.meta.env.BASE_URL}webmcp-tools.json`} target="_blank" rel="noreferrer">Open JSON</a><button className="close" onClick={onClose} aria-label="Close MCP tools">×</button></div></header>
    {error ? <div className="manifest-error"><strong>Manifest unavailable</strong><p>{error}</p></div> : <div className="mcp-tools-body">
      <aside className="tool-browser"><label htmlFor="tool-search">Search tools</label><input id="tool-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, title or prompt text" autoFocus /><div className="tool-count">{tools.length} of {manifest?.toolCount ?? 0}</div><nav aria-label="WebMCP tools">{tools.map((tool) => <button key={tool.name} className={selected?.name === tool.name ? 'active' : ''} onClick={() => choose(tool.name)}><span>{tool.title}</span><code>{tool.name}</code><small className={tool.readOnly ? 'read-only' : 'mutating'}>{tool.readOnly ? 'Read only' : 'Creates or changes state'}</small></button>)}</nav></aside>
      <article className="tool-detail">{selected ? <>
        <header><div><span className={selected.readOnly ? 'read-only' : 'mutating'}>{selected.readOnly ? 'READ ONLY' : 'STATEFUL'}</span><h3>{selected.title}</h3><code>{selected.name}</code></div><nav aria-label="Tool detail sections">{(['prompt', 'input', 'example', 'result'] as const).map((value) => <button key={value} className={tab === value ? 'active' : ''} onClick={() => setTab(value)}>{value === 'input' ? 'Input schema' : value === 'result' ? 'Result shape' : value}</button>)}</nav></header>
        <div className="tool-document">{tab === 'prompt' ? <><p className="tool-intro">Complete structured role, task, input, tools, output and example-output contract. Runtime registration uses its concise task block as the tool description.</p><pre>{promptText(selected.prompt)}</pre></> : <><p className="tool-intro">{tab === 'input' ? 'Draft-7 JSON Schema generated from the exact Zod schema used during tool execution.' : tab === 'example' ? 'Valid example arguments extracted from the prompt definition.' : 'Documented JSON result contract for successful execution.'}</p><pre>{prettyJson(tab === 'input' ? selected.inputSchema : tab === 'example' ? selected.exampleInput : selected.resultShape)}</pre></>}</div>
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

const wallLabel = (wall: WallModel) => wall.ref.split('/').at(-1)?.replaceAll('-', ' ') ?? 'wall'

const nextOpeningSlot = (wall: WallModel) => {
  const length = wallLength(wall); const edge = 0.3
  const intervals = wall.openings.map((opening) => ({ start: opening.offsetM - opening.widthM / 2, end: opening.offsetM + opening.widthM / 2 })).sort((a, b) => a.start - b.start)
  const gaps = [{ start: edge, end: intervals[0]?.start ?? length - edge }, ...intervals.map((interval, index) => ({ start: interval.end, end: intervals[index + 1]?.start ?? length - edge }))]
  const gap = gaps.sort((a, b) => (b.end - b.start) - (a.end - a.start))[0]
  const available = Math.max(0, gap.end - gap.start); const widthM = Math.min(1.8, available - 0.3)
  if (widthM < 0.6) throw new Error('This wall has no clear space for another window.')
  return { offsetM: (gap.start + gap.end) / 2, widthM }
}

function WallFinishEditor({ building, wall }: { building: BuildingModel; wall: WallModel }) {
  const project = useStudioStore((state) => state.project); const commitCommands = useStudioStore((state) => state.commitCommands); const setSelectedRef = useStudioStore((state) => state.setSelectedRef); const setToast = useStudioStore((state) => state.setToast)
  const current = resolveWallFinish(wall, building.architecturalStyle); const [material, setMaterial] = useState<WallMaterial>(current.material); const [colorHex, setColorHex] = useState(current.colorHex)
  useEffect(() => { const next = resolveWallFinish(wall, building.architecturalStyle); setMaterial(next.material); setColorHex(next.colorHex) }, [building.architecturalStyle, wall.finish, wall.ref])
  const chooseMaterial = (next: WallMaterial) => { const definition = wallFinishCatalog.find((item) => item.id === next)!; setMaterial(next); setColorHex(definition.defaultColor) }
  const applyFinish = (scope: WallFinishScope) => {
    try {
      const commands = wallFinishCommands(project, { buildingRef: building.ref, scope, wallRef: wall.ref, material, colorHex })
      commitCommands(commands, `${wallFinishCatalog.find((item) => item.id === material)?.label ?? 'Wall finish'} applied to ${scope === 'wall' ? 'selected wall' : 'all exterior walls'}. Ctrl+Z to undo.`)
      setSelectedRef(wall.ref)
    } catch (error) { setToast(error instanceof Error ? error.message : 'Wall finish could not be applied.') }
  }
  const validColor = /^#[0-9a-fA-F]{6}$/.test(colorHex)
  return <section className="wall-finish-editor" aria-label={`Wall finish for ${wallLabel(wall)}`}>
    <header><div><h3>Wall finish</h3><small>Opaque material · selected or all exterior walls</small></div><span className="finish-current" style={{ backgroundColor: validColor ? colorHex : current.colorHex }} /></header>
    <div className="finish-materials" role="group" aria-label="Wall material">{wallFinishCatalog.map((item) => <button key={item.id} className={material === item.id ? 'active' : ''} aria-pressed={material === item.id} onClick={() => chooseMaterial(item.id)}><i style={{ backgroundColor: item.defaultColor }} /><span><strong>{item.label}</strong><small>{item.description}</small></span></button>)}</div>
    <div className="finish-color"><label><span>Custom color</span><input type="color" value={validColor ? colorHex : current.colorHex} onChange={(event) => setColorHex(event.target.value.toUpperCase())} aria-label="Wall color picker" /></label><input type="text" value={colorHex} onChange={(event) => setColorHex(event.target.value)} pattern="#[0-9a-fA-F]{6}" aria-label="Wall color hex" /></div>
    <div className="finish-actions"><button className="save-finish" disabled={!validColor} onClick={() => applyFinish('wall')}>Apply to this wall</button><button disabled={!validColor} onClick={() => applyFinish('all-exterior')}>Apply to all exterior</button></div>
  </section>
}

function OpeningEditor({ building, wall, selectedRef }: { building: BuildingModel; wall: WallModel; selectedRef: string | null }) {
  const project = useStudioStore((state) => state.project); const commitCommand = useStudioStore((state) => state.commitCommand); const commitCommands = useStudioStore((state) => state.commitCommands); const setSelectedRef = useStudioStore((state) => state.setSelectedRef); const setToast = useStudioStore((state) => state.setToast)
  const activeLayout = inferWallOpeningLayout(wall)
  const applyLayout = (preset: WallOpeningLayoutPreset) => {
    if (activeLayout === preset) { setToast(`This wall already uses ${wallOpeningLayoutPresets.find((item) => item.id === preset)?.label.toLowerCase()}.`); return }
    try {
      commitCommands(wallOpeningLayoutCommands(project, building.ref, wall.ref, preset), `${wallOpeningLayoutPresets.find((item) => item.id === preset)?.label ?? 'Façade'} applied. Ctrl+Z to undo.`)
      setSelectedRef(wall.ref)
    } catch (error) { setToast(error instanceof Error ? error.message : 'Façade layout could not be applied.') }
  }
  const saveOpening = (event: React.FormEvent<HTMLFormElement>, openingRef: string) => {
    event.preventDefault(); const values = new FormData(event.currentTarget); const number = (name: string) => Number(values.get(name))
    try {
      commitCommand({ type: 'opening.update', action: 'resize', buildingRef: building.ref, wallRef: wall.ref, openingRef, offsetM: number('offsetM'), widthM: number('widthM'), heightM: number('heightM'), sillM: number('sillM') })
      setSelectedRef(openingRef); setToast('Opening dimensions updated. Ctrl+Z to undo.')
    } catch (error) { setToast(error instanceof Error ? error.message : 'Opening could not be updated.') }
  }
  const removeOpening = (openingRef: string) => {
    try {
      commitCommand({ type: 'opening.update', action: 'remove', buildingRef: building.ref, wallRef: wall.ref, openingRef })
      setSelectedRef(wall.ref); setToast('Opening removed and wall closed. Ctrl+Z to undo.')
    } catch (error) { setToast(error instanceof Error ? error.message : 'Opening could not be removed.') }
  }
  const addWindow = () => {
    try {
      const slot = nextOpeningSlot(wall); const sequence = building.walls.flatMap((item) => item.openings).filter((opening) => opening.ref.startsWith(`opening/${wall.ref.replace('wall/', '').replaceAll('/', '-')}-window-`)).length + 1
      const openingRef = `opening/${wall.ref.replace('wall/', '').replaceAll('/', '-')}-window-${sequence}`
      commitCommand({ type: 'opening.update', action: 'add', buildingRef: building.ref, wallRef: wall.ref, openingRef, kind: 'window', ...slot, heightM: 1.5, sillM: 0.8 })
      setSelectedRef(openingRef); setToast('Window added. Edit its dimensions below or press Ctrl+Z to undo.')
    } catch (error) { setToast(error instanceof Error ? error.message : 'Window could not be added.') }
  }
  return <section className="opening-editor" aria-label={`Openings on ${wallLabel(wall)}`} data-wall-ref={wall.ref}>
    <WallFinishEditor building={building} wall={wall} />
    <header><div><h3>Façade layout</h3><small>{wallLength(wall).toFixed(2)} m wall · {activeLayout === 'custom' ? 'custom openings' : wallOpeningLayoutPresets.find((item) => item.id === activeLayout)?.label}</small></div></header>
    <div className="facade-layouts" role="group" aria-label={`Façade layout for ${wallLabel(wall)}`}>{wallOpeningLayoutPresets.map((preset) => <button key={preset.id} className={activeLayout === preset.id ? 'active' : ''} aria-pressed={activeLayout === preset.id} onClick={() => applyLayout(preset.id)}>
      <span className={`facade-diagram ${preset.id}`} aria-hidden="true"><i /><i /></span><strong>{preset.label}</strong><small>{preset.description}</small>
    </button>)}</div>
    <div className="opening-detail-head"><div><h3>Fine controls</h3><small>{wall.openings.length} opening{wall.openings.length === 1 ? '' : 's'}</small></div><button className="add-opening" onClick={addWindow}>+ Window</button></div>
    {!wall.openings.length && <p className="empty-openings">This wall is solid. Add a window when needed.</p>}
    <div className="opening-list">{wall.openings.map((opening) => <form key={`${opening.ref}-${project.revision}`} className={selectedRef === opening.ref ? 'opening-row active' : 'opening-row'} onSubmit={(event) => saveOpening(event, opening.ref)} aria-label={`Edit opening ${opening.ref}`}>
      <button type="button" className="opening-name" onClick={() => setSelectedRef(opening.ref)}><span>{opening.kind}</span><strong>{opening.ref.split('/').at(-1)?.replaceAll('-', ' ')}</strong></button>
      <div className="opening-fields">
        <label><span>Position</span><input name="offsetM" type="number" min="0" max={wallLength(wall)} step="0.05" defaultValue={opening.offsetM} /></label>
        <label><span>Width</span><input name="widthM" type="number" min="0.2" step="0.05" defaultValue={opening.widthM} /></label>
        <label><span>Height</span><input name="heightM" type="number" min="0.2" step="0.05" defaultValue={opening.heightM} /></label>
        <label><span>Sill</span><input name="sillM" type="number" min="0" step="0.05" defaultValue={opening.sillM} /></label>
      </div>
      <div className="opening-actions"><button type="submit" className="save-opening">Save</button><button type="button" className="remove-opening" onClick={() => removeOpening(opening.ref)} aria-label={`Remove opening ${opening.ref}`}>Remove</button></div>
    </form>)}</div>
    <p className="opening-note"><span>Position</span> is measured from the wall’s start point. WebMCP uses these same opening references and metre values.</p>
  </section>
}

function Inspector() {
  const project = useStudioStore((state) => state.project); const selectedRef = useStudioStore((state) => state.selectedRef); const issues = useStudioStore((state) => state.variants)
  const useModernBarnPreset = useStudioStore((state) => state.useModernBarnPreset)
  const metrics = calculateMetrics(project); const building = project.buildings.find((item) => item.ref === selectedRef); const fixture = project.landscape.fixtures.find((item) => item.ref === selectedRef)
  const openingBuilding = project.buildings.find((item) => item.walls.some((wall) => wall.ref === selectedRef || wall.openings.some((opening) => opening.ref === selectedRef)))
  const selectedWall = openingBuilding?.walls.find((wall) => wall.ref === selectedRef || wall.openings.some((opening) => opening.ref === selectedRef))
  const selectedOpening = selectedWall?.openings.find((opening) => opening.ref === selectedRef)
  const exteriorWalls = project.buildings.flatMap((item) => item.walls.filter((wall) => item.spaces.filter((space) => space.boundary.some((boundary) => boundary.wallRef === wall.ref)).length <= 1))
  const selectedTitle = building?.name ?? fixture?.name ?? (selectedOpening ? `${selectedOpening.kind === 'window' ? 'Window' : 'Door'} opening` : selectedWall ? wallLabel(selectedWall) : selectedRef ? selectedRef.split('/').at(-1) : 'Project overview')
  const modernBarnActive = isModernBarnPreset(project)
  return <aside className="inspector">
    <p className="eyebrow">PROJECTV2 / SEMANTIC MODEL</p>
    <h2>{selectedTitle}</h2>
    <p className="muted">{selectedRef ?? 'Select a wall, shared slab, space, roof, landscape zone or plant.'}</p>
    {building && <dl className="readout"><div><dt>Position</dt><dd>{building.position.x.toFixed(2)}, {building.position.z.toFixed(2)} m</dd></div><div><dt>Rotation</dt><dd>{building.rotationDegrees.toFixed(1)}°</dd></div><div><dt>Storeys</dt><dd>{building.storeys.length}</dd></div></dl>}
    {fixture && <dl className="readout"><div><dt>Fixture</dt><dd>{fixture.catalogId}</dd></div><div><dt>Position</dt><dd>{fixture.position.x.toFixed(2)}, {fixture.position.z.toFixed(2)} m</dd></div><div><dt>Rotation</dt><dd>{fixture.rotationDegrees.toFixed(1)}°</dd></div></dl>}
    {selectedWall && openingBuilding ? <OpeningEditor building={openingBuilding} wall={selectedWall} selectedRef={selectedRef} /> : <>
      <section className="house-presets"><h3>House preset</h3><button className={modernBarnActive ? 'active' : ''} onClick={() => useModernBarnPreset()}><span>Modern barn</span><small>2 levels · 45° gable</small><b>{modernBarnActive ? 'ACTIVE' : 'USE'}</b></button></section>
      <div className="metric-grid"><div><span>Home</span><strong>{metrics.homeAreaM2.toFixed(0)} m²</strong></div><div><span>Green</span><strong>{metrics.greenAreaM2.toFixed(0)} m²</strong></div><div><span>Plants</span><strong>{metrics.plantCount}</strong></div><div><span>Fixtures</span><strong>{metrics.fixtureCount}</strong></div></div>
    </>}
    <section className="model-tree"><h3>Buildings</h3>{project.buildings.map((item) => <button key={item.ref} onClick={() => useStudioStore.getState().setSelectedRef(item.ref)}><span>{item.name}</span><small>{item.storeys.length} storey</small></button>)}</section>
    <section className="model-tree wall-tree"><h3>Exterior walls</h3>{exteriorWalls.map((wall) => <button key={wall.ref} className={selectedWall?.ref === wall.ref ? 'active' : ''} onClick={() => useStudioStore.getState().setSelectedRef(wall.ref)} aria-label={`Edit openings on ${wallLabel(wall)}`}><span>{wallLabel(wall)}</span><small>{wall.openings.length ? `${wall.openings.length} opening${wall.openings.length === 1 ? '' : 's'}` : 'solid'}</small></button>)}</section>
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

const commandAudit = (command: ProjectCommand) => {
  const refs = Object.entries(command).filter(([key, value]) => (key.endsWith('Ref') || key === 'plantingRef') && typeof value === 'string').map(([, value]) => value)
  if (command.type === 'planting-area.update') refs.push(command.metadata.plantingRef, `${command.plants.length} plants`)
  return `${command.type}${refs.length ? ` · ${refs.join(' · ')}` : ''}`
}

function VariantApproval() {
  const ref = useStudioStore((state) => state.confirmationVariantRef); const variant = useStudioStore((state) => state.variants.find((item) => item.ref === ref)); if (!ref || !variant) return null
  const blocking = variant.issues.filter((issue) => issue.severity === 'error')
  return <div className="approval"><p className="eyebrow">GHOST VARIANT / {variant.commands.length} OPERATION{variant.commands.length === 1 ? '' : 'S'}</p><h2>{variant.label}</h2><p>Review the translucent proposal and its combined impact before one atomic approval.</p>
    <dl><div><dt>Home area</dt><dd>{variant.metrics.homeAreaM2.toFixed(1)} m²</dd></div><div><dt>Plants</dt><dd>{variant.metrics.plantCount}</dd></div><div><dt>Fixtures</dt><dd>{variant.metrics.fixtureCount}</dd></div><div><dt>Validation</dt><dd>{blocking.length ? `${blocking.length} blocking` : 'Ready'}</dd></div></dl>
    <ol aria-label="Variant operation audit">{variant.commands.map((command, index) => <li key={index}><span>{index + 1}</span><code>{commandAudit(command)}</code></li>)}</ol>
    {variant.issues.length > 0 && <ul className="approval-issues">{variant.issues.map((issue, index) => <li key={`${issue.code}-${index}`} className={issue.severity}>{issue.severity}: {issue.message}</li>)}</ul>}
    <div className="approval-actions"><button className="report-button" disabled={blocking.length > 0} onClick={() => resolveVariantConfirmation(true)}>Apply complete variant</button><button onClick={() => resolveVariantConfirmation(false)}>Reject all</button></div></div>
}

const monthDays = (month: number) => new Date(Date.UTC(2026, month, 0)).getUTCDate()
const clockLabel = (hour: number) => { const minutes = Math.round(hour * 60); return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}` }

function SunWidget() {
  const project = useStudioStore((state) => state.project); const sunTime = useStudioStore((state) => state.sunTime); const setSunTime = useStudioStore((state) => state.setSunTime)
  const sunAnimation = useStudioStore((state) => state.sunAnimation); const setSunAnimation = useStudioStore((state) => state.setSunAnimation)
  const sunOverlay = useStudioStore((state) => state.sunOverlay); const setSunOverlay = useStudioStore((state) => state.setSunOverlay)
  const selectedRef = useStudioStore((state) => state.selectedRef); const viewMode = useStudioStore((state) => state.viewMode)
  const { latitude, longitude, timezone } = project.climateProfile
  const events = sunriseSunset({ latitude, longitude, timezone }, sunTime); const sun = solarPosition({ latitude, longitude, timezone }, sunTime)
  const min = events ? Math.floor(events.sunriseHour * 4) / 4 : 0; const max = events ? Math.ceil(events.sunsetHour * 4) / 4 : 24
  useEffect(() => {
    if (sunAnimation === 'none') return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const timer = window.setInterval(() => {
      const state = useStudioStore.getState(); const current = state.sunTime
      if (sunAnimation === 'day') {
        const bounds = sunriseSunset({ latitude, longitude, timezone }, current); const low = bounds ? bounds.sunriseHour : 0; const high = bounds ? bounds.sunsetHour : 24
        const next = current.hour + (reduced ? 1 : 0.25); state.setSunTime({ hour: next > high ? low : next })
      } else {
        const nextDay = current.day + (reduced ? 30 : 3); const days = monthDays(current.month)
        if (nextDay > days) state.setSunTime({ month: current.month === 12 ? 1 : current.month + 1, day: nextDay - days }); else state.setSunTime({ day: nextDay })
      }
    }, reduced ? 1000 : 120)
    return () => window.clearInterval(timer)
  }, [latitude, longitude, sunAnimation, timezone])
  const targetRef = project.landscape.zones.find((zone) => zone.ref === selectedRef)?.ref ?? 'site'
  const legendTop = sunOverlay.result ? Math.max(sunOverlay.result.sunHours.max, sunOverlay.result.daylightHours * 0.999) : 0
  return <section className="sun-widget" aria-label="Sun controls">
    <header><span className="eyebrow">SUN / LOCAL TIME</span><strong>{formatSunMoment(sunTime.month, sunTime.day, sunTime.hour)}</strong></header>
    <div className="sun-fields">
      <label><span>Month</span><select aria-label="Sun month" value={sunTime.month} onChange={(event) => setSunTime({ month: Number(event.target.value) })}>{monthNames.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}</select></label>
      <label><span>Day</span><input type="number" aria-label="Sun day" min={1} max={monthDays(sunTime.month)} value={sunTime.day} onChange={(event) => setSunTime({ day: Number(event.target.value) })} /></label>
    </div>
    <label className="sun-slider"><span>Local time</span><input type="range" aria-label="Local time" min={min} max={max} step={0.25} value={Math.min(max, Math.max(min, sunTime.hour))} onChange={(event) => setSunTime({ hour: Number(event.target.value) })} /><small>{events ? `${clockLabel(events.sunriseHour)} sunrise · ${clockLabel(events.sunsetHour)} sunset` : 'No sunrise or sunset on this date'}</small></label>
    <dl className="sun-readout"><div><dt>Altitude</dt><dd>{sun.altitudeDeg.toFixed(1)}°</dd></div><div><dt>Azimuth</dt><dd>{sun.azimuthDeg.toFixed(0)}°</dd></div><div><dt>Daylight</dt><dd>{events ? `${events.daylightHours.toFixed(1)} h` : '—'}</dd></div></dl>
    <div className="sun-actions">
      <button className={sunAnimation === 'day' ? 'active' : ''} aria-pressed={sunAnimation === 'day'} onClick={() => setSunAnimation(sunAnimation === 'day' ? 'none' : 'day')}>Play day</button>
      <button className={sunAnimation === 'year' ? 'active' : ''} aria-pressed={sunAnimation === 'year'} onClick={() => setSunAnimation(sunAnimation === 'year' ? 'none' : 'year')}>Play year</button>
      <button className={sunOverlay.enabled ? 'active' : ''} aria-pressed={sunOverlay.enabled} onClick={() => setSunOverlay({ enabled: !sunOverlay.enabled, targetRef, result: null })}>Sun hours</button>
    </div>
    {viewMode === 'technical' && <small className="sun-note">Technical mode keeps a neutral studio light; sun-hours analysis still uses the real sun.</small>}
    {sunOverlay.enabled && sunOverlay.result && <div className="sun-legend" aria-label="Sun hours legend">
      <i style={{ background: `linear-gradient(90deg, ${sunHoursColor(0)}, ${sunHoursColor(0.5)}, ${sunHoursColor(1)})` }} />
      <div><span>0 h</span><span>{legendTop.toFixed(1)} h direct sun</span></div>
      <small>{sunOverlay.targetRef ?? 'site'} · mean {sunOverlay.result.sunHours.mean.toFixed(1)} h · {sunOverlay.result.expectedSunHours.toFixed(1)} h expected after typical cloud</small>
    </div>}
  </section>
}

export function App() {
  const project = useStudioStore((state) => state.project); const toast = useStudioStore((state) => state.toast); const hydrated = useStudioStore((state) => state.hydrated); const viewerMode = useStudioStore((state) => state.viewerMode); const explode = useStudioStore((state) => state.explodeStoreys)
  const heightMeasureKind = useStudioStore((state) => state.heightMeasureKind); const setHeightMeasureKind = useStudioStore((state) => state.setHeightMeasureKind)
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
      {(viewerMode === 'measure-length' || viewerMode === 'measure-area' || viewerMode === 'measure-height') && <section className="measurement-guide" aria-label={`${viewerMode === 'measure-length' ? 'Length' : viewerMode === 'measure-area' ? 'Area' : 'Height'} measurement instructions`}>
        <span>{viewerMode === 'measure-length' ? 'LENGTH' : viewerMode === 'measure-area' ? 'AREA' : 'HEIGHT'}</span>
        <strong>{viewerMode === 'measure-length' ? 'Click point 1, then point 2' : viewerMode === 'measure-area' ? 'Hold and drag a rectangle on the ground' : 'Select an object · Shift-click twice for free vertical'}</strong>
        {viewerMode === 'measure-height' && <select aria-label="Height reference" value={heightMeasureKind} onChange={(event) => setHeightMeasureKind(event.target.value as HeightMeasureKind)}><option value="auto">Object height</option><option value="ground-to-eaves">Ground to eaves</option><option value="ground-to-ridge">Ground to ridge</option><option value="clear-height">Storey clear height</option><option value="opening-height">Opening height</option><option value="terrain-clearance">Terrain clearance</option></select>}
        <button onClick={() => window.dispatchEvent(new Event(CLEAR_MEASUREMENT_EVENT))}>Clear</button>
      </section>}
      {explode && <section className="explode-guide" aria-label="Exploded room view">
        <span>EXPLODED ROOMS</span>
        <strong>{project.buildings.reduce((sum, building) => sum + building.spaces.length, 0)} rooms · {project.buildings.reduce((sum, building) => sum + building.storeys.length, 0)} levels · roof separated</strong>
      </section>}
      <SunWidget />
      <div className="land-legend" aria-label="Land-use legend"><span><i className="construction" />House land</span><span><i className="garden" />Garden / agricultural land</span><span><i className="entrance" />Road entrance</span></div>
    </div>
    {dataPanel === 'climate' && <ClimatePanel onClose={() => setDataPanel(null)} />}{dataPanel === 'planting' && <PlantingGuidePanel onClose={() => setDataPanel(null)} />}{dataPanel === 'fixtures' && <GardenFixturesPanel onClose={() => setDataPanel(null)} />}{dataPanel === 'mcp-tools' && <McpToolsPanel onClose={() => setDataPanel(null)} />}<ReportPanel /><VariantApproval />{toast && <div className="toast" role="status">{toast}</div>}
  </main>
}
