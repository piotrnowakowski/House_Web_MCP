import { expect, it } from 'vitest'
import { DoubleSide, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three'
import data from '../../project-data/paulina-poprawki/project.json'
import { parseProject } from '../domain/schema'
import { spaceFootprint } from '../domain/geometry'
import { ceilingGeometry } from './ceilingGeometry'

it('shows the enlarged living void and stairs from below, while retaining the kitchen ceiling', () => {
  const house = parseProject(data).buildings[0], ground = house.storeys[0]
  const room = house.spaces.find(s => s.ref === 'space/reference-living')!
  const geometry = ceilingGeometry(house, ground, spaceFootprint(house, room), 2.8)
  const material = new MeshBasicMaterial({ side: DoubleSide })
  const mesh = new Mesh(geometry, material)
  const hits = (p: number, q: number) => new Raycaster(new Vector3(p - 4.625, 1, q - 5.945), new Vector3(0, 1, 0)).intersectObject(mesh)
  expect(hits(7, 3)).toHaveLength(0)
  expect(hits(2, 5)).toHaveLength(0)
  expect(hits(3.8, 2).length).toBeGreaterThan(0)
  geometry.dispose(); material.dispose()
})

it('places the ceiling above the void at the attic roof, not at the lower flat ceiling', () => {
  const house = parseProject(data).buildings[0], upper = house.storeys[1]
  const geometry = ceilingGeometry(house, upper, house.slabs[1].holes![1], 2.8, true)
  const material = new MeshBasicMaterial({ side: DoubleSide })
  const mesh = new Mesh(geometry, material)
  const hits = new Raycaster(new Vector3(7 - 4.625, 0, 3.54 - 5.945), new Vector3(0, 1, 0)).intersectObject(mesh)
  expect(hits.length).toBeGreaterThan(0)
  expect(hits[0].point.y).toBeCloseTo(8.0856938754 - upper.elevationM - .015, 1)
  geometry.dispose(); material.dispose()
})
