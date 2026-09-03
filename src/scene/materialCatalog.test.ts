import { existsSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { GardenZoneKind, WallMaterial } from '../domain/types'
import { groundTextureFor, groundTintFor, textureAssets, textureFilesFor, tintForTexturedFinish, wallTextureFor } from './materialCatalog'

const wallMaterials: WallMaterial[] = ['charred-timber', 'natural-timber', 'light-render', 'brick', 'metal-panel']
const zoneKinds: GardenZoneKind[] = ['lawn', 'terrace', 'path', 'driveway', 'bed', 'rain-garden', 'vegetable']

describe('material catalogue', () => {
  it('ships every referenced texture file inside the size budget', () => {
    let total = 0
    for (const key of Object.keys(textureAssets) as Array<keyof typeof textureAssets>) {
      for (const file of Object.values(textureFilesFor(key))) {
        const path = resolve(process.cwd(), 'public', file)
        expect(existsSync(path), path).toBe(true)
        total += statSync(path).size
      }
    }
    expect(total).toBeLessThan(12 * 1024 * 1024)
  })

  it('declares physical tile widths and authors for every asset', () => {
    for (const asset of Object.values(textureAssets)) {
      expect(asset.tileM).toBeGreaterThan(0)
      expect(asset.author.length).toBeGreaterThan(0)
    }
    expect(textureAssets['leafy-grass'].tileM).toBe(2)
    expect(textureAssets['coated-pine'].tileM).toBe(0.7)
  })

  it('maps only real wall materials and zone kinds, textures brick and natural timber, and keeps beds flat', () => {
    for (const key of Object.keys(wallTextureFor)) expect(wallMaterials).toContain(key)
    for (const key of Object.keys(groundTextureFor)) expect(zoneKinds).toContain(key)
    expect(wallTextureFor.brick?.asset).toBe('brick-floor')
    expect(wallTextureFor['natural-timber']).toMatchObject({ asset: 'hinoki', rotation: Math.PI / 2 })
    expect(wallTextureFor['charred-timber']).toBeUndefined()
    expect(groundTextureFor.lawn?.asset).toBe('leafy-grass')
    expect(groundTextureFor.terrace?.asset).toBe('brick-floor')
    expect(groundTextureFor.bed).toBeUndefined()
  })

  it('tints textured finishes 65 percent toward white so the scan keeps most of its colour', () => {
    expect(tintForTexturedFinish('#8B4E3C')).toBe('#D6C1BB')
    expect(tintForTexturedFinish('#ffffff')).toBe('#FFFFFF')
  })

  it('turns the lawn to straw in the dormant months and boosts green in the growing season', () => {
    const dormant = [11, 12, 1, 2, 3].map((month) => groundTintFor('lawn', month))
    const growing = [4, 5, 6, 7, 8, 9, 10].map((month) => groundTintFor('lawn', month))
    expect(new Set(dormant).size).toBe(1)
    expect(new Set(growing).size).toBe(1)
    expect(dormant[0]).not.toBe(growing[0])
    expect(groundTintFor('terrace', 1)).toBe(groundTintFor('terrace', 7))
  })
})
