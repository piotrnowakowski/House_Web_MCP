import { expect, it } from 'vitest'
import previousData from '../../project-data/zielonki/published-base-r42.json'
import { publishedProject } from '../services/publishedProject'
import { validateProject } from './commands'
import { polygonArea } from './geometry'
import { mergeProjects } from './projectMerge'
import { roofTerraceOutline } from './roofTerrace'
import { parseProject } from './schema'

const garageRef = 'roof/reference/garage-cap', canopyRef = 'roof/reference/courtyard-canopy'
const previous = parseProject(previousData)

it('creates a continuous L-shaped upper terrace with a shared fascia and no internal guard', () => {
  const building = publishedProject.buildings[0]
  const garage = building.roof.segments.find((s) => s.ref === garageRef)!
  const canopy = building.roof.segments.find((s) => s.ref === canopyRef)!
  const outline = roofTerraceOutline(building, garage)
  expect(outline).toEqual([
    { x: -5.495, z: 8.385 }, { x: 2.085, z: 8.385 }, { x: 2.085, z: 0.995 },
    { x: 5.585, z: 0.995 }, { x: 5.585, z: 11.555 }, { x: -5.495, z: 11.555 },
  ])
  expect(polygonArea(outline)).toBeCloseTo(polygonArea(garage.footprint) + polygonArea(canopy.footprint))
  expect(garage.terrace!.openEdgeIndices).toEqual([0, 1, 2])
  expect(canopy.finish).toEqual(garage.finish)
  expect(canopy.canopy!.fasciaEdgeIndices).toEqual([])
  expect(garage.terrace!.fasciaHeightM).toBe(canopy.canopy!.fasciaHeightM)
  expect(canopy.canopy!.frameColorHex).toBe(garage.terrace!.frameColorHex)
  expect(parseProject(publishedProject)).toEqual(publishedProject)
})

it('retains single-roof terrace compatibility', () => {
  const building = previous.buildings[0], garage = building.roof.segments.find((s) => s.ref === garageRef)!
  expect(roofTerraceOutline(building, garage)).toEqual(garage.footprint)
})

it('merges the terrace connection with a local tree deletion and reports competing guard edits', () => {
  const local = structuredClone(previous)
  const deleted = local.landscape.plants.pop()!
  const merged = mergeProjects(previous, local, publishedProject)
  expect(merged.conflicts).toEqual([])
  expect(merged.project.landscape.plants.some((p) => p.ref === deleted.ref)).toBe(false)
  expect(validateProject(merged.project).filter((i) => i.severity === 'error')).toEqual([])
  local.buildings[0].roof.segments.find((s) => s.ref === garageRef)!.terrace!.frameColorHex = '#ffffff'
  expect(mergeProjects(previous, local, publishedProject).conflicts.length).toBeGreaterThan(0)
})

it.each(['height', 'missing', 'disconnected', 'duplicate', 'internal-guard', 'invalid-edge'])('rejects invalid connected terraces: %s', (fault) => {
  const project = structuredClone(publishedProject), building = project.buildings[0]
  const garage = building.roof.segments.find((s) => s.ref === garageRef)!, canopy = building.roof.segments.find((s) => s.ref === canopyRef)!
  if (fault === 'height') canopy.baseElevationM += 0.2
  if (fault === 'missing') garage.terrace!.connectedSegmentRefs = ['missing']
  if (fault === 'disconnected') canopy.footprint.forEach((p) => { p.x += 20 })
  if (fault === 'duplicate') garage.terrace!.connectedSegmentRefs!.push(canopyRef)
  if (fault === 'internal-guard') canopy.terrace = { railingHeightM: 1.1, openEdgeIndex: 0, frameColorHex: '#333333' }
  if (fault === 'invalid-edge') garage.terrace!.openEdgeIndices = [99]
  expect(validateProject(project)).toContainEqual(expect.objectContaining({ severity: 'error', code: 'roof.terrace', subjectRef: garageRef }))
})
