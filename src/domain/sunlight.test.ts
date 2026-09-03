import { describe, expect, it } from 'vitest'
import { applyCommand, validateProject } from './commands'
import { modernBarnProject, partialUpperModernBarnProject, sampleProject } from './sampleProject'
import { analyzeSunlight, collectOccluders, isLitAt } from './sunlight'
import type { BuildingModel, ProjectV2 } from './types'

/** A north-up site with one long east-west wall and nothing else casting shadow. */
const wallOnlyProject = (heightM = 3, lengthM = 6): ProjectV2 => {
  const project = structuredClone(sampleProject)
  project.site.northDegrees = 0
  project.landscape.plants = []; project.landscape.fixtures = []
  const building: BuildingModel = {
    ref: 'house/wall', name: 'Wall', kind: 'house', architecturalStyle: 'classic', position: { x: 0, z: 0 }, rotationDegrees: 0,
    storeys: [{ ref: 'storey/w', name: 'Ground', level: 0, elevationM: 0, clearHeightM: heightM, baseSlabRef: 'slab/w', topBoundaryRef: 'roof/w', wallRefs: ['wall/w'], spaceRefs: [], platformRefs: [], ceilingFinishRefs: [] }],
    slabs: [{ ref: 'slab/w', footprint: [{ x: -0.1, z: -0.1 }, { x: 0.1, z: -0.1 }, { x: 0.1, z: 0.1 }, { x: -0.1, z: 0.1 }], topElevationM: 0, thicknessM: 0.1, locked: false }],
    walls: [{ ref: 'wall/w', start: { x: -lengthM / 2, z: 0 }, end: { x: lengthM / 2, z: 0 }, thicknessM: 0.2, baseElevationM: 0, heightM, openings: [], locked: false }],
    spaces: [], platforms: [], ceilingFinishes: [],
    roof: {
      ref: 'roof/w', type: 'flat', baseElevationM: 0, pitchDegrees: 0, overhangM: 0, footprint: [{ x: -0.1, z: -0.1 }, { x: 0.1, z: -0.1 }, { x: 0.1, z: 0.1 }, { x: -0.1, z: 0.1 }], finish: { material: 'membrane', colorHex: '#333333' },
      segments: [{ ref: 'roof/w/segment-main', footprint: [{ x: -0.1, z: -0.1 }, { x: 0.1, z: -0.1 }, { x: 0.1, z: 0.1 }, { x: -0.1, z: 0.1 }], storeyRef: 'storey/w', baseElevationM: 0, type: 'flat', pitchDegrees: 0, overhangM: 0, ridgeDirection: 'z', finish: { material: 'membrane', colorHex: '#333333' }, adjacentSegmentRefs: [] }],
      junctions: [],
    },
  }
  project.buildings = [building]
  return project
}
const noon = { month: 6, day: 21, hour: 12.7 }

describe('sunlight occluders', () => {
  it('collects walls, slabs, roof wings, canopies and fixtures from the barn project', () => {
    const occluders = collectOccluders(partialUpperModernBarnProject)
    const kinds = occluders.map((occluder) => occluder.ref.split('/')[0])
    expect(occluders).toHaveLength(15 + 2 + 2 + 4 + 6)
    expect(kinds.filter((kind) => kind === 'wall')).toHaveLength(15)
    expect(occluders.filter((occluder) => occluder.kind === 'sphere')).toHaveLength(4)
  })

  it('shades the north side of an east-west wall at solar noon and lights the south side', () => {
    const project = wallOnlyProject()
    const occluders = collectOccluders(project)
    expect(isLitAt(project, occluders, { x: 0, y: 0.3, z: 1 }, noon)).toBe(false)
    expect(isLitAt(project, occluders, { x: 0, y: 0.3, z: -1 }, noon)).toBe(true)
    expect(isLitAt(project, occluders, { x: 0, y: 0.3, z: 6 }, noon)).toBe(true)
  })

  it('lets a rotated building shade with its own orientation', () => {
    const project = wallOnlyProject()
    project.buildings[0].rotationDegrees = 90
    const occluders = collectOccluders(project)
    expect(isLitAt(project, occluders, { x: 1, y: 0.3, z: 1 }, noon)).toBe(true)
    expect(isLitAt(project, occluders, { x: -1, y: 0.3, z: 0 }, { month: 6, day: 21, hour: 9 })).toBe(true)
    expect(isLitAt(project, occluders, { x: 1, y: 0.3, z: 0 }, { month: 6, day: 21, hour: 9 })).toBe(false)
  })
})

describe('sun-hours analysis', () => {
  it('gives a point north of a tall wall fewer hours than a point in the open, deterministically', () => {
    const project = wallOnlyProject(10, 40)
    const shaded = analyzeSunlight(project, { target: { kind: 'point', x: 0, z: 1 }, month: 6, day: 21, stepMinutes: 30 })
    const open = analyzeSunlight(project, { target: { kind: 'point', x: 0, z: -30 }, month: 6, day: 21, stepMinutes: 30 })
    expect(shaded.sunHours.mean).toBeLessThan(open.sunHours.mean)
    expect(open.sunHours.mean).toBeCloseTo(open.daylightHours, 0)
    expect(shaded.sunHours.mean).toBeLessThan(open.sunHours.mean * 0.55)
    expect(shaded.sunHours.mean).toBeGreaterThan(0)
    expect(analyzeSunlight(project, { target: { kind: 'point', x: 0, z: 1 }, month: 6, day: 21, stepMinutes: 30 })).toEqual(shaded)
  })

  it('reports sunrise, sunset and an expected value scaled by the climate sunshine ratio', () => {
    const result = analyzeSunlight(modernBarnProject, { target: { kind: 'zone', ref: 'zone/lawn' }, month: 6, day: 21 })
    expect(result.sunriseLocal).toBeCloseTo(4.51, 1)
    expect(result.sunsetLocal).toBeCloseTo(20.9, 1)
    const sunshine = modernBarnProject.climateProfile.months[5].sunshineHours
    expect(result.expectedSunHours).toBeCloseTo(result.sunHours.mean * sunshine / (result.daylightHours * 30.44), 1)
    expect(result.sampleCount).toBeGreaterThan(50)
    expect(result.grid).toBeUndefined()
  })

  it('returns a compact grid whose cells outside the zone are marked -1', () => {
    const result = analyzeSunlight(modernBarnProject, { target: { kind: 'zone', ref: 'zone/rain-garden' }, month: 6, day: 21, cellM: 0.5, includeGrid: true })
    expect(result.grid).toBeDefined()
    expect(result.grid!.hours).toHaveLength(result.grid!.width * result.grid!.height)
    expect(result.grid!.hours.every((value) => value === -1 || (value >= 0 && value <= result.daylightHours))).toBe(true)
    expect(result.grid!.hours.filter((value) => value >= 0)).toHaveLength(result.sampleCount)
  })

  it('shows the upper-storey extension taking morning sun from the courtyard terrace', () => {
    const extended = applyCommand(partialUpperModernBarnProject, {
      type: 'storey.update', action: 'extend-footprint', buildingRef: 'house/main', storeyRef: 'house/main/storey-upper',
      extensionFootprint: [{ x: -8, z: -5 }, { x: 8, z: -5 }, { x: 8, z: 1 }, { x: -2, z: 1 }, { x: -8, z: 1 }],
    })
    const before = analyzeSunlight(partialUpperModernBarnProject, { target: { kind: 'zone', ref: 'zone/terrace' }, month: 9, day: 21 })
    const after = analyzeSunlight(extended, { target: { kind: 'zone', ref: 'zone/terrace' }, month: 9, day: 21 })
    expect(after.sunHours.mean).toBeLessThan(before.sunHours.mean)
  })

  it('restricts sampling to a local-time window when asked', () => {
    const project = wallOnlyProject(10, 40)
    const core = analyzeSunlight(project, { target: { kind: 'point', x: 0, z: 1 }, month: 6, day: 21, hours: { from: 9, to: 17 } })
    expect(core.window).toEqual({ fromLocal: 9, toLocal: 17 })
    expect(core.sunHours.mean).toBe(0)
    const open = analyzeSunlight(project, { target: { kind: 'point', x: 0, z: -30 }, month: 6, day: 21, hours: { from: 9, to: 17 } })
    expect(open.sunHours.mean).toBeCloseTo(8, 1)
  })

  it('stays within the time budget for a fine grid over the lawn', () => {
    const started = performance.now()
    const result = analyzeSunlight(modernBarnProject, { target: { kind: 'zone', ref: 'zone/lawn' }, month: 6, day: 21, cellM: 0.2, stepMinutes: 30 })
    expect(result.sampleCount).toBeGreaterThan(1500)
    expect(performance.now() - started).toBeLessThan(1500)
  })
})

describe('planting sun-mismatch validation', () => {
  it('warns about a crop bed hidden behind a tall wall and not about one in the open', () => {
    const project = wallOnlyProject(10, 40)
    const shadedBed = applyCommand(applyCommand(project,
      { type: 'garden-fixture.update', action: 'add', fixtureRef: 'fixture/shaded-bed', catalogId: 'raised-bed-2x1', position: { x: 0, z: 1.2 } }),
      { type: 'garden-fixture.update', action: 'add', fixtureRef: 'fixture/shaded-crop', catalogId: 'tomato-row', position: { x: 0, z: 1.2 } })
    expect(validateProject(shadedBed)).toContainEqual(expect.objectContaining({ severity: 'warning', code: 'planting.sun-mismatch', subjectRef: 'fixture/shaded-crop' }))
    const openBed = applyCommand(applyCommand(project,
      { type: 'garden-fixture.update', action: 'add', fixtureRef: 'fixture/open-bed', catalogId: 'raised-bed-2x1', position: { x: 0, z: -20 } }),
      { type: 'garden-fixture.update', action: 'add', fixtureRef: 'fixture/open-crop', catalogId: 'potato-row', position: { x: 0, z: -20 } })
    expect(validateProject(openBed).filter((issue) => issue.code === 'planting.sun-mismatch')).toEqual([])
  })

  it('leaves the bundled project and its partial-sun hedges without sun warnings', () => {
    expect(validateProject(modernBarnProject).filter((issue) => issue.code === 'planting.sun-mismatch')).toEqual([])
  })
})
