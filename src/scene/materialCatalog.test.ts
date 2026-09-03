import { existsSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { textureAssets, textureFilesFor, texturePreviewFor, textureLibrary, tintForTexturedFinish } from './materialCatalog'

describe('material catalogue', () => {
  it('ships every library scan with its three maps and a preview inside the size budget', () => {
    let total = 0
    for (const item of textureLibrary) {
      for (const file of [...Object.values(textureFilesFor(item.id)), texturePreviewFor(item.id)]) {
        const path = resolve(process.cwd(), 'public', file)
        expect(existsSync(path), path).toBe(true)
        total += statSync(path).size
        if (file.endsWith('preview.jpg')) expect(statSync(path).size).toBeLessThan(60 * 1024)
      }
    }
    expect(total).toBeLessThan(24 * 1024 * 1024)
  })

  it('names files by the declared diffuse resolution and exposes every library entry as an asset', () => {
    expect(textureFilesFor('dirt').map).toBe('textures/dirt_floor/diff_1k.jpg')
    expect(textureFilesFor('medieval-brick')).toEqual({ map: 'textures/medieval_red_brick/diff_2k.jpg', normalMap: 'textures/medieval_red_brick/nor_1k.jpg', roughnessMap: 'textures/medieval_red_brick/rough_1k.jpg' })
    expect(texturePreviewFor('leafy-grass')).toBe('textures/leafy_grass/preview.jpg')
    expect(Object.keys(textureAssets)).toHaveLength(textureLibrary.length)
    expect(textureAssets['coated-pine'].tileM).toBe(0.7)
  })

  it('tints textured finishes 65 percent toward white so the scan keeps most of its colour', () => {
    expect(tintForTexturedFinish('#8B4E3C')).toBe('#D6C1BB')
    expect(tintForTexturedFinish('#ffffff')).toBe('#FFFFFF')
  })
})
