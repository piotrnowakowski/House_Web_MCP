import { expect, it } from 'vitest'
import previousData from '../../project-data/zielonki/published-base-r41.json'
import { publishedProject } from '../services/publishedProject'
import { validateProject } from './commands'
import { diffProjects } from './diff'
import { polygonBounds } from './geometry'
import { mergeProjects } from './projectMerge'
import { parseProject } from './schema'

const ref = 'roof/reference/courtyard-canopy'
const previous = parseProject(previousData)

it('joins the ground terrace canopy to the garage cap and projecting wing while preserving the house', () => {
  const building = publishedProject.buildings[0]
  const canopy = building.roof.segments.find((s) => s.ref === ref)!
  const garage = building.roof.segments.find((s) => s.ref.endsWith('/garage-cap'))!
  const wing = building.roof.segments.find((s) => s.ref.endsWith('/rear-barn'))!
  expect(canopy.baseElevationM).toBe(garage.baseElevationM)
  expect(polygonBounds(canopy.footprint).minX).toBe(polygonBounds(garage.footprint).maxX)
  expect(polygonBounds(canopy.footprint).minZ).toBe(polygonBounds(wing.footprint).maxZ)
  expect(garage.adjacentSegmentRefs).toContain(ref)
  expect(canopy.adjacentSegmentRefs).toContain(garage.ref)
  expect(canopy.baseElevationM + 0.24 - canopy.canopy!.fasciaHeightM - canopy.canopy!.postBaseElevationM).toBeCloseTo(2.39)
  const oldBuilding = previous.buildings[0]
  expect(garage.terrace!.railingHeightM).toEqual(oldBuilding.roof.segments.find((s) => s.ref === garage.ref)!.terrace!.railingHeightM)
  expect(building.walls.filter((w) => w.baseElevationM < 3).map(({ finish: _finish, ...wall }) => wall)).toEqual(oldBuilding.walls.filter((w) => w.baseElevationM < 3).map(({ finish: _finish, ...wall }) => wall))
  expect(building.walls.find((w) => w.ref === 'wall/reference-ground/14')!.finish!.material).toBe('natural-timber')
  expect(building.slabs).toEqual(oldBuilding.slabs)
  expect(building.furniture).toEqual(oldBuilding.furniture)
  expect(publishedProject.landscape).toEqual(previous.landscape)
  expect(building.roof.segments.find((s) => s.ref.endsWith('/front-barn'))!.gableGlazing).toEqual(oldBuilding.roof.segments.find((s) => s.ref.endsWith('/front-barn'))!.gableGlazing)
})

it('merges the canopy into an r41 working copy while retaining an independent plant deletion', () => {
  const local = structuredClone(previous)
  const deleted = local.landscape.plants.pop()!
  const result = mergeProjects(previous, local, publishedProject)
  expect(result.conflicts).toEqual([])
  expect(result.project.landscape.plants.some((plant) => plant.ref === deleted.ref)).toBe(false)
  expect(result.project.buildings[0].roof.segments.some((s) => s.ref === ref)).toBe(true)
  expect(validateProject(result.project).filter((issue) => issue.severity === 'error')).toEqual([])
})

it('round-trips canopy details and reports their edits in project proposals', () => {
  const edited = parseProject(JSON.parse(JSON.stringify(publishedProject)))
  const canopy = edited.buildings[0].roof.segments.find((s) => s.ref === ref)!
  canopy.canopy!.fasciaHeightM = 0.55
  expect(diffProjects(publishedProject, edited).changes).toContainEqual({ kind: 'roof-segment', ref, change: 'modified', fields: ['canopy'] })
})

it.each(['post-outside', 'no-clearance', 'invalid-edge', 'pitched-roof'])('rejects invalid canopy geometry: %s', (fault) => {
  const edited = structuredClone(publishedProject)
  const roof = edited.buildings[0].roof.segments.find((s) => s.ref === ref)!
  if (fault === 'post-outside') roof.canopy!.posts[0].x = 100
  if (fault === 'no-clearance') roof.canopy!.fasciaHeightM = 4
  if (fault === 'invalid-edge') roof.canopy!.fasciaEdgeIndices = [99]
  if (fault === 'pitched-roof') roof.type = 'gable'
  expect(validateProject(edited)).toContainEqual(expect.objectContaining({ code: 'roof.canopy', severity: 'error', subjectRef: ref }))
})
