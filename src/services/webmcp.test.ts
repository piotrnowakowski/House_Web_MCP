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
    for (const item of webMcpTools) expect(['<role>', '<task>', '<input>', '<tools>', '<output>', '<example_output>'].every((tag) => item.description.includes(tag))).toBe(true)
  })

  it('generates a complete inspectable manifest from runtime schemas and structured prompts', () => {
    expect(webMcpManifest.toolCount).toBe(webMcpTools.length)
    expect(webMcpManifest.tools.map((item) => item.name)).toEqual(webMcpTools.map((item) => item.name))
    for (const manifestTool of webMcpManifest.tools) {
      const runtimeTool = tool(manifestTool.name)
      expect(manifestTool.inputSchema).toEqual(runtimeTool.inputSchema)
      expect(manifestTool.prompt).toEqual(webMcpToolPrompts[manifestTool.name].blocks)
      expect(manifestTool.exampleInput).toEqual(webMcpToolPrompts[manifestTool.name].exampleInput)
      expect(manifestTool.resultShape).toMatchObject({ type: 'object' })
      expect(manifestTool.resultShape.required).toEqual(expect.arrayContaining(['status', 'projectRevision', 'summary']))
    }
    expect(webMcpManifest.tools.find((item) => item.name === 'show_structure_views')).toMatchObject({ readOnly: true })
    expect(webMcpManifest.tools.find((item) => item.name === 'propose_building_update')).toMatchObject({ readOnly: false })
  })

  it('reads nested site and structure state', async () => {
    const site = payload(await tool('get_project_state').execute({ detail: 'site' }))
    expect(site.data.parcels.map((parcel: { cadastralNumber: string }) => parcel.cadastralNumber)).toEqual(['54/3', '55/3', '58/3', '54/4', '55/4', '58/4'])
    const structure = payload(await tool('get_project_state').execute({ detail: 'structure' }))
    expect(structure.data.buildings[0]).toMatchObject({ storeys: expect.any(Array), slabs: expect.any(Array), walls: expect.any(Array), spaces: expect.any(Array) })
    const landscape = payload(await tool('get_project_state').execute({ detail: 'landscape' }))
    expect(landscape.data.plantingGuidance.soilAnalysis.findings).toHaveLength(5)
    expect(landscape.data.plantingGuidance.recommendations.map((plant: { commonName: string }) => plant.commonName)).toEqual(expect.arrayContaining(['Tomato', 'Potato', 'Cucumber', 'Apple tree', 'Sour cherry']))
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
