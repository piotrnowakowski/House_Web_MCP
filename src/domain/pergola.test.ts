import { expect, it } from 'vitest'
import { publishedProject } from '../services/publishedProject'
import { validateProject } from './commands'
import { pergolaMembers } from './pergola'
import { parseProject } from './schema'
import { collectOccluders, isLitAt } from './sunlight'
import type { RoofSegmentModel } from './types'

const pergola: RoofSegmentModel = {
  ref: 'roof/test-pergola', type: 'flat', footprint: [{ x: -2, z: -2 }, { x: 2, z: -2 }, { x: 2, z: 2 }, { x: -2, z: 2 }],
  baseElevationM: 2.6, pitchDegrees: 0, overhangM: 0, ridgeDirection: 'z', finish: { material: 'membrane', colorHex: '#333333' }, adjacentSegmentRefs: [],
  canopy: { fasciaHeightM: 0.18, fasciaEdgeIndices: [0, 1, 2, 3], soffitColorHex: '#C8A476', postWidthM: 0.12, postBaseElevationM: 0,
    posts: [{ x: -1.9, z: -1.9 }, { x: 1.9, z: 1.9 }], slats: { direction: 'x', spacingM: 0.5, widthM: 0.08 } },
}

it('preserves an open pergola through schema parsing and rejects a walkable terrace on it', () => {
  const project = structuredClone(publishedProject)
  project.buildings[0].roof.segments.push(structuredClone(pergola))
  const parsed = parseProject(JSON.parse(JSON.stringify(project)))
  expect(parsed.buildings[0].roof.segments.at(-1)?.canopy?.slats).toEqual(pergola.canopy!.slats)
  expect(validateProject(parsed).filter(issue => issue.severity === 'error')).toEqual([])
  parsed.buildings[0].roof.segments.at(-1)!.terrace = { railingHeightM: 1.1, openEdgeIndex: 0, frameColorHex: '#333333' }
  expect(validateProject(parsed)).toContainEqual(expect.objectContaining({ code: 'roof.pergola', severity: 'error' }))
})

it('supports its beams on posts and lets sunlight through the gaps instead of shading as a solid slab', () => {
  const members = pergolaMembers(pergola)
  const post = members.find(m => m.size.y > 1)!
  const beam = members[0]
  expect(post.centre.y + post.size.y / 2).toBeCloseTo(beam.centre.y - beam.size.y / 2)
  const project = structuredClone(publishedProject)
  const building = project.buildings[0]
  project.landscape.plants = []; project.landscape.fixtures = []
  building.position = { x: 0, z: 0 }; building.rotationDegrees = 0
  building.walls = []; building.slabs = []; building.roof.segments = [structuredClone(pergola)]
  const open = collectOccluders(project)
  delete building.roof.segments[0].canopy
  const closed = collectOccluders(project)
  let openSun = 0, closedSun = 0
  for (let x = -0.5; x < 0.5; x += 0.1) for (let z = -0.5; z < 0.5; z += 0.1) {
    const point = { x, y: 1, z }, time = { month: 6, day: 21, hour: 12.7 }
    if (isLitAt(project, open, point, time)) openSun++
    if (isLitAt(project, closed, point, time)) closedSun++
  }
  expect(openSun).toBeGreaterThan(0)
  expect(closedSun).toBe(0)
})
