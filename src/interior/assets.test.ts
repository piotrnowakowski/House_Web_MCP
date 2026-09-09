import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ikeaCatalog } from '../domain/ikeaCatalog'
import { floorGeometry } from './floorGeometry'
import { polygonArea } from '../domain/geometry'

describe('Redistributable interior asset package', () => {
  for (const product of ikeaCatalog)
    it(`${product.family} ${product.id}: embedded GLB, physical bounds, mobile level and thumbnail`, () => {
      let desktopTriangles = 0
      for (const [index, path] of [product.model, product.mobileModel].entries()) {
        const buffer = readFileSync(resolve('public', path))
        expect(buffer.readUInt32LE(0)).toBe(0x46546c67)
        expect(buffer.readUInt32LE(8)).toBe(buffer.length)
        const json = JSON.parse(buffer.subarray(20, 20 + buffer.readUInt32LE(12)).toString('utf8'))
        expect(buffer.length).toBeLessThan(1_500_000)
        expect(json.images.length).toBeGreaterThan(0)
        expect(
          (json.images ?? []).every(
            (image: { bufferView?: number; uri?: string }) => image.bufferView !== undefined && !image.uri,
          ),
        ).toBe(true)
        const positions = json.meshes.flatMap((mesh: any) =>
          mesh.primitives.map((primitive: any) => json.accessors[primitive.attributes.POSITION]),
        )
        const min = [0, 1, 2].map((axis) => Math.min(...positions.map((p: any) => p.min[axis])))
        const max = [0, 1, 2].map((axis) => Math.max(...positions.map((p: any) => p.max[axis])))
        for (const [axis, size] of [product.size[0], product.size[2], product.size[1]].entries())
          expect(max[axis] - min[axis]).toBeCloseTo(size, 4)
        expect(min[1]).toBeCloseTo(0, 4)
        expect(min[0] + max[0]).toBeCloseTo(0, 4)
        expect(min[2] + max[2]).toBeCloseTo(0, 4)
        const triangles = positions.reduce((sum: number, p: any) => sum + p.count / 3, 0)
        if (!index) desktopTriangles = triangles
        else expect(triangles).toBeLessThanOrEqual(desktopTriangles)
      }
      const thumbnail = readFileSync(resolve('public', product.thumbnail))
      expect(thumbnail.subarray(1, 4).toString()).toBe('PNG')
      expect(thumbnail.length).toBeGreaterThan(3000)
      expect(product.productUrl).toMatch(/^https:\/\/www.ikea.com\/pl\/pl\/p\//)
      expect(product.articleNumber).toMatch(/^\d{8}$/)
      expect(product.sourceDate).toBe('2026-09-09')
      expect(product.license).toBe('CC0-1.0')
    })
})

it('clips a floor void that touches a room edge without drawing outside that room', () => {
  const slab = [
    { x: 0, z: 0 },
    { x: 8, z: 0 },
    { x: 8, z: 8 },
    { x: 0, z: 8 },
  ]
  const room = [
    { x: 0, z: 0 },
    { x: 4, z: 0 },
    { x: 4, z: 8 },
    { x: 0, z: 8 },
  ]
  const holes = [
    [
      { x: 3, z: 2 },
      { x: 5, z: 2 },
      { x: 5, z: 5 },
      { x: 3, z: 5 },
    ],
  ]
  const geometry = floorGeometry(room, holes, slab)
  const position = geometry.attributes.position
  expect(geometry.attributes.normal.count).toBe(position.count)
  let area = 0
  for (let i = 0; i < position.count; i += 3) {
    const triangle = [0, 1, 2].map((j) => ({ x: position.getX(i + j), z: position.getZ(i + j) }))
    area += polygonArea(triangle)
    expect(triangle.every((p) => p.x >= 0 && p.x <= 4 && p.z >= 0 && p.z <= 8)).toBe(true)
  }
  expect(area).toBeCloseTo(29)
  geometry.dispose()
})
