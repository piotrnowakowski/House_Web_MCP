import { expect, it } from 'vitest'
import { createReferenceHouse } from './referenceHouse'
import { modernBarnProject } from './sampleProject'
import { fitZielonkiInterior } from './zielonkiInterior'
import { houseEnvelopeWorld, upgradeZielonkiCourtyard, upgradeZielonkiPlacement } from './zielonkiPlacement'
import { buildingFootprintsWorld, pointInPolygon, pointOnPolygonBoundary, polygonArea, polygonCentroid } from './geometry'
import { parseProject } from './schema'
import { validateProject } from './commands'

const distance = (p: { x: number; z: number }, a: { x: number; z: number }, b: { x: number; z: number }) =>
  Math.abs((b.x - a.x) * (a.z - p.z) - (a.x - p.x) * (b.z - a.z)) / Math.hypot(b.x - a.x, b.z - a.z)

it('fits the former courtyard flush to both house wings and preserves later terrace edits', () => {
  const source = upgradeZielonkiPlacement(fitZielonkiInterior(modernBarnProject, createReferenceHouse()))
  const terrace = source.landscape.zones.find((zone) => zone.ref === 'zone/terrace')!
  expect(terrace.name).toBe('Taras przy budynku')
  expect(terrace.kind).toBe('terrace')
  expect(polygonArea(terrace.footprint)).toBeCloseTo(3.51 * 10.56, 4)
  const footprint = buildingFootprintsWorld(source.buildings[0])[0]
  for (const index of [1, 3]) {
    const corner = terrace.footprint[0]; const end = terrace.footprint[index]
    expect(pointOnPolygonBoundary(corner, footprint)).toBe(true)
    expect(pointOnPolygonBoundary(end, footprint)).toBe(true)
    expect(pointOnPolygonBoundary({ x: (corner.x + end.x) / 2, z: (corner.z + end.z) / 2 }, footprint)).toBe(true)
  }
  expect(pointInPolygon(polygonCentroid(terrace.footprint), footprint)).toBe(false)
  expect(terrace.footprint.every((p) => pointInPolygon(p, source.site.boundary) || pointOnPolygonBoundary(p, source.site.boundary))).toBe(true)
  const legacy = structuredClone(source)
  legacy.buildings[0].interiorSource!.notes = legacy.buildings[0].interiorSource!.notes.filter((note) => !note.startsWith('Courtyard terrace revision'))
  legacy.landscape.zones.find((zone) => zone.ref === terrace.ref)!.name = 'Sheltered L-courtyard terrace'
  legacy.landscape.zones.find((zone) => zone.ref === terrace.ref)!.footprint = structuredClone(modernBarnProject.landscape.zones.find((zone) => zone.ref === terrace.ref)!.footprint)
  const before = structuredClone(legacy)
  const updated = upgradeZielonkiPlacement(legacy)
  expect(updated.landscape.zones).toEqual(source.landscape.zones)
  expect(updated.revision).toBe(legacy.revision + 1)
  expect(legacy).toEqual(before)
  terrace.footprint[1].x += 0.2
  terrace.textureId = 'brick-pavement'
  expect(upgradeZielonkiCourtyard(source)).toBe(source)
})

it('places the outside house faces 4 m from the neighbour and 5.25 m from the road, with a connected garage apron', () => {
  const before = fitZielonkiInterior(modernBarnProject, createReferenceHouse())
  const snapshot = structuredClone(before)
  const after = upgradeZielonkiPlacement(before); const house = after.buildings[0]
  const envelope = houseEnvelopeWorld(house)
  const corner = { x: -19.778, z: -15.1 }
  expect(Math.min(...envelope.map((p) => distance(p, corner, { x: -18.403, z: 10.53 })))).toBeCloseTo(5.25, 6)
  expect(Math.min(...envelope.map((p) => distance(p, corner, { x: -10.621, z: -15.591 })))).toBeCloseTo(4, 6)
  // The garage edge follows the road, and the long facade follows the neighbouring boundary.
  expect(house.rotationDegrees).toBeCloseTo(273.06927, 5)
  expect(envelope.every((p) => pointInPolygon(p, after.site.boundary) || pointOnPolygonBoundary(p, after.site.boundary))).toBe(true)
  const driveway = after.landscape.zones.find((z) => z.ref === 'zone/driveway')!
  const entrance = after.site.entrances.find((e) => e.ref === 'entrance/house-road')!
  expect(driveway.footprint[0]).toEqual(entrance.start)
  expect(driveway.footprint[3]).toEqual(entrance.end)
  expect(driveway.footprint.every((p) => pointInPolygon(p, after.site.boundary) || pointOnPolygonBoundary(p, after.site.boundary))).toBe(true)
  expect(house.roof.segments.every((s) => s.overhangM === 0)).toBe(true)
  expect(house.roof.segments.filter((s) => s.type === 'gable').every((s) => s.gableFrame?.widthM === 0.4)).toBe(true)
  expect(house.slabs).toEqual(before.buildings[0].slabs)
  expect(house.walls).toEqual(before.buildings[0].walls)
  expect(house.furniture).toEqual(before.buildings[0].furniture)
  expect(before).toEqual(snapshot)
  expect(validateProject(after).filter((i) => i.severity === 'error')).toEqual([])
  expect(parseProject(JSON.parse(JSON.stringify(after)))).toEqual(after)
  house.position.x += 1
  house.roof.segments[0].gableFrame!.colorHex = '#555555'
  expect(upgradeZielonkiPlacement(after)).toBe(after)
})
