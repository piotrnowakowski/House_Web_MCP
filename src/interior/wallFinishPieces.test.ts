import { expect, it } from 'vitest'
import { wallFinishPieces, wallFinishProfiles, wallLiningDepthM } from './wallFinishPieces'
import data from '../../project-data/architekt-7-11/before-four-winders-r14.json'
import before from '../../project-data/architekt-7-11/before-oak-side-walls-r13.json'
import { parseProject } from '../domain/schema'
import { validateProject } from '../domain/commands'
import { mergeProjects } from '../domain/projectMerge'
import { atticClearanceAt, wallProfileHeightAt } from '../domain/attic'
import { wallLength } from '../domain/geometry'

it('limits oak to five inward side-wall faces while preserving geometry, glazing and other finishes', () => {
  const p = parseProject(data), old = parseProject(before), house = p.buildings[0]
  expect(validateProject(p).filter(i => i.severity === 'error')).toEqual([])
  const changed = house.walls.filter(w => JSON.stringify(w.faceFinishes) !== JSON.stringify(old.buildings[0].walls.find(o => o.ref === w.ref)!.faceFinishes))
  expect(changed.map(w => w.ref).sort()).toEqual([
    'wall/architekt/ground/18', 'wall/architekt/ground/20', 'wall/architekt/correction/1/living-void/1',
    'wall/architekt/upper/26', 'wall/architekt/correction/1/child-two/3',
  ].sort())
  for (const wall of changed) {
    const finish = wall.faceFinishes?.left ?? wall.faceFinishes?.right
    expect(finish).toMatchObject({ presetId: 'natural-oak', rotationDegrees: 90, tileM: .96 })
    const previous = old.buildings[0].walls.find(w => w.ref === wall.ref)!
    if (previous.faceFinishes) wall.faceFinishes = previous.faceFinishes
    else delete wall.faceFinishes
  }
  expect({ ...p, revision: old.revision, updatedAt: old.updatedAt }).toEqual(old)
})

it('clips the lining around the terrace glazing and across the solid slab fascia only', () => {
  const finish = { presetId: 'natural-oak', color: '#FFFFFF', rotationDegrees: 90, tileM: .96, spanM: [1, 4] as [number, number], baseExtensionM: .33 }
  const pieces = wallFinishPieces([
    { start: 0, end: 2, height: 2.92 },
    { start: 2, end: 3, base: 2.4, height: .52 },
    { start: 3, end: 5, height: 2.92 },
  ], finish, true)
  expect(pieces.map(p => [p.start, p.end])).toEqual([[1, 2], [2, 3], [3, 4]])
  expect(pieces[0].base).toBe(-.33)
  expect(pieces[1]).toMatchObject({ base: 2.4, height: .52 })
  expect(pieces[2].base).toBe(-.33)
  expect(wallFinishPieces([{ start: 0, end: .5, height: 3 }], finish, true)).toEqual([])
  expect(wallFinishPieces([{ start: 1, end: 2, height: .14 }], finish, false)[0].base).toBe(0)
})

it('meets the ceiling skin at the inner wall face without extending through the roof', () => {
  const h = parseProject(data).buildings[0], upper = h.storeys[1]
  for (const wall of h.walls.filter(w => upper.wallRefs.includes(w.ref))) {
    for (const side of ['left', 'right'] as const) {
      if (!wall.faceFinishes?.[side]?.followRoof) continue
      const profile = wallFinishProfiles(h, wall)[side]!, length = wallLength(wall)
      const offset = (side === 'left' ? 1 : -1) * (wall.thicknessM / 2 + wallLiningDepthM)
      for (let i = 0; i <= 10; i++) {
        const t = i / 10, point = {
          x: wall.start.x + t * (wall.end.x - wall.start.x) - (wall.end.z - wall.start.z) / length * offset,
          z: wall.start.z + t * (wall.end.z - wall.start.z) + (wall.end.x - wall.start.x) / length * offset,
        }
        expect(wallProfileHeightAt(profile, t * length) + .025).toBeCloseTo(atticClearanceAt(h, upper, point) - .015, 5)
      }
    }
  }
})

it('merges wall finishes without recreating deleted furniture and reports competing finishes', () => {
  const old = parseProject(before), local = structuredClone(old), incoming = parseProject(data)
  local.buildings[0].furniture!.pop()
  const merged = mergeProjects(old, local, incoming)
  expect(merged.conflicts).toEqual([])
  expect(merged.project.buildings[0].walls).toEqual(incoming.buildings[0].walls)
  expect(merged.project.buildings[0].furniture).toEqual(local.buildings[0].furniture)
  local.buildings[0].walls.find(w => w.ref === 'wall/architekt/ground/18')!.faceFinishes = { left: { presetId: 'warm-white', color: '#FFFFFF', rotationDegrees: 0, tileM: 1 } }
  expect(mergeProjects(old, local, incoming).conflicts).toContain('/buildings/house/main/walls/wall/architekt/ground/18/faceFinishes')
})
