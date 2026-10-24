import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('textured garden tree assets', () => {
  it('ships bounded detailed/mobile meshes with bark and seasonal foliage materials', () => {
    const counts = new Map<string, number>()
    for (const name of ['orchard-tree-realistic', 'conifer-realistic', 'orchard-tree-mobile', 'conifer-mobile', 'columnar-evergreen', 'columnar-evergreen-mobile', 'mature-pine', 'mature-spruce']) {
      const bytes = readFileSync(`public/models/garden/${name}.glb`)
      expect(bytes.toString('utf8', 0, 4)).toBe('glTF')
      const gltf = JSON.parse(bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12)))
      const triangles = gltf.meshes.reduce((sum: number, mesh: { primitives: { indices: number }[] }) => sum + mesh.primitives.reduce((n, p) => n + gltf.accessors[p.indices].count / 3, 0), 0)
      counts.set(name, triangles)
      expect(triangles).toBeLessThan(name === 'mature-spruce' ? 510000 : name === 'mature-pine' ? 250000 : name === 'columnar-evergreen-mobile' ? 14000 : 45000)
      expect(bytes.length).toBeLessThan(name === 'mature-spruce' ? 19500000 : name === 'mature-pine' ? 7000000 : 1600000)
      expect(gltf.materials.some((m: { name: string }) => /leav|twig|foliage/i.test(m.name))).toBe(true)
      expect(gltf.materials.some((m: { name: string }) => /bark|trunk/i.test(m.name))).toBe(true)
      expect(gltf.images.length).toBeGreaterThan(0)
    }
    // Further simplification removes disconnected leaf cards and makes summer crowns look bare.
    for (const name of ['orchard-tree', 'conifer']) expect(counts.get(`${name}-mobile`)).toBe(counts.get(`${name}-realistic`))
  })
})
