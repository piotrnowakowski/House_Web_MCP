import { beforeEach, describe, expect, it } from 'vitest'
import { operationReference, webMcpToolPrompts } from '../../prompts/webmcp-tools'
import { applyCommand } from '../domain/commands'
import { gableWallsForBuilding } from '../domain/roofWings'
import { modernBarnProject, partialUpperModernBarnProject, sampleProject } from '../domain/sampleProject'
import { useStudioStore } from '../state/store'
import { expandStructureViews, registerStructureViewCapture } from './structureViews'
import { registerWebMcpTools, resolveVariantConfirmation, webMcpTools } from './webmcp'
import { operationSchema, webMcpManifest } from './webmcpDefinitions'

const tool = (name: string) => webMcpTools.find((item) => item.name === name)!
const payload = (result: WebMcpToolResult) => JSON.parse(result.content[0].text)
const propose = async (operations: unknown[], label?: string) => payload(await tool('propose_change').execute({ operations, ...(label ? { label } : {}) }))
const extension = { type: 'storey.update', action: 'extend-footprint', buildingRef: 'house/main', storeyRef: 'house/main/storey-upper', extensionFootprint: [{ x: -8, z: -5 }, { x: 8, z: -5 }, { x: 8, z: 1 }, { x: -2, z: 1 }, { x: -8, z: 1 }], spaceRef: 'house/main/storey-upper/space-wing', spaceName: 'Upper wing', usage: 'living' }

beforeEach(() => useStudioStore.setState({ project: structuredClone(sampleProject), history: [], variants: [], proposals: [], draftChangeSets: [], selectedRef: 'space/living', repositioningRef: null, confirmationVariantRef: null, structureReport: null }))

describe('ProjectV2 WebMCP surface', () => {
  it('replaces an older page registration so hot reload cannot keep a stale store alive', () => {
    const originalDocument = globalThis.document
    const signals: AbortSignal[] = []
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: { modelContext: { registerTool: async (_tool: WebMcpTool, options?: { signal?: AbortSignal }) => { if (options?.signal) signals.push(options.signal) } } },
    })
    try {
      const cleanupFirst = registerWebMcpTools()
      const firstBatch = signals.slice()
      expect(firstBatch).toHaveLength(webMcpTools.length)
      expect(firstBatch.every((signal) => !signal.aborted)).toBe(true)
      const cleanupSecond = registerWebMcpTools()
      const secondBatch = signals.slice(webMcpTools.length)
      expect(firstBatch.every((signal) => signal.aborted)).toBe(true)
      expect(secondBatch).toHaveLength(webMcpTools.length)
      cleanupFirst()
      expect(secondBatch.every((signal) => !signal.aborted)).toBe(true)
      cleanupSecond()
      expect(secondBatch.every((signal) => signal.aborted)).toBe(true)
    } finally {
      Object.defineProperty(globalThis, 'document', { configurable: true, value: originalDocument })
    }
  })

  it('publishes the prompt-aligned catalog with the right hints and no retired names', () => {
    const toolNames = webMcpTools.map((item) => item.name)
    expect(toolNames).toEqual(Object.values(webMcpToolPrompts).map((prompt) => prompt.name))
    expect(toolNames).toHaveLength(11)
    expect(new Set(toolNames).size).toBe(webMcpTools.length)
    const retiredNames = ['propose_storey_update', 'propose_wall_finish_update', 'run_sunlight_analysis', 'run_seasonal_analysis', 'set_sun_time', 'diff_variant', 'compare_variants', 'list_textures', 'list_garden_fixtures', 'undo_last_change']
    expect(toolNames.filter((name) => retiredNames.includes(name))).toEqual([])
    for (const name of ['get_project_state', 'get_site_knowledge', 'get_proposals', 'list_catalog', 'measure_height', 'run_analysis', 'show_structure_views', 'set_viewer_state']) expect(tool(name).annotations?.readOnlyHint, name).toBe(true)
    for (const name of ['propose_change', 'manage_change_set', 'manage_variant']) expect(tool(name).annotations?.readOnlyHint, name).toBeUndefined()
    expect(tool('get_site_knowledge').annotations).toEqual({ readOnlyHint: true, untrustedContentHint: true })
    for (const item of webMcpTools) {
      const prompt = Object.values(webMcpToolPrompts).find((candidate) => candidate.name === item.name)!
      expect(item.description).toBe(prompt.runtimeDescription)
      expect(item.inputSchema?.type, item.name).toBe('object')
    }
    for (const prompt of Object.values(webMcpToolPrompts)) {
      expect(['<role>', '<task>', '<input>', '<tools>', '<output>', '<example_output>'].every((tag) => prompt.description.includes(tag))).toBe(true)
    }
  })

  it('generates a complete inspectable manifest with the budget and the operation reference', () => {
    expect(webMcpManifest.toolCount).toBe(webMcpTools.length)
    expect(webMcpManifest.tools.map((item) => item.name)).toEqual(webMcpTools.map((item) => item.name))
    expect(webMcpManifest.budget.tokenLimit).toBe(5000)
    expect(webMcpManifest.budget.estimatedTokens).toBeLessThan(webMcpManifest.budget.tokenLimit)
    expect(webMcpManifest.operations).toBe(operationReference)
    for (const manifestTool of webMcpManifest.tools) {
      const runtimeTool = tool(manifestTool.name)
      expect(manifestTool.description).toBe(runtimeTool.description)
      expect(manifestTool.inputSchema).toEqual(runtimeTool.inputSchema)
      expect(manifestTool.prompt).toEqual(webMcpToolPrompts[manifestTool.name].blocks)
      expect(manifestTool.exampleInput).toEqual(webMcpToolPrompts[manifestTool.name].exampleInput)
      expect(manifestTool.resultShape).toMatchObject({ type: 'object' })
      expect(manifestTool.resultShape.required).toEqual(expect.arrayContaining(['status', 'projectRevision', 'summary']))
    }
    expect(webMcpManifest.tools.find((item) => item.name === 'propose_change')).toMatchObject({ readOnly: false })
    expect(webMcpManifest.tools.find((item) => item.name === 'set_viewer_state')).toMatchObject({ readOnly: true })
  })

  it('documents every operation type the union accepts, and nothing else', () => {
    const unionTypes = operationSchema.options.map((option) => option.shape.type.value).sort()
    expect(operationReference.map((item) => item.type).sort()).toEqual(unionTypes)
    for (const prompt of [webMcpToolPrompts.propose_change]) for (const type of unionTypes) expect(prompt.blocks.input).toContain(type)
    for (const entry of operationReference) expect(entry.purpose.length, entry.type).toBeLessThanOrEqual(160)
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
    expect(landscapeResult.content[0].text.length).toBeLessThan(8000)
    const full = payload(await tool('get_project_state').execute({ detail: 'full' }))
    expect(full.data.site.knowledgeBase).toBeUndefined()
    expect(full.data).toMatchObject({ site: { parcels: expect.any(Array) }, buildings: expect.any(Array), landscape: { zones: expect.any(Array) } })
  })

  it('serves the knowledge bank through its own untrusted-content tool and single objects by ref', async () => {
    expect(tool('get_project_state').annotations?.untrustedContentHint).toBeUndefined()
    const overview = payload(await tool('get_site_knowledge').execute({}))
    expect(overview.data.sections).toContain('planting')
    const planting = payload(await tool('get_site_knowledge').execute({ section: 'planting' }))
    expect(planting.data.soilAnalysis.findings).toHaveLength(5)
    expect(planting.data.recommendations.map((plant: { commonName: string }) => plant.commonName)).toEqual(expect.arrayContaining(['Tomato', 'Potato', 'Cucumber', 'Apple tree']))
    const sources = await tool('get_site_knowledge').execute({ section: 'sources' })
    expect(payload(sources).data).toHaveLength(12)
    expect(sources.content[0].text.length).toBeLessThan(4000)
    expect(payload(await tool('get_project_state').execute({ detail: 'knowledge' })).status).toBe('error')
    const wallResult = await tool('get_project_state').execute({ objectRef: 'wall/east' }); const wall = payload(wallResult)
    expect(wall.data).toMatchObject({ kind: 'wall', buildingRef: 'house/main', storeyRef: 'storey/ground', object: { ref: 'wall/east', openings: expect.any(Array) } })
    expect(wallResult.content[0].text.length).toBeLessThan(1500)
    expect(payload(await tool('get_project_state').execute({ objectRef: 'nothing/here' })).status).toBe('error')
  })

  it('lists the three catalogues compactly, including the operation reference', async () => {
    const fixtures = payload(await tool('list_catalog').execute({ catalog: 'garden-fixtures' }))
    expect(fixtures.data.map((item: { id: string }) => item.id)).toEqual(['outdoor-dining-set', 'garden-lounge-set', 'slatted-bench', 'sun-lounger', 'cantilever-parasol', 'raised-bed-2x1', 'tomato-row', 'potato-row', 'cucumber-trellis'])
    const texturesResult = await tool('list_catalog').execute({ catalog: 'textures' }); const textures = payload(texturesResult)
    expect(textures.data).toHaveLength(12)
    expect(textures.data[0]).toMatchObject({ id: expect.any(String), name: expect.any(String), tileM: expect.any(Number), surfaces: expect.any(Array) })
    expect(texturesResult.content[0].text.length).toBeLessThan(1500)
    const ground = payload(await tool('list_catalog').execute({ catalog: 'textures', surface: 'ground' }))
    expect(ground.data.map((item: { id: string }) => item.id)).toContain('dirt')
    expect(ground.data.map((item: { id: string }) => item.id)).not.toContain('hinoki')
    const operationsResult = await tool('list_catalog').execute({ catalog: 'operations' }); const operations = payload(operationsResult)
    expect(operations.data).toHaveLength(operationReference.length)
    expect(operations.data[0]).toEqual({ type: 'site.update', purpose: expect.any(String) })
    expect(operationsResult.content[0].text.length).toBeLessThan(2600)
    const one = payload(await tool('list_catalog').execute({ catalog: 'operations', type: 'storey.update' }))
    expect(one.data).toEqual([expect.objectContaining({ type: 'storey.update', optional: expect.arrayContaining(['extensionFootprint (adjacent polygon)']) })])
    expect(payload(await tool('list_catalog').execute({ catalog: 'operations', type: 'nothing.here' })).summary).toMatch(/Unknown operation type/)
  })

  it('proposes a complete kitchen garden preset without committing it', async () => {
    const proposed = await propose([{ type: 'garden-fixture.preset', preset: 'starter-kitchen-garden', setRef: 'fixture-set/webmcp-1', origin: { x: 8.4, z: 5.5 }, rotationDegrees: 0 }])
    expect(proposed.status).toBe('variant_created')
    expect(proposed.operations).toHaveLength(6)
    expect(useStudioStore.getState().project.landscape.fixtures).toHaveLength(0)
    expect(useStudioStore.getState().variants[0].project.landscape.fixtures).toHaveLength(6)
    expect(useStudioStore.getState().variants[0].issues.filter((issue) => issue.severity === 'error')).toEqual([])
  })

  it('proposes a catalogue furniture item and a bed next to the previous beds', async () => {
    const dining = await propose([{ type: 'garden-fixture.update', action: 'add', fixtureRef: 'fixture/dining-1', catalogId: 'outdoor-dining-set', position: { x: 5, z: 8 }, rotationDegrees: 15 }])
    expect(dining.status).toBe('variant_created')
    expect(useStudioStore.getState().variants[0].project.landscape.fixtures[0]).toMatchObject({ catalogId: 'outdoor-dining-set', position: { x: 5, z: 8 }, rotationDegrees: 15 })
    useStudioStore.setState({ project: structuredClone(modernBarnProject), variants: [] })
    const tomato = await propose([{ type: 'garden-fixture.preset', preset: 'tomato-raised-bed', setRef: 'fixture-set/webmcp-tomato-2', placement: 'next-to-existing', rotationDegrees: 0 }])
    const state = useStudioStore.getState(); const fixtures = state.variants[0].project.landscape.fixtures
    expect(tomato).toMatchObject({ status: 'variant_created', metrics: { fixtureCount: 8 } })
    expect(state.project.landscape.fixtures).toHaveLength(6)
    expect(state.variants[0].commands).toHaveLength(2)
    expect(fixtures.slice(-2).map((fixture) => fixture.catalogId)).toEqual(['raised-bed-2x1', 'tomato-row'])
    expect(fixtures.at(-1)?.position.x).toBeCloseTo(17.7)
  })

  it('moves a fixture with its linked crop and rejects incomplete fixture operations with the operation index', async () => {
    useStudioStore.setState({ project: structuredClone(modernBarnProject), variants: [] })
    const proposed = await propose([{ type: 'garden-fixture.update', action: 'move', fixtureRef: 'fixture-set/starter-1/bed-tomato', position: { x: 9.2, z: 7.1 } }])
    expect(proposed.status).toBe('variant_created')
    expect(useStudioStore.getState().variants[0].project.landscape.fixtures[0].position).toEqual({ x: 9.2, z: 7.1 })
    expect(useStudioStore.getState().variants[0].project.landscape.fixtures[1].position).toEqual({ x: 9.2, z: 7.1 })
    const rejected = await propose([{ type: 'garden-fixture.update', action: 'add', fixtureRef: 'fixture/incomplete', position: { x: 2, z: 3 } }])
    expect(rejected).toMatchObject({ status: 'error' })
    expect(rejected.summary).toBe('operations.0.catalogId: catalogId is required when adding a fixture.')
    expect(useStudioStore.getState().variants).toHaveLength(1)
  })

  it('creates a shared-slab storey variant without committing', async () => {
    const parsed = await propose([{ type: 'storey.update', action: 'add', buildingRef: 'house/main', storeyRef: 'storey/upper-webmcp', clearHeightM: 2.9 }])
    expect(parsed.status).toBe('variant_created')
    expect(useStudioStore.getState().project.buildings[0].storeys).toHaveLength(1)
    const building = useStudioStore.getState().variants[0].project.buildings[0]
    expect(building.storeys[0].topBoundaryRef).toBe(building.storeys[1].baseSlabRef)
    expect(useStudioStore.getState().project.revision).toBe(1)
  })

  it('previews a 96 m² upper-storey wing extension with the same numbers the dedicated tool used to report', async () => {
    useStudioStore.setState({ project: structuredClone(partialUpperModernBarnProject), variants: [] })
    const parsed = await propose([extension])
    const state = useStudioStore.getState(); const building = state.variants[0].project.buildings[0]
    expect(parsed).toMatchObject({ status: 'variant_created', areaAddedM2: 96, buildingHeightM: 9.4, levelCount: 2, metrics: { homeAreaM2: 300 } })
    expect(parsed.affectedRefs).toEqual(expect.arrayContaining(['house/main', 'house/main/storey-upper']))
    expect(parsed.operations).toEqual([{ index: 1, type: 'storey.update', refs: expect.arrayContaining(['house/main', 'house/main/storey-upper']) }])
    expect(state.project.buildings[0].slabs.find((slab) => slab.ref === 'slab/upper')?.footprint).toHaveLength(4)
    expect(building.storeys).toHaveLength(2)
    expect(building.roof.footprint).toEqual(building.slabs.find((slab) => slab.ref === 'slab/upper')?.footprint)
  })

  it('builds a labelled multi-operation variant in one call and keeps the label an agent supplies', async () => {
    useStudioStore.setState({ project: structuredClone(modernBarnProject), variants: [] })
    const auto = await propose([
      { type: 'wall.finish', buildingRef: 'house/main', scope: 'all-exterior', material: 'brick', colorHex: '#8B4E3C' },
      { type: 'landscape.update', action: 'set-surface', zoneRef: 'zone/lawn', textureId: 'forest-floor' },
    ])
    expect(auto.status).toBe('variant_created')
    expect(useStudioStore.getState().variants[0].label).toBe('Wall finish, landscape update')
    expect(auto.operations.length).toBeGreaterThan(2)
    const labelled = await propose([{ type: 'plant.update', action: 'add', plantRef: 'plant/new-box', species: 'Buxus sempervirens', kind: 'shrub', position: { x: 10, z: 12 } }], 'Add a box shrub')
    expect(labelled.status).toBe('variant_created')
    expect(useStudioStore.getState().variants[1].label).toBe('Add a box shrub')
    expect(labelled.affectedRefs).toEqual(['plant/new-box'])
    expect(payload(await tool('propose_change').execute({ operations: [{ type: 'plant.update', action: 'move', plantRef: 'plant/apple', position: { x: 10, z: 12 } }] })).summary).toMatch(/locked/)
  })

  it('previews a complete deterministic planting perimeter as one atomic variant', async () => {
    useStudioStore.setState({ project: structuredClone(modernBarnProject), variants: [] })
    const before = useStudioStore.getState().project.landscape.plants.length
    const parsed = await propose([{ type: 'planting.area', plantingRef: 'planting/webmcp-hornbeam', mode: 'boundary', sourceRefs: ['site'], inwardOffsetM: 1.2, spacingM: 5, rowCount: 1, rowSpacingM: 0.6, cornerTreatment: 'distribute', plantingPaletteRef: 'plant-guide/hornbeam', clearanceM: 1 }])
    const state = useStudioStore.getState()
    expect(parsed.status).toBe('variant_created')
    expect(parsed.plantCount).toBeGreaterThan(40)
    expect(parsed.affectedParcelRefs).toEqual(expect.arrayContaining(['parcel/54-3', 'parcel/58-4']))
    expect(parsed.conflicts).toContainEqual(expect.objectContaining({ code: 'planting.utilities-unmapped' }))
    expect(state.project.landscape.plants).toHaveLength(before)
    expect(state.variants[0].project.landscape.plants).toHaveLength(before + parsed.plantCount)
    expect(state.variants[0].commands).toHaveLength(1)
    expect(payload(await tool('propose_change').execute({ operations: [{ type: 'planting.area', plantingRef: 'planting/x', mode: 'line', species: 'Buxus' }] })).summary).toBe('operations.0.points: points are required for line and polygon planting.')
  })

  it('groups all six raised-bed and crop moves into one approval and one revision', async () => {
    useStudioStore.setState({ project: structuredClone(modernBarnProject), variants: [] })
    const project = useStudioStore.getState().project
    const created = payload(await tool('manage_change_set').execute({ action: 'create', changeSetRef: 'change-set/garden-relocation-test', label: 'Relocate complete kitchen garden', baseRevision: project.revision }))
    expect(created).toMatchObject({ status: 'draft_created', baseRevision: project.revision, operations: [] })
    const operations = project.landscape.fixtures.map((fixture) => ({ type: 'garden-fixture.update', action: 'move', fixtureRef: fixture.ref, position: { x: fixture.position.x, z: 25.5 } }))
    const appended = payload(await tool('manage_change_set').execute({ action: 'add-operations', changeSetRef: 'change-set/garden-relocation-test', operations }))
    expect(appended.operations).toHaveLength(6)
    expect(useStudioStore.getState().project.landscape.fixtures.every((fixture) => fixture.position.z === 5.5)).toBe(true)
    const proposed = payload(await tool('manage_change_set').execute({ action: 'finalize', changeSetRef: 'change-set/garden-relocation-test' }))
    expect(proposed).toMatchObject({ status: 'variant_created', operations: expect.any(Array) })
    expect(proposed.operations).toHaveLength(6)
    const variantRef = proposed.variantRef as string
    const waiting = tool('manage_variant').execute({ action: 'request-apply', variantRef }, { signal: new AbortController().signal })
    await Promise.resolve(); resolveVariantConfirmation(true)
    expect(payload(await waiting)).toMatchObject({ status: 'applied', projectRevision: project.revision + 1 })
    expect(useStudioStore.getState().project.landscape.fixtures.map((fixture) => fixture.position.z)).toEqual([25.5, 25.5, 25.5, 25.5, 25.5, 25.5])
    expect(useStudioStore.getState().proposals.find((proposal) => proposal.ref === variantRef)).toMatchObject({ status: 'approved', resultingRevision: project.revision + 1 })
  })

  it('validates draft operations strictly, expands macros inside drafts, and discards unfinalized drafts', async () => {
    useStudioStore.setState({ project: structuredClone(modernBarnProject), variants: [] })
    const project = useStudioStore.getState().project
    payload(await tool('manage_change_set').execute({ action: 'create', changeSetRef: 'change-set/surfaces', label: 'Surfaces', baseRevision: project.revision }))
    const invalid = payload(await tool('manage_change_set').execute({ action: 'add-operations', changeSetRef: 'change-set/surfaces', operations: [{ type: 'landscape.update', action: 'set-surface', zoneRef: 'zone/lawn' }, { type: 'nothing.here' }] }))
    expect(invalid.status).toBe('error')
    expect(invalid.summary).toMatch(/^operations\.1\.type: /)
    const appended = payload(await tool('manage_change_set').execute({ action: 'add-operations', changeSetRef: 'change-set/surfaces', operations: [
      { type: 'landscape.update', action: 'set-surface', zoneRef: 'zone/lawn', textureId: 'brick-pavement' },
      { type: 'wall.finish', buildingRef: 'house/main', scope: 'all-exterior', material: 'brick', colorHex: '#8B4E3C', textureId: 'none' },
    ] }))
    expect(appended.status).toBe('draft_updated')
    expect(appended.operations.length).toBeGreaterThan(2)
    const finalized = payload(await tool('manage_change_set').execute({ action: 'finalize', changeSetRef: 'change-set/surfaces' }))
    const variant = useStudioStore.getState().variants.find((item) => item.ref === finalized.variantRef)!.project
    expect(variant.landscape.zones.find((zone) => zone.ref === 'zone/lawn')?.textureId).toBe('brick-pavement')
    expect(variant.buildings[0].walls.find((wall) => wall.ref === 'wall/courtyard-right')?.finish?.textureId).toBe('none')
    const created = payload(await tool('manage_change_set').execute({ action: 'create', changeSetRef: 'change-set/discard-test', label: 'Temporary draft', baseRevision: project.revision }))
    expect(created.status).toBe('draft_created')
    const discarded = payload(await tool('manage_change_set').execute({ action: 'discard', changeSetRef: 'change-set/discard-test' }))
    expect(discarded).toMatchObject({ status: 'ok', changeSetRef: 'change-set/discard-test' })
    expect(useStudioStore.getState().draftChangeSets.find((draft) => draft.ref === 'change-set/discard-test')).toBeUndefined()
  })

  it('measures semantic heights without creating variants or changing revision', async () => {
    useStudioStore.setState({ project: structuredClone(modernBarnProject), variants: [] })
    const parsed = payload(await tool('measure_height').execute({ mode: 'semantic', objectRef: 'opening/upper-east-north', measurement: 'opening-height' }))
    expect(parsed).toMatchObject({ status: 'ok', projectRevision: 1, measurement: { objectRef: 'opening/upper-east-north', heightM: 1.55 } })
    expect(parsed.measurement.bottomPoint.reference).toBe('opening/upper-east-north/sill')
    const free = payload(await tool('measure_height').execute({ mode: 'free-vertical', startPoint: { x: 0, y: 0, z: 0 }, endPoint: { x: 0, y: 2.5, z: 0 } }))
    expect(free.measurement.heightM).toBeCloseTo(2.5)
    expect(payload(await tool('measure_height').execute({ mode: 'semantic' })).summary).toBe('objectRef: objectRef is required in semantic mode.')
    expect(useStudioStore.getState().variants).toEqual([])
  })

  it('keeps proposal decisions discoverable through the read-only audit tool', async () => {
    const proposed = await propose([{ type: 'plant.update', action: 'move', plantRef: 'plant/hydrangea', position: { x: -7.5, z: 9 } }])
    const pending = payload(await tool('get_proposals').execute({ status: 'pending', includeDrafts: true }))
    expect(pending).toMatchObject({ status: 'ok', counts: { pending: 1, approved: 0, rejected: 0, stale: 0 }, proposals: [{ ref: proposed.variantRef, status: 'pending' }] })
    expect(pending.proposals[0].project).toBeUndefined()
    const rejected = payload(await tool('manage_variant').execute({ action: 'discard', variantRef: proposed.variantRef, reason: 'Keep the current planting position.' }))
    expect(rejected.status).toBe('rejected')
    const history = payload(await tool('get_proposals').execute({ proposalRef: proposed.variantRef, includeDrafts: false }))
    expect(history.proposals[0]).toMatchObject({ status: 'rejected', rejectionReason: 'Keep the current planting position.' })
    expect(useStudioStore.getState().project.landscape.plants.find((plant) => plant.ref === 'plant/hydrangea')?.position).toEqual({ x: -8.5, z: 8 })
    expect(payload(await tool('manage_variant').execute({ action: 'discard' })).summary).toBe('variantRef: variantRef is required for discard.')
  })

  it('preserves superseded pending proposals as stale history and undoes committed work', async () => {
    const first = await propose([{ type: 'plant.update', action: 'move', plantRef: 'plant/hydrangea', position: { x: -7.5, z: 9 } }])
    const second = await propose([{ type: 'plant.update', action: 'move', plantRef: 'plant/hornbeam-1', position: { x: -12.8, z: 3 } }])
    const waiting = tool('manage_variant').execute({ action: 'request-apply', variantRef: first.variantRef }, { signal: new AbortController().signal })
    await Promise.resolve(); resolveVariantConfirmation(true); await waiting
    expect(useStudioStore.getState().proposals.find((proposal) => proposal.ref === second.variantRef)?.status).toBe('stale')
    const history = payload(await tool('get_proposals').execute({ includeDrafts: true }))
    expect(history.counts).toMatchObject({ approved: 1, stale: 1 })
    expect(useStudioStore.getState().project.revision).toBe(2)
    const undone = payload(await tool('manage_variant').execute({ action: 'undo-last-change' }))
    expect(undone).toMatchObject({ status: 'ok', projectRevision: 1 })
    expect(useStudioStore.getState().project.landscape.plants.find((plant) => plant.ref === 'plant/hydrangea')?.position).toEqual({ x: -8.5, z: 8 })
  })

  it('targets one roof segment with aligned eaves and an exact finish', async () => {
    useStudioStore.setState({ project: structuredClone(partialUpperModernBarnProject), variants: [], proposals: [] })
    const parsed = await propose([{ type: 'roof.update', buildingRef: 'house/main', segmentRef: 'roof/main/segment-rear-wing', alignToSegmentRef: 'roof/main/segment-upper-wing', alignEdge: 'eaves', material: 'standing-seam-metal', colorHex: '#2D3435', synchronization: 'roof-and-supporting-walls' }])
    expect(parsed).toMatchObject({ status: 'variant_created', targetScope: 'segment', buildingHeight: { beforeM: 9.4, afterM: 9.4 }, roofChanges: [{ before: { segmentRef: 'roof/main/segment-rear-wing', eavesElevationM: 3.45 }, after: { segmentRef: 'roof/main/segment-rear-wing', eavesElevationM: 6.55, finish: { colorHex: '#2D3435' } } }] })
    expect(useStudioStore.getState().selectedRef).toBe('roof/main/segment-rear-wing')
    expect(useStudioStore.getState().project.buildings[0].roof.segments.find((segment) => segment.ref === 'roof/main/segment-rear-wing')?.baseElevationM).toBe(3.45)
  })

  it('proposes an atomic split of one malformed L-shaped segment with a declared valley', async () => {
    const malformed = applyCommand(partialUpperModernBarnProject, { ...extension, type: 'storey.update', action: 'extend-footprint' } as Parameters<typeof applyCommand>[1])
    const malformedRoof = malformed.buildings[0].roof; const source = structuredClone(malformedRoof.segments[0])
    malformedRoof.segments = [{ ...source, ref: 'roof/main/segment-main', footprint: structuredClone(malformedRoof.footprint!), spaceRef: 'house/main/storey-upper/space-main', ridgeDirection: 'z', adjacentSegmentRefs: [] }]
    malformedRoof.junctions = []
    useStudioStore.setState({ project: malformed, variants: [], proposals: [] })
    const parsed = await propose([{
      type: 'roof.update', action: 'split-segment', buildingRef: 'house/main', segmentRef: 'roof/main/segment-main',
      segments: [
        { segmentRef: 'roof/main/segment-original-wing', footprint: [{ x: -8, z: 1 }, { x: -2, z: 1 }, { x: -2, z: 10 }, { x: -8, z: 10 }], ridgeDirection: 'z', storeyRef: 'house/main/storey-upper', spaceRef: 'house/main/storey-upper/space-main', baseElevationM: 6.55, material: 'standing-seam-metal', colorHex: '#2D3435' },
        { segmentRef: 'roof/main/segment-extended-wing', footprint: [{ x: -8, z: -5 }, { x: 8, z: -5 }, { x: 8, z: 1 }, { x: -8, z: 1 }], ridgeDirection: 'x', storeyRef: 'house/main/storey-upper', spaceRef: 'house/main/storey-upper/space-wing', baseElevationM: 6.55, material: 'standing-seam-metal', colorHex: '#2D3435' },
      ],
      junctions: [{ ref: 'roof/main/junction-original-extended', type: 'valley', segmentRefs: ['roof/main/segment-original-wing', 'roof/main/segment-extended-wing'] }],
    }])
    expect(parsed).toMatchObject({
      status: 'variant_created', targetScope: 'segment-split', buildingHeightM: 9.4,
      roofChanges: expect.arrayContaining([
        expect.objectContaining({ kind: 'removed', before: expect.objectContaining({ segmentRef: 'roof/main/segment-main' }) }),
        expect.objectContaining({ kind: 'added', after: expect.objectContaining({ segmentRef: 'roof/main/segment-original-wing', ridgeDirection: 'z', eavesElevationM: 6.55 }) }),
        expect.objectContaining({ kind: 'added', after: expect.objectContaining({ segmentRef: 'roof/main/segment-extended-wing', ridgeDirection: 'x', eavesElevationM: 6.55 }) }),
      ]),
      junctions: [{ type: 'valley', segmentRefs: ['roof/main/segment-original-wing', 'roof/main/segment-extended-wing'] }],
    })
    expect(useStudioStore.getState().project.buildings[0].roof.segments).toHaveLength(1)
    expect(useStudioStore.getState().variants[0].project.buildings[0].roof.segments).toHaveLength(2)
    expect(useStudioStore.getState().variants[0].issues.filter((issue) => issue.severity === 'error')).toEqual([])
  })

  it('removes a window, applies a façade preset and refinishes exterior walls without touching the committed house', async () => {
    useStudioStore.setState({ project: structuredClone(modernBarnProject), variants: [], selectedRef: 'wall/courtyard-living' })
    const removal = await propose([{ type: 'opening.update', action: 'remove', buildingRef: 'house/main', wallRef: 'wall/courtyard-living', openingRef: 'opening/living-balcony-door' }])
    expect(removal.status).toBe('variant_created')
    expect(useStudioStore.getState().variants[0].project.buildings[0].walls.find((wall) => wall.ref === 'wall/courtyard-living')!.openings.map((opening) => opening.ref)).toEqual(['opening/living-window-north'])
    const facade = await propose([{ type: 'wall.opening-layout', buildingRef: 'house/main', wallRef: 'wall/courtyard-living', preset: 'center-window' }])
    expect(facade.status).toBe('variant_created')
    expect(useStudioStore.getState().variants[1].project.buildings[0].walls.find((wall) => wall.ref === 'wall/courtyard-living')!.openings[0]).toMatchObject({ kind: 'window', offsetM: 4.5, widthM: 2.2, heightM: 1.5 })
    const finish = await propose([{ type: 'wall.finish', buildingRef: 'house/main', scope: 'all-exterior', material: 'natural-timber', colorHex: '#8A6544' }])
    expect(finish.status).toBe('variant_created')
    const variant = useStudioStore.getState().variants[2].project.buildings[0]
    expect(variant.walls.find((wall) => wall.ref === 'wall/courtyard-right')?.finish).toEqual({ material: 'natural-timber', colorHex: '#8A6544' })
    expect(variant.walls.find((wall) => wall.ref === 'wall/rear-partition')?.finish?.material).toBe('charred-timber')
    expect(useStudioStore.getState().project.buildings[0].walls.find((wall) => wall.ref === 'wall/courtyard-living')!.openings).toHaveLength(2)
    expect(payload(await tool('propose_change').execute({ operations: [{ type: 'wall.finish', buildingRef: 'house/main', material: 'brick', colorHex: '#8B4E3C' }] })).summary).toBe('operations.0.wallRef: wallRef is required when scope is wall.')
  })

  it('waits for human approval before applying a linked lowered ceiling', async () => {
    await propose([{ type: 'space.update', action: 'set-lowered-ceiling', buildingRef: 'house/main', storeyRef: 'storey/ground', spaceRef: 'space/living', ceilingElevationM: 3.1 }])
    const variantRef = useStudioStore.getState().variants[0].ref
    const waiting = tool('manage_variant').execute({ action: 'request-apply', variantRef }, { signal: new AbortController().signal })
    await Promise.resolve(); expect(useStudioStore.getState().confirmationVariantRef).toBe(variantRef)
    resolveVariantConfirmation(true)
    expect(payload(await waiting)).toMatchObject({ status: 'applied', projectRevision: 2, variantRef })
    expect(useStudioStore.getState().project.buildings[0].ceilingFinishes[0]).toMatchObject({ spaceRef: 'space/living', elevationM: 3.1 })
  })

  it('covers the remaining command operations: site, terrain, building, slab, wall, platform and climate', async () => {
    const site = await propose([{ type: 'site.update', northDegrees: -50 }])
    expect(useStudioStore.getState().variants.at(-1)!.project.site.northDegrees).toBe(-50)
    expect(site.affectedRefs).toEqual([])
    await propose([{ type: 'terrain.update', elevationPoints: [{ x: 0, z: 0, elevation: 0.2 }] }])
    expect(useStudioStore.getState().variants.at(-1)!.project.site.terrain.elevationPoints).toEqual([{ x: 0, z: 0, elevation: 0.2 }])
    await propose([{ type: 'building.update', action: 'add', buildingRef: 'garage/main', name: 'Garage', kind: 'garage', position: { x: 14, z: -4 } }])
    expect(useStudioStore.getState().variants.at(-1)!.project.buildings.map((building) => building.ref)).toContain('garage/main')
    await propose([{ type: 'slab.update', action: 'set-thickness', buildingRef: 'house/main', slabRef: 'slab/ground', thicknessM: 0.28 }])
    expect(useStudioStore.getState().variants.at(-1)!.project.buildings[0].slabs.find((slab) => slab.ref === 'slab/ground')?.thicknessM).toBe(0.28)
    await propose([{ type: 'wall.update', action: 'set-thickness', buildingRef: 'house/main', wallRef: 'wall/east', thicknessM: 0.3 }])
    expect(useStudioStore.getState().variants.at(-1)!.project.buildings[0].walls.find((wall) => wall.ref === 'wall/east')?.thicknessM).toBe(0.3)
    await propose([{ type: 'platform.update', action: 'add', buildingRef: 'house/main', storeyRef: 'storey/ground', spaceRef: 'space/living', platformRef: 'platform/mezzanine', footprint: [{ x: 0, z: 0 }, { x: 2, z: 0 }, { x: 2, z: 2 }, { x: 0, z: 2 }], elevationM: 2.5 }])
    expect(useStudioStore.getState().variants.at(-1)!.project.buildings[0].platforms.map((platform) => platform.ref)).toContain('platform/mezzanine')
    const climate = await propose([{ type: 'climate.update', month: 7, temperatureByDayPartC: { night: 15, morning: 19, day: 24, evening: 20 } }])
    expect(climate.status).toBe('variant_created')
    expect(useStudioStore.getState().variants.at(-1)!.project.climateProfile.months[6].temperatureByDayPartC).toEqual({ night: 15, morning: 19, day: 24, evening: 20 })
    expect(payload(await tool('propose_change').execute({ operations: [{ type: 'roof.update', buildingRef: 'house/main', pitchDegrees: 95 }] })).summary).toMatch(/^operations\.0\.pitchDegrees: /)
  })

  it('expands an architectural set and validates custom views strictly in code', async () => {
    const unregister = registerStructureViewCapture(async (_project, views) => views.map((view, index) => ({ type: view.type, title: view.title, buildingRefs: view.buildingRefs, ...(view.type === 'storey-plan' ? { storeyRef: view.storeyRef } : {}), presentation: 'visible-in-page', imageUrl: `blob:test-${index}` })))
    try {
      const parsed = payload(await tool('show_structure_views').execute({ mode: 'architectural-set' }))
      expect(parsed.status).toBe('ok'); expect(parsed.views).toHaveLength(9); expect(parsed.buildings).toHaveLength(1)
      expect(parsed.views.map((item: { type: string }) => item.type)).toEqual(['site-plan', 'north-elevation', 'south-elevation', 'east-elevation', 'west-elevation', 'axonometric', 'storey-plan', 'section', 'section'])
      expect(parsed.buildings[0]).toMatchObject({ ref: 'house/main', positionM: { x: -1, z: -1 }, widthM: 12, depthM: 9 })
      expect(JSON.stringify(parsed)).not.toMatch(/blob:|data:image|imageUrl/)
      const custom = payload(await tool('show_structure_views').execute({ mode: 'custom', views: [{ type: 'sun-study', month: 6, day: 21, hour: 15 }, { type: 'axonometric' }] }))
      expect(custom.views.map((item: { title: string }) => item.title)).toEqual(['Sun study, 21 Jun 15:00', expect.any(String)])
      const invalid = payload(await tool('show_structure_views').execute({ mode: 'custom', views: [{ type: 'sun-study', month: 6 }] }))
      expect(invalid.status).toBe('error')
      expect(invalid.summary).toMatch(/^0\.day: /)
    } finally { unregister() }
  })

  it('rejects unknown refs, invalid sections and reports over 12 views', () => {
    expect(() => expandStructureViews(sampleProject, { mode: 'custom', buildingRefs: ['missing'], views: [{ type: 'site-plan' }] })).toThrow(/Unknown buildingRef/)
    expect(() => expandStructureViews(sampleProject, { mode: 'custom', views: [{ type: 'section', axis: 'longitudinal', offsetM: 101 }] })).toThrow(/offsetM/)
    const tooMany = structuredClone(sampleProject); const base = tooMany.buildings[0].storeys[0]
    tooMany.buildings[0].storeys.push(...Array.from({ length: 4 }, (_, index) => ({ ...structuredClone(base), ref: `storey/${index + 1}`, level: index + 1 })))
    expect(() => expandStructureViews(tooMany, { mode: 'architectural-set' })).toThrow(/contains 13 views/)
  })

  it('returns validation failures as readable field messages and honors an aborted signal', async () => {
    const parsed = payload(await tool('run_analysis').execute({ kind: 'sunlight', month: 6 }))
    expect(parsed.status).toBe('error')
    expect(parsed.summary).toBe('targetRef: targetRef or point is required.')
    expect(payload(await tool('run_analysis').execute({ kind: 'sunlight', targetRef: 'zone/lawn' })).summary).toBe('month: month is required for sunlight analysis.')
    const controller = new AbortController(); controller.abort()
    expect(payload(await tool('run_analysis').execute({ kind: 'seasonal', months: [1, 7] }, { signal: controller.signal })).status).toBe('cancelled')
  })

  it('returns monthly averages by local-time day part with sunrise, sunset and noon altitude', async () => {
    const analysis = payload(await tool('run_analysis').execute({ kind: 'seasonal', months: [7] }))
    expect(analysis.kind).toBe('seasonal')
    expect(analysis.data[0].temperatureByDayPartC).toEqual({ night: 15.2, morning: 18.8, day: 23.6, evening: 20.2 })
    expect(analysis.data[0].sunriseLocal).toBeCloseTo(4.79, 1)
    expect(analysis.data[0].sunsetLocal).toBeCloseTo(20.75, 1)
    expect(analysis.data[0].solarNoonAltitudeDeg).toBeCloseTo(61.4, 0)
    expect(payload(await tool('run_analysis').execute({ kind: 'seasonal' })).data).toHaveLength(4)
  })
})

describe('variant explanation and viewer tools', () => {
  beforeEach(() => useStudioStore.setState({ project: structuredClone(modernBarnProject), history: [], variants: [], selectedRef: null, explodeStoreys: false, confirmationVariantRef: null, sunTime: { month: 7, day: 15, hour: 14 } }))

  it('explains a ghost variant as compact object changes and compares variants', async () => {
    useStudioStore.setState({ project: structuredClone(partialUpperModernBarnProject), variants: [] })
    const proposal = await propose([extension])
    const result = await tool('get_proposals').execute({ action: 'diff', proposalRef: proposal.variantRef }); const parsed = payload(result)
    expect(parsed).toMatchObject({ status: 'ok', variantRef: proposal.variantRef, diff: { metricDeltas: { homeAreaM2: { before: 204, after: 300, delta: 96 } } } })
    expect(parsed.diff.changes).toContainEqual({ kind: 'slab', ref: 'slab/upper', change: 'modified', fields: ['footprint'] })
    expect(result.content[0].text.length).toBeLessThan(1500)
    expect(payload(await tool('get_proposals').execute({ action: 'diff', proposalRef: 'variant/missing' })).status).toBe('error')
    expect(payload(await tool('get_proposals').execute({ action: 'diff' })).summary).toBe('proposalRef: diff requires proposalRef.')
    const other = await propose([{ type: 'plant.update', action: 'add', plantRef: 'plant/new-box', species: 'Buxus sempervirens', kind: 'shrub', position: { x: 10, z: 12 } }])
    const compared = payload(await tool('get_proposals').execute({ action: 'compare', variantRefs: [proposal.variantRef, other.variantRef] }))
    expect(compared.data).toHaveLength(2)
    expect(compared.data[0]).toMatchObject({ variantRef: proposal.variantRef, metrics: { homeAreaM2: 300 } })
  })

  it('drives the viewer, moves the sun, and never touches the project', async () => {
    const parsed = payload(await tool('set_viewer_state').execute({ explode: true, focusRef: 'wall/courtyard-living' }))
    expect(parsed).toMatchObject({ status: 'ok', projectRevision: 1, viewer: { explode: true, selectedRef: 'wall/courtyard-living' } })
    expect(parsed.sunTime).toBeUndefined()
    const state = useStudioStore.getState()
    expect(state.explodeStoreys).toBe(true); expect(state.selectedRef).toBe('wall/courtyard-living')
    expect(payload(await tool('set_viewer_state').execute({ focusRef: 'nothing/here' })).status).toBe('error')
    const cleared = payload(await tool('set_viewer_state').execute({ focusRef: null, explode: false }))
    expect(cleared.viewer).toMatchObject({ selectedRef: null, explode: false })
    const sun = payload(await tool('set_viewer_state').execute({ sunTime: { month: 12, day: 21, hour: 12 } }))
    expect(sun).toMatchObject({ status: 'ok', projectRevision: 1, sunTime: { month: 12, day: 21, hour: 12 } })
    expect(sun.altitudeDeg).toBeCloseTo(16.3, 0)
    expect(sun.sunriseLocal).toBeCloseTo(7.61, 1)
    expect(useStudioStore.getState().sunTime).toEqual({ month: 12, day: 21, hour: 12 })
    expect(useStudioStore.getState().project.revision).toBe(1); expect(useStudioStore.getState().variants).toEqual([])
    const plan = payload(await tool('set_viewer_state').execute({ planStoreyRef: 'house/main/storey-upper' }))
    expect(plan.viewer.activePlanStoreyRef).toBe('house/main/storey-upper')
  })

  it('focuses the camera on the requested fixture instead of the fixture-group centroid', async () => {
    const withFirstFixture = applyCommand(sampleProject, { type: 'garden-fixture.update', action: 'add', fixtureRef: 'fixture/first', catalogId: 'raised-bed-2x1', position: { x: 4, z: 6 } })
    const project = applyCommand(withFirstFixture, { type: 'garden-fixture.update', action: 'add', fixtureRef: 'fixture/target', catalogId: 'tomato-row', position: { x: 20, z: 30 } })
    useStudioStore.setState({ project })
    const parsed = payload(await tool('set_viewer_state').execute({ focusRef: 'fixture/target' }))
    expect(parsed).toMatchObject({ status: 'ok', viewer: { selectedRef: 'fixture/target' } })
    expect(useStudioStore.getState().gardenFocusRequest).toMatchObject({ targetX: 20, targetZ: 30 })
  })
})

describe('sunlight through run_analysis', () => {
  beforeEach(() => useStudioStore.setState({ project: structuredClone(modernBarnProject), history: [], variants: [], sunTime: { month: 7, day: 15, hour: 14 } }))

  it('analyses sun hours for a zone within the output budget and without variants', async () => {
    const result = await tool('run_analysis').execute({ kind: 'sunlight', targetRef: 'zone/lawn', month: 6, day: 21 })
    const parsed = payload(result)
    expect(parsed.status).toBe('ok'); expect(parsed.kind).toBe('sunlight')
    expect(typeof parsed.analysis.sunHours.mean).toBe('number')
    expect(parsed.analysis.grid).toBeUndefined()
    expect(result.content[0].text.length).toBeLessThan(1500)
    expect(useStudioStore.getState().variants).toEqual([])
  })

  it('returns a downsampled grid only on request and analyses a ghost variant when given its ref', async () => {
    const griddedResult = await tool('run_analysis').execute({ kind: 'sunlight', targetRef: 'zone/lawn', month: 6, includeGrid: true }); const gridded = payload(griddedResult)
    expect(gridded.analysis.grid.width).toBeLessThanOrEqual(12)
    expect(griddedResult.content[0].text.length).toBeLessThan(1500)
    useStudioStore.setState({ project: structuredClone(partialUpperModernBarnProject), variants: [] })
    const proposal = await propose([{ ...extension, spaceName: undefined, usage: undefined }])
    const committed = payload(await tool('run_analysis').execute({ kind: 'sunlight', targetRef: 'zone/terrace', month: 9 }))
    const ghost = payload(await tool('run_analysis').execute({ kind: 'sunlight', targetRef: 'zone/terrace', month: 9, variantRef: proposal.variantRef }))
    expect(ghost.variantRef).toBe(proposal.variantRef)
    expect(ghost.analysis.sunHours.mean).toBeLessThan(committed.analysis.sunHours.mean)
  })

  it('accepts a point target with a local-time window', async () => {
    const point = payload(await tool('run_analysis').execute({ kind: 'sunlight', point: { x: 3, z: 2 }, month: 6, hours: { from: 9, to: 17 } }))
    expect(point.status).toBe('ok')
    expect(point.analysis.window).toEqual({ fromLocal: 9, toLocal: 17 })
  })

  it('expands a sun-study view with a dated title', () => {
    const { views } = expandStructureViews(sampleProject, { mode: 'custom', views: [{ type: 'sun-study', month: 6, day: 21, hour: 15 }] })
    expect(views[0].title).toBe('Sun study, 21 Jun 15:00')
  })
})

describe('texture library over WebMCP', () => {
  it('proposes a wall scan choice, textures a gable wall, and rejects scans that are not made for walls', async () => {
    useStudioStore.setState({ project: structuredClone(modernBarnProject), variants: [] })
    const proposed = await propose([{ type: 'wall.finish', buildingRef: 'house/main', wallRef: 'wall/courtyard-right', material: 'brick', colorHex: '#8B4E3C', textureId: 'brick-floor' }])
    expect(proposed.status).toBe('variant_created')
    expect(useStudioStore.getState().variants[0].project.buildings[0].walls.find((wall) => wall.ref === 'wall/courtyard-right')?.finish).toEqual({ material: 'brick', colorHex: '#8B4E3C', textureId: 'brick-floor' })
    const gable = gableWallsForBuilding(modernBarnProject.buildings[0]).find((item) => item.ref.endsWith('/segment-rear-wing/gable-wall/max'))!
    const read = payload(await tool('get_project_state').execute({ objectRef: gable.ref }))
    expect(read.data).toMatchObject({ kind: 'wall', object: { ref: gable.ref, wallType: 'gable' } })
    const gableProposal = await propose([{ type: 'wall.finish', buildingRef: 'house/main', wallRef: gable.ref, material: 'brick', colorHex: '#8B4E3C', textureId: 'brick-floor' }])
    expect(gableProposal.status).toBe('variant_created')
    const segment = useStudioStore.getState().variants[1].project.buildings[0].roof.segments.find((item) => item.ref === gable.segmentRef)!
    expect(segment.gableWallFinishes?.[gable.side]).toEqual({ material: 'brick', colorHex: '#8B4E3C', textureId: 'brick-floor' })
    const rejected = await propose([{ type: 'wall.finish', buildingRef: 'house/main', wallRef: 'wall/courtyard-right', material: 'brick', colorHex: '#8B4E3C', textureId: 'leafy-grass' }])
    expect(rejected.status).toBe('error')
    expect(rejected.summary).toMatch(/^operations\.0 \(wall\.finish\): .*wall/)
    expect(useStudioStore.getState().variants).toHaveLength(2)
  })

  it('proposes a zone surface and keeps the committed zone untouched', async () => {
    const proposed = await propose([{ type: 'landscape.update', action: 'set-surface', zoneRef: 'zone/lawn', textureId: 'forest-floor' }])
    expect(proposed.status).toBe('variant_created')
    expect(useStudioStore.getState().variants[0].project.landscape.zones.find((zone) => zone.ref === 'zone/lawn')?.textureId).toBe('forest-floor')
    expect(useStudioStore.getState().project.landscape.zones.find((zone) => zone.ref === 'zone/lawn')?.textureId).toBeUndefined()
  })
})
