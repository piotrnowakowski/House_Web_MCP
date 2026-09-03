import { beforeEach, describe, expect, it } from 'vitest'
import { webMcpToolPrompts } from '../../prompts/webmcp-tools'
import { modernBarnProject, sampleProject } from '../domain/sampleProject'
import { useStudioStore } from '../state/store'
import { expandStructureViews, registerStructureViewCapture } from './structureViews'
import { resolveVariantConfirmation, webMcpTools } from './webmcp'
import { webMcpManifest } from './webmcpDefinitions'

const tool = (name: string) => webMcpTools.find((item) => item.name === name)!
const payload = (result: WebMcpToolResult) => JSON.parse(result.content[0].text)

beforeEach(() => useStudioStore.setState({ project: structuredClone(sampleProject), history: [], variants: [], selectedRef: 'space/living', confirmationVariantRef: null, structureReport: null }))

describe('ProjectV2 WebMCP surface', () => {
  it('publishes the prompt-aligned V2 tool catalog without export or V1 nouns', () => {
    expect(webMcpTools.map((item) => item.name)).toEqual(Object.values(webMcpToolPrompts).map((prompt) => prompt.name))
    expect(new Set(webMcpTools.map((item) => item.name)).size).toBe(webMcpTools.length)
    expect(webMcpTools.some((item) => /floor|room|export/.test(item.name))).toBe(false)
    expect(tool('show_structure_views').annotations?.readOnlyHint).toBe(true)
    expect(tool('list_garden_fixtures').annotations?.readOnlyHint).toBe(true)
    for (const item of webMcpTools) {
      const prompt = Object.values(webMcpToolPrompts).find((candidate) => candidate.name === item.name)!
      expect(item.description).toBe(prompt.runtimeDescription)
      expect(item.description.length).toBeLessThanOrEqual(500)
    }
    for (const prompt of Object.values(webMcpToolPrompts)) {
      expect(['<role>', '<task>', '<input>', '<tools>', '<output>', '<example_output>'].every((tag) => prompt.description.includes(tag))).toBe(true)
    }
  })

  it('describes every root parameter of every tool within the 150-character budget', () => {
    for (const item of webMcpTools) {
      const properties = (item.inputSchema?.properties ?? {}) as Record<string, { description?: string }>
      for (const [name, property] of Object.entries(properties)) {
        expect(property.description, `${item.name}.${name}`).toBeTruthy()
        expect(property.description!.length, `${item.name}.${name}`).toBeLessThanOrEqual(150)
      }
    }
  })

  it('registers every tool with an object root schema so agent browsers can render its parameters', () => {
    for (const item of webMcpTools) expect(item.inputSchema?.type, item.name).toBe('object')
  })

  it('generates a complete inspectable manifest from runtime schemas and structured prompts', () => {
    expect(webMcpManifest.toolCount).toBe(webMcpTools.length)
    expect(webMcpManifest.tools.map((item) => item.name)).toEqual(webMcpTools.map((item) => item.name))
    for (const manifestTool of webMcpManifest.tools) {
      const runtimeTool = tool(manifestTool.name)
      expect(manifestTool.description).toBe(runtimeTool.description)
      expect(manifestTool.inputSchema).toEqual(runtimeTool.inputSchema)
      expect(manifestTool.prompt).toEqual(webMcpToolPrompts[manifestTool.name].blocks)
      expect(manifestTool.exampleInput).toEqual(webMcpToolPrompts[manifestTool.name].exampleInput)
      expect(manifestTool.resultShape).toMatchObject({ type: 'object' })
      expect(manifestTool.resultShape.required).toEqual(expect.arrayContaining(['status', 'projectRevision', 'summary']))
    }
    expect(webMcpManifest.tools.find((item) => item.name === 'show_structure_views')).toMatchObject({ readOnly: true })
    expect(webMcpManifest.tools.find((item) => item.name === 'propose_building_update')).toMatchObject({ readOnly: false })
  })

  it('reads nested site and structure state in agent-sized slices', async () => {
    const siteResult = await tool('get_project_state').execute({ detail: 'site' }); const site = payload(siteResult)
    expect(site.data.parcels.map((parcel: { cadastralNumber: string }) => parcel.cadastralNumber)).toEqual(['54/3', '55/3', '58/3', '54/4', '55/4', '58/4'])
    expect(site.data.knowledgeBase).toBeUndefined()
    expect(siteResult.content[0].text.length).toBeLessThan(6000)
    const structure = payload(await tool('get_project_state').execute({ detail: 'structure' }))
    expect(structure.data.buildings[0]).toMatchObject({ storeys: expect.any(Array), slabs: expect.any(Array), walls: expect.any(Array), spaces: expect.any(Array) })
    const landscapeResult = await tool('get_project_state').execute({ detail: 'landscape' }); const landscape = payload(landscapeResult)
    expect(landscape.data.landscape.zones.length).toBeGreaterThan(0)
    expect(landscape.data.plantingGuidance).toBeUndefined()
    expect(landscapeResult.content[0].text.length).toBeLessThan(8000)
  })

  it('serves the knowledge bank through its own untrusted-content tool and single objects by ref', async () => {
    expect(tool('get_site_knowledge').annotations).toEqual({ readOnlyHint: true, untrustedContentHint: true })
    expect(tool('get_project_state').annotations?.untrustedContentHint).toBeUndefined()
    const overview = payload(await tool('get_site_knowledge').execute({}))
    expect(overview.data.sections).toContain('planting')
    const planting = payload(await tool('get_site_knowledge').execute({ section: 'planting' }))
    expect(planting.data.soilAnalysis.findings).toHaveLength(5)
    expect(planting.data.recommendations.map((plant: { commonName: string }) => plant.commonName)).toEqual(expect.arrayContaining(['Tomato', 'Potato', 'Cucumber', 'Apple tree', 'Sour cherry']))
    const sources = await tool('get_site_knowledge').execute({ section: 'sources' })
    expect(payload(sources).data).toHaveLength(9)
    expect(sources.content[0].text.length).toBeLessThan(4000)
    expect(payload(await tool('get_project_state').execute({ detail: 'knowledge' })).status).toBe('error')
    const wallResult = await tool('get_project_state').execute({ objectRef: 'wall/east' }); const wall = payload(wallResult)
    expect(wall.data).toMatchObject({ kind: 'wall', buildingRef: 'house/main', storeyRef: 'storey/ground', object: { ref: 'wall/east', openings: expect.any(Array) } })
    expect(wallResult.content[0].text.length).toBeLessThan(1500)
    const zone = payload(await tool('get_project_state').execute({ objectRef: 'zone/lawn' }))
    expect(zone.data).toMatchObject({ kind: 'zone', object: { ref: 'zone/lawn' } })
    expect(payload(await tool('get_project_state').execute({ objectRef: 'nothing/here' })).status).toBe('error')
  })

  it('lists ready fixtures and proposes a complete kitchen garden without committing it', async () => {
    const catalog = payload(await tool('list_garden_fixtures').execute({}))
    expect(catalog.data.map((item: { id: string }) => item.id)).toEqual(['raised-bed-2x1', 'tomato-row', 'potato-row', 'cucumber-trellis'])
    const proposed = payload(await tool('propose_garden_fixture_set').execute({ preset: 'starter-kitchen-garden', setRef: 'fixture-set/webmcp-1', origin: { x: 8.4, z: 5.5 }, rotationDegrees: 0 }))
    expect(proposed.status).toBe('variant_created')
    expect(useStudioStore.getState().project.landscape.fixtures).toHaveLength(0)
    expect(useStudioStore.getState().variants[0].project.landscape.fixtures).toHaveLength(6)
    expect(useStudioStore.getState().variants[0].issues.filter((issue) => issue.severity === 'error')).toEqual([])
  })

  it('turns a tomato bed next to the previous beds into one atomic variant', async () => {
    useStudioStore.setState({ project: structuredClone(modernBarnProject), variants: [] })
    const proposed = payload(await tool('propose_garden_fixture_set').execute({ preset: 'tomato-raised-bed', setRef: 'fixture-set/webmcp-tomato-2', placement: 'next-to-existing', rotationDegrees: 0 }))
    const state = useStudioStore.getState()
    const fixtures = state.variants[0].project.landscape.fixtures
    expect(proposed).toMatchObject({ status: 'variant_created', metrics: { fixtureCount: 8 } })
    expect(state.project.landscape.fixtures).toHaveLength(6)
    expect(state.variants[0].commands).toHaveLength(2)
    expect(fixtures.slice(-2).map((fixture) => fixture.catalogId)).toEqual(['raised-bed-2x1', 'tomato-row'])
    expect(fixtures.at(-1)?.position.x).toBeCloseTo(17.7)
    expect(fixtures.at(-1)?.position.z).toBeCloseTo(5.5)
    expect(state.variants[0].issues.filter((issue) => issue.severity === 'error')).toEqual([])
  })

  it('creates a shared-slab storey variant without committing', async () => {
    const parsed = payload(await tool('propose_storey_update').execute({ action: 'add', buildingRef: 'house/main', storeyRef: 'storey/upper-webmcp', clearHeightM: 2.9 }))
    expect(parsed.status).toBe('variant_created')
    expect(useStudioStore.getState().project.buildings[0].storeys).toHaveLength(1)
    const building = useStudioStore.getState().variants[0].project.buildings[0]
    expect(building.storeys[0].topBoundaryRef).toBe(building.storeys[1].baseSlabRef)
    expect(useStudioStore.getState().project.revision).toBe(1)
  })

  it('previews a 96 m² upper-storey wing extension without creating a third level', async () => {
    useStudioStore.setState({ project: structuredClone(modernBarnProject), variants: [] })
    const parsed = payload(await tool('propose_storey_update').execute({
      action: 'extend-footprint', buildingRef: 'house/main', storeyRef: 'house/main/storey-upper',
      extensionFootprint: [{ x: -8, z: -5 }, { x: 8, z: -5 }, { x: 8, z: 1 }, { x: -2, z: 1 }, { x: -8, z: 1 }],
      spaceRef: 'house/main/storey-upper/space-wing', spaceName: 'Upper wing', usage: 'living',
    }))
    const state = useStudioStore.getState(); const building = state.variants[0].project.buildings[0]
    expect(parsed).toMatchObject({ status: 'variant_created', areaAddedM2: 96, buildingHeightM: 9.82, levelCount: 2, metrics: { homeAreaM2: 300 } })
    expect(state.project.buildings[0].slabs.find((slab) => slab.ref === 'slab/upper')?.footprint).toHaveLength(4)
    expect(building.storeys).toHaveLength(2)
    expect(building.roof.footprint).toEqual(building.slabs.find((slab) => slab.ref === 'slab/upper')?.footprint)
    expect(state.variants[0].issues.filter((issue) => issue.severity === 'error')).toEqual([])
  })

  it('previews a complete deterministic planting perimeter as one atomic variant', async () => {
    useStudioStore.setState({ project: structuredClone(modernBarnProject), variants: [] })
    const before = useStudioStore.getState().project.landscape.plants.length
    const parsed = payload(await tool('propose_planting_area').execute({ plantingRef: 'planting/webmcp-hornbeam', mode: 'boundary', sourceRefs: ['site'], inwardOffsetM: 1.2, spacingM: 5, rowCount: 1, rowSpacingM: 0.6, cornerTreatment: 'distribute', plantingPaletteRef: 'plant-guide/hornbeam', clearanceM: 1 }))
    const state = useStudioStore.getState()
    expect(parsed.status).toBe('variant_created')
    expect(parsed.plantCount).toBeGreaterThan(40)
    expect(parsed.affectedParcelRefs).toEqual(expect.arrayContaining(['parcel/54-3', 'parcel/58-4']))
    expect(parsed.conflicts).toContainEqual(expect.objectContaining({ code: 'planting.utilities-unmapped' }))
    expect(state.project.landscape.plants).toHaveLength(before)
    expect(state.variants[0].project.landscape.plants).toHaveLength(before + parsed.plantCount)
    expect(state.variants[0].commands).toHaveLength(1)
  })

  it('groups all six raised-bed and crop moves into one approval and one revision', async () => {
    useStudioStore.setState({ project: structuredClone(modernBarnProject), variants: [] })
    const project = useStudioStore.getState().project
    const created = payload(await tool('create_change_set').execute({ changeSetRef: 'change-set/garden-relocation-test', label: 'Relocate complete kitchen garden', baseRevision: project.revision }))
    expect(created).toMatchObject({ status: 'draft_created', baseRevision: project.revision, operations: [] })
    const operations = project.landscape.fixtures.map((fixture) => ({ type: 'garden-fixture.update', action: 'move', fixtureRef: fixture.ref, position: { x: fixture.position.x, z: 25.5 } }))
    const appended = payload(await tool('add_change_set_operations').execute({ changeSetRef: 'change-set/garden-relocation-test', operations }))
    expect(appended.operations).toHaveLength(6)
    expect(useStudioStore.getState().project.landscape.fixtures.every((fixture) => fixture.position.z === 5.5)).toBe(true)
    const proposed = payload(await tool('propose_change_set').execute({ changeSetRef: 'change-set/garden-relocation-test' }))
    expect(proposed).toMatchObject({ status: 'variant_created', operations: expect.any(Array) })
    expect(proposed.operations).toHaveLength(6)
    const variantRef = proposed.variantRef as string
    const waiting = tool('request_apply_variant').execute({ variantRef }, { signal: new AbortController().signal })
    await Promise.resolve(); resolveVariantConfirmation(true)
    expect(payload(await waiting)).toMatchObject({ status: 'applied', projectRevision: project.revision + 1 })
    expect(useStudioStore.getState().project.landscape.fixtures.map((fixture) => fixture.position.z)).toEqual([25.5, 25.5, 25.5, 25.5, 25.5, 25.5])
  })

  it('measures semantic heights without creating variants or changing revision', async () => {
    useStudioStore.setState({ project: structuredClone(modernBarnProject), variants: [] })
    const parsed = payload(await tool('measure_height').execute({ mode: 'semantic', objectRef: 'opening/upper-east-north', measurement: 'opening-height' }))
    expect(parsed).toMatchObject({ status: 'ok', projectRevision: 1, measurement: { objectRef: 'opening/upper-east-north', heightM: 1.55 } })
    expect(parsed.measurement.bottomPoint.reference).toBe('opening/upper-east-north/sill')
    expect(parsed.measurement.topPoint.reference).toBe('opening/upper-east-north/head')
    expect(tool('measure_height').annotations?.readOnlyHint).toBe(true)
    expect(useStudioStore.getState().variants).toEqual([])
  })

  it('proposes removing a selected wall window without changing the committed house', async () => {
    useStudioStore.setState({ project: structuredClone(modernBarnProject), variants: [], selectedRef: 'wall/courtyard-living' })
    const before = useStudioStore.getState().project.buildings[0].walls.find((wall) => wall.ref === 'wall/courtyard-living')!
    expect(before.openings).toHaveLength(2)
    const proposed = payload(await tool('propose_opening_update').execute({ action: 'remove', buildingRef: 'house/main', wallRef: 'wall/courtyard-living', openingRef: 'opening/living-balcony-door' }))
    const state = useStudioStore.getState(); const committed = state.project.buildings[0].walls.find((wall) => wall.ref === 'wall/courtyard-living')!; const variantWall = state.variants[0].project.buildings[0].walls.find((wall) => wall.ref === 'wall/courtyard-living')!
    expect(proposed.status).toBe('variant_created')
    expect(committed.openings).toHaveLength(2)
    expect(variantWall.openings.map((opening) => opening.ref)).toEqual(['opening/living-window-north'])
    expect(state.variants[0].issues.filter((issue) => issue.severity === 'error')).toEqual([])
  })

  it('proposes a complete wall façade preset while keeping the committed wall unchanged', async () => {
    useStudioStore.setState({ project: structuredClone(modernBarnProject), variants: [], selectedRef: 'wall/courtyard-living' })
    const proposed = payload(await tool('propose_wall_opening_layout').execute({ buildingRef: 'house/main', wallRef: 'wall/courtyard-living', preset: 'center-window' }))
    const state = useStudioStore.getState(); const committed = state.project.buildings[0].walls.find((wall) => wall.ref === 'wall/courtyard-living')!; const variantWall = state.variants[0].project.buildings[0].walls.find((wall) => wall.ref === 'wall/courtyard-living')!
    expect(proposed.status).toBe('variant_created')
    expect(committed.openings).toHaveLength(2)
    expect(variantWall.openings).toHaveLength(1)
    expect(variantWall.openings[0]).toMatchObject({ kind: 'window', offsetM: 4.5, widthM: 2.2, heightM: 1.5 })
    expect(state.variants[0].issues.filter((issue) => issue.severity === 'error')).toEqual([])
  })

  it('proposes material and color for all exterior walls without changing committed finishes', async () => {
    useStudioStore.setState({ project: structuredClone(modernBarnProject), variants: [], selectedRef: 'wall/courtyard-right' })
    const proposed = payload(await tool('propose_wall_finish_update').execute({ buildingRef: 'house/main', scope: 'all-exterior', material: 'natural-timber', colorHex: '#8A6544' }))
    const state = useStudioStore.getState(); const committed = state.project.buildings[0]; const variant = state.variants[0].project.buildings[0]
    expect(proposed.status).toBe('variant_created')
    expect(committed.walls.find((wall) => wall.ref === 'wall/courtyard-right')?.finish?.material).toBe('charred-timber')
    expect(variant.walls.find((wall) => wall.ref === 'wall/courtyard-right')?.finish).toEqual({ material: 'natural-timber', colorHex: '#8A6544' })
    expect(variant.walls.find((wall) => wall.ref === 'wall/rear-partition')?.finish?.material).toBe('charred-timber')
    expect(state.variants[0].issues.filter((issue) => issue.severity === 'error')).toEqual([])
  })

  it('waits for human approval before applying a linked lowered ceiling', async () => {
    await tool('propose_space_update').execute({ action: 'set-lowered-ceiling', buildingRef: 'house/main', storeyRef: 'storey/ground', spaceRef: 'space/living', ceilingElevationM: 3.1 })
    const variantRef = useStudioStore.getState().variants[0].ref
    const waiting = tool('request_apply_variant').execute({ variantRef }, { signal: new AbortController().signal })
    await Promise.resolve(); expect(useStudioStore.getState().confirmationVariantRef).toBe(variantRef)
    resolveVariantConfirmation(true)
    expect(payload(await waiting)).toMatchObject({ status: 'applied', projectRevision: 2, variantRef })
    expect(useStudioStore.getState().project.buildings[0].ceilingFinishes[0]).toMatchObject({ spaceRef: 'space/living', elevationM: 3.1 })
  })

  it('expands an architectural set and returns only visible-page references plus placement numbers', async () => {
    const unregister = registerStructureViewCapture(async (_project, views) => views.map((view, index) => ({ type: view.type, title: view.title, buildingRefs: view.buildingRefs, ...(view.type === 'storey-plan' ? { storeyRef: view.storeyRef } : {}), presentation: 'visible-in-page', imageUrl: `blob:test-${index}` })))
    const parsed = payload(await tool('show_structure_views').execute({ mode: 'architectural-set' }))
    unregister()
    expect(parsed.status).toBe('ok'); expect(parsed.views).toHaveLength(9); expect(parsed.buildings).toHaveLength(1)
    expect(parsed.views.map((item: { type: string }) => item.type)).toEqual(['site-plan', 'north-elevation', 'south-elevation', 'east-elevation', 'west-elevation', 'axonometric', 'storey-plan', 'section', 'section'])
    expect(parsed.buildings[0]).toMatchObject({ ref: 'house/main', positionM: { x: -1, z: -1 }, widthM: 12, depthM: 9 })
    expect(JSON.stringify(parsed)).not.toMatch(/blob:|data:image|imageUrl/)
  })

  it('rejects unknown refs, invalid sections and reports over 12 views', () => {
    expect(() => expandStructureViews(sampleProject, { mode: 'custom', buildingRefs: ['missing'], views: [{ type: 'site-plan' }] })).toThrow(/Unknown buildingRef/)
    expect(() => expandStructureViews(sampleProject, { mode: 'custom', views: [{ type: 'section', axis: 'longitudinal', offsetM: 101 }] })).toThrow(/offsetM/)
    const tooMany = structuredClone(sampleProject); const base = tooMany.buildings[0].storeys[0]
    tooMany.buildings[0].storeys.push(...Array.from({ length: 4 }, (_, index) => ({ ...structuredClone(base), ref: `storey/${index + 1}`, level: index + 1 })))
    expect(() => expandStructureViews(tooMany, { mode: 'architectural-set' })).toThrow(/contains 13 views/)
  })

  it('returns validation failures as readable field messages instead of raw issue JSON', async () => {
    const parsed = payload(await tool('run_sunlight_analysis').execute({ month: 6 }))
    expect(parsed.status).toBe('error')
    expect(parsed.summary).toBe('targetRef: targetRef or point is required.')
    const typed = payload(await tool('propose_roof_update').execute({ buildingRef: 'house/main', pitchDegrees: 95 }))
    expect(typed.summary).toMatch(/^pitchDegrees: /)
    expect(typed.summary).not.toMatch(/[{}\[\]]/)
  })

  it('honors an already-aborted signal', async () => {
    const controller = new AbortController(); controller.abort()
    expect(payload(await tool('run_seasonal_analysis').execute({ months: [1, 7] }, { signal: controller.signal })).status).toBe('cancelled')
  })

  it('returns and edits monthly averages by local-time day part', async () => {
    const analysis = payload(await tool('run_seasonal_analysis').execute({ months: [7] }))
    expect(analysis.data[0].temperatureByDayPartC).toEqual({ night: 15.2, morning: 18.8, day: 23.6, evening: 20.2 })
    const proposed = payload(await tool('propose_climate_update').execute({ month: 7, temperatureByDayPartC: { night: 15, morning: 19, day: 24, evening: 20 } }))
    expect(proposed.status).toBe('variant_created')
    expect(useStudioStore.getState().variants[0].project.climateProfile.months[6].temperatureByDayPartC).toEqual({ night: 15, morning: 19, day: 24, evening: 20 })
  })
})

describe('sunlight WebMCP surface', () => {
  beforeEach(() => useStudioStore.setState({ project: structuredClone(modernBarnProject), history: [], variants: [], sunTime: { month: 7, day: 15, hour: 14 } }))

  it('analyses sun hours for a zone without creating variants and within the output budget', async () => {
    const result = await tool('run_sunlight_analysis').execute({ targetRef: 'zone/lawn', month: 6, day: 21 })
    const parsed = payload(result)
    expect(tool('run_sunlight_analysis').annotations?.readOnlyHint).toBe(true)
    expect(parsed.status).toBe('ok')
    expect(typeof parsed.analysis.sunHours.mean).toBe('number')
    expect(parsed.analysis.grid).toBeUndefined()
    expect(result.content[0].text.length).toBeLessThan(1500)
    expect(useStudioStore.getState().variants).toEqual([])
  })

  it('returns a downsampled grid only on request and analyses a ghost variant when given its ref', async () => {
    const griddedResult = await tool('run_sunlight_analysis').execute({ targetRef: 'zone/lawn', month: 6, includeGrid: true }); const gridded = payload(griddedResult)
    expect(gridded.analysis.grid.width).toBeLessThanOrEqual(12)
    expect(gridded.analysis.grid.height).toBeLessThanOrEqual(12)
    expect(griddedResult.content[0].text.length).toBeLessThan(1500)
    expect(gridded.analysis.grid.hours).toHaveLength(gridded.analysis.grid.width * gridded.analysis.grid.height)
    const proposal = payload(await tool('propose_storey_update').execute({
      action: 'extend-footprint', buildingRef: 'house/main', storeyRef: 'house/main/storey-upper',
      extensionFootprint: [{ x: -8, z: -5 }, { x: 8, z: -5 }, { x: 8, z: 1 }, { x: -2, z: 1 }, { x: -8, z: 1 }],
    }))
    const committed = payload(await tool('run_sunlight_analysis').execute({ targetRef: 'zone/terrace', month: 9 }))
    const ghost = payload(await tool('run_sunlight_analysis').execute({ targetRef: 'zone/terrace', month: 9, variantRef: proposal.variantRef }))
    expect(ghost.variantRef).toBe(proposal.variantRef)
    expect(ghost.analysis.sunHours.mean).toBeLessThan(committed.analysis.sunHours.mean)
  })

  it('accepts a point target and rejects a call with neither target nor point', async () => {
    const point = payload(await tool('run_sunlight_analysis').execute({ point: { x: 3, z: 2 }, month: 6, hours: { from: 9, to: 17 } }))
    expect(point.status).toBe('ok')
    expect(point.analysis.window).toEqual({ fromLocal: 9, toLocal: 17 })
    expect(payload(await tool('run_sunlight_analysis').execute({ month: 6 })).status).toBe('error')
  })

  it('moves the viewer sun without touching the committed revision', async () => {
    const parsed = payload(await tool('set_sun_time').execute({ month: 12, day: 21, hour: 12 }))
    expect(tool('set_sun_time').annotations?.readOnlyHint).toBe(true)
    expect(parsed).toMatchObject({ status: 'ok', projectRevision: 1, sunTime: { month: 12, day: 21, hour: 12 } })
    expect(parsed.altitudeDeg).toBeCloseTo(16.3, 0)
    expect(parsed.sunriseLocal).toBeCloseTo(7.61, 1)
    expect(useStudioStore.getState().sunTime).toEqual({ month: 12, day: 21, hour: 12 })
    expect(useStudioStore.getState().project.revision).toBe(1)
    expect(useStudioStore.getState().variants).toEqual([])
  })

  it('expands a sun-study view with a dated title', () => {
    const { views } = expandStructureViews(sampleProject, { mode: 'custom', views: [{ type: 'sun-study', month: 6, day: 21, hour: 15 }] })
    expect(views).toHaveLength(1)
    expect(views[0].title).toBe('Sun study, 21 Jun 15:00')
  })

  it('adds local sunrise, sunset and noon altitude to the seasonal analysis', async () => {
    const parsed = payload(await tool('run_seasonal_analysis').execute({ months: [7] }))
    expect(parsed.data[0].sunriseLocal).toBeCloseTo(4.79, 1)
    expect(parsed.data[0].sunsetLocal).toBeCloseTo(20.75, 1)
    expect(parsed.data[0].solarNoonAltitudeDeg).toBeCloseTo(61.4, 0)
  })
})
