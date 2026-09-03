import { describe, expect, it } from 'vitest'
import { applyCommand } from './commands'
import { diffProjects } from './diff'
import { createPlantingAreaPlan } from './plantingAreas'
import { modernBarnProject, partialUpperModernBarnProject } from './sampleProject'

const extension = () => applyCommand(partialUpperModernBarnProject, {
  type: 'storey.update', action: 'extend-footprint', buildingRef: 'house/main', storeyRef: 'house/main/storey-upper',
  extensionFootprint: [{ x: -8, z: -5 }, { x: 8, z: -5 }, { x: 8, z: 1 }, { x: -2, z: 1 }, { x: -8, z: 1 }], spaceRef: 'house/main/storey-upper/space-wing',
})

describe('project diff', () => {
  it('reports nothing for identical projects', () => {
    const diff = diffProjects(modernBarnProject, structuredClone(modernBarnProject))
    expect(diff.changes).toEqual([])
    expect(diff.counts).toEqual({ added: 0, removed: 0, modified: 0 })
    expect(Object.keys(diff.metricDeltas)).toEqual([])
  })

  it('lists the storey extension as a modified slab, new space and walls, a modified roof and an area delta', () => {
    const diff = diffProjects(partialUpperModernBarnProject, extension())
    expect(diff.changes).toContainEqual({ kind: 'slab', ref: 'slab/upper', change: 'modified', fields: ['footprint'] })
    expect(diff.changes).toContainEqual(expect.objectContaining({ kind: 'space', ref: 'house/main/storey-upper/space-wing', change: 'added' }))
    expect(diff.changes.filter((change) => change.kind === 'wall' && change.change === 'added').length).toBeGreaterThan(0)
    expect(diff.changes).toContainEqual(expect.objectContaining({ kind: 'roof', ref: 'roof/main', change: 'modified', fields: expect.arrayContaining(['footprint']) }))
    expect(diff.changes).toContainEqual(expect.objectContaining({ kind: 'roof-segment', ref: 'roof/main/segment-rear-wing', change: 'modified', fields: expect.arrayContaining(['baseElevationM']) }))
    expect(diff.changes).toContainEqual(expect.objectContaining({ kind: 'storey', ref: 'house/main/storey-upper', change: 'modified' }))
    expect(diff.metricDeltas.homeAreaM2).toEqual({ before: 204, after: 300, delta: 96 })
    expect(diff.metricDeltas.spaceCount).toEqual({ before: 4, after: 5, delta: 1 })
  })

  it('caps long change lists and keeps the totals', () => {
    const plan = createPlantingAreaPlan(modernBarnProject, { plantingRef: 'planting/hedge', mode: 'boundary', sourceRefs: ['site'], inwardOffsetM: 1.2, spacingM: 2, rowCount: 1, rowSpacingM: 0.6, cornerTreatment: 'distribute', plantingPaletteRef: 'plant-guide/hornbeam', clearanceM: 1 })
    const planted = applyCommand(modernBarnProject, { type: 'planting-area.update', metadata: plan.metadata, plants: plan.plants })
    const diff = diffProjects(modernBarnProject, planted, { maxChanges: 20 })
    expect(diff.counts.added).toBe(plan.plants.length)
    expect(diff.changes).toHaveLength(20)
    expect(diff.omittedChanges).toBe(plan.plants.length - 20)
    expect(diff.metricDeltas.plantCount?.delta).toBe(plan.plants.length)
  })

  it('detects moved fixtures and changed wall finishes by field', () => {
    const moved = applyCommand(modernBarnProject, { type: 'garden-fixture.update', action: 'move', fixtureRef: 'fixture-set/starter-1/bed-tomato', position: { x: 8.4, z: 25.5 } })
    expect(diffProjects(modernBarnProject, moved).changes).toEqual([{ kind: 'fixture', ref: 'fixture-set/starter-1/bed-tomato', change: 'modified', fields: ['position'] }])
    const finished = applyCommand(modernBarnProject, { type: 'wall.finish', buildingRef: 'house/main', wallRef: 'wall/east', material: 'brick', colorHex: '#8B4E3C' })
    expect(diffProjects(modernBarnProject, finished).changes).toEqual([{ kind: 'wall', ref: 'wall/east', change: 'modified', fields: ['finish'] }])
  })
})
