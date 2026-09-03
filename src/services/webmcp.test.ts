import { beforeEach, describe, expect, it } from 'vitest'
import { webMcpToolPrompts } from '../../prompts/webmcp-tools'
import { applyCommand } from '../domain/commands'
import { modernBarnProject, sampleProject } from '../domain/sampleProject'
import { useStudioStore } from '../state/store'
import { expandStructureViews, registerStructureViewCapture } from './structureViews'
import { resolveVariantConfirmation, webMcpTools } from './webmcp'
import { webMcpManifest } from './webmcpDefinitions'

const tool = (name: string) => webMcpTools.find((item) => item.name === name)!
const payload = (result: WebMcpToolResult) => JSON.parse(result.content[0].text)

beforeEach(() => useStudioStore.setState({ project: structuredClone(sampleProject), history: [], variants: [], proposals: [], draftChangeSets: [], selectedRef: 'space/living', repositioningRef: null, confirmationVariantRef: null, structureReport: null }))

describe('ProjectV2 WebMCP surface', () => {
  it('publishes the prompt-aligned V2 tool catalog without export or V1 nouns', () => {
    const toolNames = webMcpTools.map((item) => item.name)
    expect(toolNames).toEqual(Object.values(webMcpToolPrompts).map((prompt) => prompt.name))
    expect(toolNames).toHaveLength(27)
    expect(toolNames).toEqual(expect.arrayContaining(['propose_garden_fixture', 'manage_change_set', 'manage_variant']))
    const retiredNames = ['propose_garden_fixture_update', 'propose_garden_fixture_set', 'create_change_set', 'add_change_set_operations', 'propose_change_set', 'discard_change_set', 'request_apply_variant', 'discard_variant']
    expect(toolNames.filter((name) => retiredNames.includes(name))).toEqual([])
    expect(new Set(toolNames).size).toBe(webMcpTools.length)
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
    expect(webMcpManifest.tools.find((item) => item.name === 'get_proposals')).toMatchObject({ readOnly: true })
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
    const proposed = payload(await tool('propose_garden_fixture').execute({ mode: 'preset', preset: 'starter-kitchen-garden', setRef: 'fixture-set/webmcp-1', origin: { x: 8.4, z: 5.5 }, rotationDegrees: 0 }))
    expect(proposed.status).toBe('variant_created')
    expect(useStudioStore.getState().project.landscape.fixtures).toHaveLength(0)
    expect(useStudioStore.getState().variants[0].project.landscape.fixtures).toHaveLength(6)
    expect(useStudioStore.getState().variants[0].issues.filter((issue) => issue.severity === 'error')).toEqual([])
  })

  it('turns a tomato bed next to the previous beds into one atomic variant', async () => {
    useStudioStore.setState({ project: structuredClone(modernBarnProject), variants: [] })
    const proposed = payload(await tool('propose_garden_fixture').execute({ mode: 'preset', preset: 'tomato-raised-bed', setRef: 'fixture-set/webmcp-tomato-2', placement: 'next-to-existing', rotationDegrees: 0 }))
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

  it('routes a single fixture edit through the same mode-discriminated tool', async () => {
    useStudioStore.setState({ project: structuredClone(modernBarnProject), variants: [] })
    const proposed = payload(await tool('propose_garden_fixture').execute({ mode: 'single', action: 'move', fixtureRef: 'fixture-set/starter-1/bed-tomato', position: { x: 9.2, z: 7.1 } }))
    expect(proposed.status).toBe('variant_created')
    expect(useStudioStore.getState().project.landscape.fixtures[0].position).toEqual({ x: 8.4, z: 5.5 })
    expect(useStudioStore.getState().variants[0].project.landscape.fixtures[0].position).toEqual({ x: 9.2, z: 7.1 })
  })

  it('rejects incomplete single-fixture actions before creating a variant', async () => {
    const rejected = payload(await tool('propose_garden_fixture').execute({ mode: 'single', action: 'add', fixtureRef: 'fixture/incomplete', position: { x: 2, z: 3 } }))
    expect(rejected).toMatchObject({ status: 'error' })
    expect(rejected.summary).toContain('catalogId is required')
    expect(useStudioStore.getState().variants).toEqual([])
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
    expect(parsed).toMatchObject({ status: 'variant_created', areaAddedM2: 96, buildingHeightM: 9.4, levelCount: 2, metrics: { homeAreaM2: 300 } })
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

  it('discards an unfinalized draft through manage_change_set', async () => {
    const created = payload(await tool('manage_change_set').execute({ action: 'create', changeSetRef: 'change-set/discard-test', label: 'Temporary draft', baseRevision: 1 }))
    expect(created.status).toBe('draft_created')
    expect(useStudioStore.getState().draftChangeSets).toHaveLength(1)
    const discarded = payload(await tool('manage_change_set').execute({ action: 'discard', changeSetRef: 'change-set/discard-test' }))
    expect(discarded).toMatchObject({ status: 'ok', changeSetRef: 'change-set/discard-test' })
    expect(useStudioStore.getState().draftChangeSets).toEqual([])
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

  it('keeps proposal decisions discoverable and exposes them through a read-only audit tool', async () => {
    const proposed = payload(await tool('propose_plant_update').execute({ action: 'move', plantRef: 'plant/hydrangea', position: { x: -7.5, z: 9 } }))
    const pending = payload(await tool('get_proposals').execute({ status: 'pending', includeDrafts: true }))
    expect(pending).toMatchObject({ status: 'ok', counts: { pending: 1, approved: 0, rejected: 0, stale: 0 }, proposals: [{ ref: proposed.variantRef, status: 'pending' }] })
    expect(pending.proposals[0].project).toBeUndefined()
    expect(tool('get_proposals').annotations?.readOnlyHint).toBe(true)
    const rejected = payload(await tool('manage_variant').execute({ action: 'discard', variantRef: proposed.variantRef, reason: 'Keep the current planting position.' }))
    expect(rejected.status).toBe('rejected')
    const history = payload(await tool('get_proposals').execute({ proposalRef: proposed.variantRef, includeDrafts: false }))
    expect(history.proposals[0]).toMatchObject({ status: 'rejected', rejectionReason: 'Keep the current planting position.' })
    expect(useStudioStore.getState().project.landscape.plants.find((plant) => plant.ref === 'plant/hydrangea')?.position).toEqual({ x: -8.5, z: 8 })
  })

  it('preserves superseded pending proposals as stale history', async () => {
    const first = payload(await tool('propose_plant_update').execute({ action: 'move', plantRef: 'plant/hydrangea', position: { x: -7.5, z: 9 } }))
    const second = payload(await tool('propose_plant_update').execute({ action: 'move', plantRef: 'plant/hornbeam-1', position: { x: -12.8, z: 3 } }))
    const waiting = tool('manage_variant').execute({ action: 'request-apply', variantRef: first.variantRef }, { signal: new AbortController().signal })
    await Promise.resolve(); resolveVariantConfirmation(true); await waiting
    expect(useStudioStore.getState().proposals.find((proposal) => proposal.ref === second.variantRef)?.status).toBe('stale')
    const history = payload(await tool('get_proposals').execute({ includeDrafts: true }))
    expect(history.counts).toMatchObject({ approved: 1, stale: 1 })
  })

  it('targets one roof segment with aligned eaves and an exact finish', async () => {
    useStudioStore.setState({ project: structuredClone(modernBarnProject), variants: [], proposals: [] })
    const parsed = payload(await tool('propose_roof_update').execute({
      buildingRef: 'house/main', segmentRef: 'roof/main/segment-rear-wing', alignToSegmentRef: 'roof/main/segment-upper-wing', alignEdge: 'eaves',
      material: 'standing-seam-metal', colorHex: '#2D3435', synchronization: 'roof-and-supporting-walls',
    }))
    expect(parsed).toMatchObject({ status: 'variant_created', targetScope: 'segment', buildingHeight: { beforeM: 9.4, afterM: 9.4 }, roofChanges: [{ before: { segmentRef: 'roof/main/segment-rear-wing', eavesElevationM: 3.45 }, after: { segmentRef: 'roof/main/segment-rear-wing', eavesElevationM: 6.55, finish: { colorHex: '#2D3435' } } }] })
    const variantRoof = useStudioStore.getState().variants[0].project.buildings[0].roof
    expect(variantRoof.segments.find((segment) => segment.ref === 'roof/main/segment-upper-wing')?.baseElevationM).toBe(6.55)
    expect(useStudioStore.getState().project.buildings[0].roof.segments.find((segment) => segment.ref === 'roof/main/segment-rear-wing')?.baseElevationM).toBe(3.45)
  })

  it('proposes an atomic split of one malformed L-shaped segment with a declared valley', async () => {
    const malformed = applyCommand(modernBarnProject, {
      type: 'storey.update', action: 'extend-footprint', buildingRef: 'house/main', storeyRef: 'house/main/storey-upper',
      extensionFootprint: [{ x: -8, z: -5 }, { x: 8, z: -5 }, { x: 8, z: 1 }, { x: -2, z: 1 }, { x: -8, z: 1 }],
      spaceRef: 'house/main/storey-upper/space-wing', spaceName: 'Upper wing', usage: 'living',
    })
    const malformedRoof = malformed.buildings[0].roof; const source = structuredClone(malformedRoof.segments[0])
    malformedRoof.segments = [{ ...source, ref: 'roof/main/segment-main', footprint: structuredClone(malformedRoof.footprint!), spaceRef: 'house/main/storey-upper/space-main', ridgeDirection: 'z', adjacentSegmentRefs: [] }]
    malformedRoof.junctions = []
    useStudioStore.setState({ project: malformed, variants: [], proposals: [] })
    const parsed = payload(await tool('propose_roof_update').execute({
      action: 'split-segment', buildingRef: 'house/main', segmentRef: 'roof/main/segment-main',
      segments: [
        { segmentRef: 'roof/main/segment-original-wing', footprint: [{ x: -8, z: 1 }, { x: -2, z: 1 }, { x: -2, z: 10 }, { x: -8, z: 10 }], ridgeDirection: 'z', storeyRef: 'house/main/storey-upper', spaceRef: 'house/main/storey-upper/space-main', baseElevationM: 6.55, material: 'standing-seam-metal', colorHex: '#2D3435' },
        { segmentRef: 'roof/main/segment-extended-wing', footprint: [{ x: -8, z: -5 }, { x: 8, z: -5 }, { x: 8, z: 1 }, { x: -8, z: 1 }], ridgeDirection: 'x', storeyRef: 'house/main/storey-upper', spaceRef: 'house/main/storey-upper/space-wing', baseElevationM: 6.55, material: 'standing-seam-metal', colorHex: '#2D3435' },
      ],
      junctions: [{ ref: 'roof/main/junction-original-extended', type: 'valley', segmentRefs: ['roof/main/segment-original-wing', 'roof/main/segment-extended-wing'] }],
    }))
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
    const waiting = tool('manage_variant').execute({ action: 'request-apply', variantRef }, { signal: new AbortController().signal })
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
