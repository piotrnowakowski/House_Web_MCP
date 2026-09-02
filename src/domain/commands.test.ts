import { describe, expect, it } from 'vitest'
import { applyCommand, calculateMetrics, polygonArea, validateProject } from './commands'
import { sampleProject } from './sampleProject'
import { ProjectSchema } from './schema'

describe('ProjectV1 command bus', () => {
  it('keeps the bundled project valid and measurable', () => {
    expect(ProjectSchema.safeParse(sampleProject).success).toBe(true)
    expect(polygonArea(sampleProject.plot.boundary)).toBeGreaterThan(1_000)
    expect(calculateMetrics(sampleProject)).toMatchObject({ homeAreaM2: 71.3, roomCount: 4, plantCount: 4 })
    expect(validateProject(sampleProject).filter((issue) => issue.severity === 'error')).toEqual([])
  })

  it('adds an upper floor without mutating the source project', () => {
    const result = applyCommand(sampleProject, {
      type: 'floor.update', action: 'add', buildingRef: 'house/main', floorRef: 'floor/upper-test', name: 'Upper floor', heightM: 2.9,
    })
    expect(sampleProject.buildings[0].floors).toHaveLength(1)
    expect(result.buildings[0].floors).toHaveLength(2)
    expect(result.buildings[0].floors[1]).toMatchObject({ ref: 'floor/upper-test', level: 1, defaultHeightM: 2.9 })
    expect(calculateMetrics(result).homeAreaM2).toBeGreaterThan(calculateMetrics(sampleProject).homeAreaM2)
  })

  it('switches architectural style and its roof preset as one reversible command', () => {
    const barn = applyCommand(sampleProject, {
      type: 'building.update', action: 'set-style', buildingRef: 'house/main', architecturalStyle: 'barn',
    })
    const futuristic = applyCommand(sampleProject, {
      type: 'building.update', action: 'set-style', buildingRef: 'house/main', architecturalStyle: 'futuristic',
    })

    expect(sampleProject.buildings[0].architecturalStyle).toBe('classic')
    expect(barn.buildings[0]).toMatchObject({ architecturalStyle: 'barn', roof: { type: 'gable', pitchDegrees: 45 } })
    expect(futuristic.buildings[0]).toMatchObject({ architecturalStyle: 'futuristic', roof: { type: 'flat', pitchDegrees: 0 } })
  })

  it('prevents edits to locked rooms', () => {
    expect(() => applyCommand(sampleProject, {
      type: 'room.update', action: 'resize', buildingRef: 'house/main', floorRef: 'floor/ground', roomRef: 'room/kitchen', widthM: 5,
    })).toThrow(/locked/)
  })

  it('creates a mezzanine inside an unlocked room', () => {
    const result = applyCommand(sampleProject, {
      type: 'mezzanine.update', action: 'add', buildingRef: 'house/main', floorRef: 'floor/ground', roomRef: 'room/living-room', mezzanineRef: 'room/living-room/mezzanine-test', widthM: 2.4, depthM: 3,
    })
    const living = result.buildings[0].floors[0].rooms.find((room) => room.ref === 'room/living-room')!
    expect(living.mezzanines).toHaveLength(1)
    expect(validateProject(result).filter((issue) => issue.severity === 'error')).toEqual([])
  })

  it('generates a low-water garden while retaining locked elements', () => {
    const result = applyCommand(sampleProject, {
      type: 'garden.plan', goals: ['low water', 'vegetable garden'], preserveRefs: ['zone/terrace', 'plant/apple'], waterPreference: 'low',
    })
    expect(result.garden.zones.some((zone) => zone.ref === 'zone/terrace')).toBe(true)
    expect(result.garden.zones.some((zone) => zone.kind === 'vegetable')).toBe(true)
    expect(result.garden.plants.some((plant) => plant.ref === 'plant/apple')).toBe(true)
    expect(result.garden.plants.some((plant) => plant.species === 'Geranium macrorrhizum')).toBe(true)
    expect(result.garden.plants.some((plant) => plant.species === 'Lavandula angustifolia')).toBe(false)
  })
})
