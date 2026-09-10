import beforeBrowserCapture from '../../project-data/zielonki/before-browser-capture-r46.json'
import { expect, it } from 'vitest'
import previousData from '../../project-data/zielonki/published-base-r43.json'
import { publishedProject } from '../services/publishedProject'
import { atticClearanceAt, atticWallProfile, wallProfileHeightAt } from './attic'
import { validateProject } from './commands'
import { gableGlazingProfile } from './gableGlazing'
import { wallLength } from './geometry'
import { availableInteriorHeight } from './interior'
import { mergeProjects } from './projectMerge'
import { roofSegmentRidgeElevation } from './roofs'
import { parseProject } from './schema'

const previous = parseProject(previousData), building = publishedProject.buildings[0]
const upper = building.storeys.find((s) => s.level === 1)!

it('lowers both gable roofs by 1.4 m at unchanged pitches and keeps the ground floor and terrace intact', () => {
  expect(upper.kneeWallHeightM).toBe(1.4)
  for (const roof of building.roof.segments) {
    const before = previous.buildings[0].roof.segments.find((s) => s.ref === roof.ref)!
    if (roof.type === 'flat') { expect(roof).toEqual(before); continue }
    expect(roof.baseElevationM - upper.elevationM).toBeCloseTo(1.4)
    expect(roofSegmentRidgeElevation(before) - roofSegmentRidgeElevation(roof)).toBeCloseTo(1.4)
    expect(roof.pitchDegrees).toBe(before.pitchDegrees)
    expect(roof.footprint).toEqual(before.footprint)
  }
  expect(building.walls.filter((w) => w.baseElevationM < 3)).toEqual(previous.buildings[0].walls.filter((w) => w.baseElevationM < 3))
  expect(building.slabs).toEqual(previous.buildings[0].slabs)
  expect(building.furniture).toEqual(previous.buildings[0].furniture)
  expect(beforeBrowserCapture.landscape).toEqual(previous.landscape)
  expect(validateProject(publishedProject).filter((i) => i.severity === 'error')).toEqual([])
})

it('caps partitions at the roof and preserves full height nearer the ridge', () => {
  const wall = building.walls.find((w) => w.ref === 'wall/reference-upper/3')!
  const profile = atticWallProfile(building, wall)!
  expect(profile.some((p) => Math.abs(p.z - 1.4) < 0.001)).toBe(true)
  expect(profile.some((p) => p.z === 2.8)).toBe(true)
  for (const wall of building.walls.filter((w) => upper.wallRefs.includes(w.ref))) {
    const profile = atticWallProfile(building, wall)!
    for (let i = 0; i <= 40; i++) {
      const t = i / 40, point = { x: wall.start.x + (wall.end.x - wall.start.x) * t, z: wall.start.z + (wall.end.z - wall.start.z) * t }
      expect(wallProfileHeightAt(profile, t * wallLength(wall))).toBeCloseTo(Math.min(wall.heightM, atticClearanceAt(building, upper, point)), 5)
    }
  }
})

it('fits doors under the slopes and preserves the divided trapezoid upper panes', () => {
  const roof = building.roof.segments.find((s) => s.ref.endsWith('/front-barn'))!
  expect(gableGlazingProfile(roof, 'max', building)!.panels).toHaveLength(2)
  const edited = structuredClone(publishedProject)
  edited.buildings[0].walls.find((w) => w.ref === 'wall/reference-upper/21')!.openings[0].heightM = 3.5
  expect(validateProject(edited)).toContainEqual(expect.objectContaining({ code: 'opening.roof' }))
})

it('uses sloping clearance for furniture while retaining the existing bed', () => {
  const bed = building.furniture!.find((f) => f.storeyRef === upper.ref)!
  expect(availableInteriorHeight(bed, building, upper)).toBeGreaterThan(bed.heightM)
  const wardrobe = { ...bed, position: { x: -5.1, z: 6 }, widthM: 0.6, depthM: 1, rotationDegrees: 0, heightM: 2.2 }
  expect(availableInteriorHeight(wardrobe, building, upper)).toBeLessThan(wardrobe.heightM)
})

it('merges r43 working copies without restoring deleted trees and keeps older projects rectangular', () => {
  const local = structuredClone(previous), removed = local.landscape.plants.pop()!
  const result = mergeProjects(previous, local, publishedProject)
  expect(result.conflicts).toEqual([])
  expect(result.project.landscape.plants.some((p) => p.ref === removed.ref)).toBe(false)
  expect(result.project.buildings[0].storeys[1].kneeWallHeightM).toBe(1.4)
  expect(atticWallProfile(previous.buildings[0], previous.buildings[0].walls[0])).toBeUndefined()
  expect(parseProject(publishedProject)).toEqual(publishedProject)
})
