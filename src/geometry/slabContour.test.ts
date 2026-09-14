import { expect, it } from 'vitest'
import { getManifoldModule } from 'manifold-3d/lib/wasm'
import data from '../../project-data/zielonki-rear-bath-room/project.json'
import { slabContour } from './slabContour'
import { polygonArea } from '../domain/geometry'
import { parseProject } from '../domain/schema'

it('generates solid floors and cuts the stair and living/dining voids for either outline winding', async () => {
  const { Manifold } = await getManifoldModule()
  for (const slab of parseProject(data).buildings[0].slabs) for (const reverse of [false, true]) {
    const shape = reverse ? [...slab.footprint].reverse() : slab.footprint
    let solid = Manifold.extrude([slabContour(shape)], slab.thicknessM)
    expect(solid.status()).toBe('NoError')
    expect(solid.numVert()).toBeGreaterThan(0)
    for (const hole of slab.holes ?? []) {
      const cutter = Manifold.extrude([slabContour(reverse ? [...hole].reverse() : hole)], slab.thicknessM)
      const next = solid.subtract(cutter)
      cutter.delete(); solid.delete(); solid = next
    }
    const netArea = polygonArea(slab.footprint) - (slab.holes ?? []).reduce((sum, hole) => sum + polygonArea(hole), 0)
    expect(solid.status()).toBe('NoError')
    expect(solid.volume()).toBeCloseTo(netArea * slab.thicknessM, 5)
    solid.delete()
  }
})
