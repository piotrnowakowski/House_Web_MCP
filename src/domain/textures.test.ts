import { describe, expect, it } from 'vitest'
import { modernBarnProject, sampleProject } from './sampleProject'
import { defaultGroundTexture, defaultWallTexture, isTextureId, resolveWallTexture, resolveZoneTexture, textureById, textureIdsInUse, textureLibrary, texturesFor, validateTextureChoice, zoneTintFor } from './textures'
import type { GardenZoneKind, LandscapeZone, WallMaterial } from './types'

const wallMaterials: WallMaterial[] = ['charred-timber', 'natural-timber', 'light-render', 'brick', 'metal-panel']
const zoneKinds: GardenZoneKind[] = ['lawn', 'terrace', 'path', 'driveway', 'bed', 'rain-garden', 'vegetable']
const zone = (kind: GardenZoneKind, textureId?: string): LandscapeZone => ({ ref: `zone/${kind}`, name: kind, kind, footprint: [{ x: 0, z: 0 }, { x: 2, z: 0 }, { x: 2, z: 2 }], locked: false, ...(textureId ? { textureId } : {}) })

describe('texture library', () => {
  it('lists twelve Poly Haven scans with unique ids, folders, tile widths and at least one surface each', () => {
    expect(textureLibrary).toHaveLength(12)
    expect(new Set(textureLibrary.map((item) => item.id)).size).toBe(12)
    expect(new Set(textureLibrary.map((item) => item.folder)).size).toBe(12)
    for (const item of textureLibrary) {
      expect(item.tileM).toBeGreaterThan(0)
      expect(item.surfaces.length).toBeGreaterThan(0)
      expect(item.author.length).toBeGreaterThan(0)
      expect(item.name.length).toBeGreaterThan(0)
    }
    expect(textureById('medieval-brick').folder).toBe('medieval_red_brick')
    expect(textureById('river-pebbles').diffuse).toBe('1k')
    expect(textureById('square-tiles').diffuse).toBe('2k')
  })

  it('separates wall scans from ground scans', () => {
    expect(texturesFor('wall').map((item) => item.id)).toEqual(expect.arrayContaining(['medieval-brick', 'brick-floor', 'hinoki', 'rusty-painted-metal']))
    expect(texturesFor('wall').map((item) => item.id)).not.toContain('leafy-grass')
    expect(texturesFor('ground').map((item) => item.id)).toEqual(expect.arrayContaining(['leafy-grass', 'concrete-tiles', 'dirt', 'forest-floor', 'river-pebbles']))
    expect(texturesFor('ground').map((item) => item.id)).not.toContain('rusty-painted-metal')
    expect(isTextureId('dirt')).toBe(true)
    expect(isTextureId('marble')).toBe(false)
  })

  it('gives every wall material and zone kind a sensible default', () => {
    for (const material of wallMaterials) { const id = defaultWallTexture(material); if (id) expect(texturesFor('wall').some((item) => item.id === id)).toBe(true) }
    for (const kind of zoneKinds) { const id = defaultGroundTexture(kind); expect(id).toBeDefined(); expect(texturesFor('ground').some((item) => item.id === id)).toBe(true) }
    expect(defaultWallTexture('brick')).toBe('medieval-brick')
    expect(defaultWallTexture('natural-timber')).toBe('hinoki')
    expect(defaultWallTexture('metal-panel')).toBe('rusty-painted-metal')
    expect(defaultWallTexture('charred-timber')).toBeUndefined()
    expect(defaultWallTexture('light-render')).toBeUndefined()
    expect(defaultGroundTexture('lawn')).toBe('leafy-grass')
    expect(defaultGroundTexture('vegetable')).toBe('dirt')
    expect(defaultGroundTexture('rain-garden')).toBe('river-pebbles')
  })

  it('resolves a wall finish to its chosen scan, its material default, or nothing when set to none', () => {
    expect(resolveWallTexture({ material: 'brick', colorHex: '#8B4E3C' })).toEqual({ id: 'medieval-brick', rotation: 0 })
    expect(resolveWallTexture({ material: 'brick', colorHex: '#8B4E3C', textureId: 'brick-floor' })).toEqual({ id: 'brick-floor', rotation: 0 })
    expect(resolveWallTexture({ material: 'light-render', colorHex: '#DED9CC', textureId: 'hinoki' })).toEqual({ id: 'hinoki', rotation: Math.PI / 2 })
    expect(resolveWallTexture({ material: 'brick', colorHex: '#8B4E3C', textureId: 'none' })).toBeUndefined()
    expect(resolveWallTexture({ material: 'brick', colorHex: '#8B4E3C', textureId: 'leafy-grass' })).toEqual({ id: 'medieval-brick', rotation: 0 })
  })

  it('resolves a zone to its chosen scan, its kind default, or nothing when set to none', () => {
    expect(resolveZoneTexture(zone('terrace'))).toEqual({ id: 'concrete-tiles', rotation: 0 })
    expect(resolveZoneTexture(zone('terrace', 'brick-pavement'))).toEqual({ id: 'brick-pavement', rotation: 0 })
    expect(resolveZoneTexture(zone('terrace', 'none'))).toBeUndefined()
    expect(resolveZoneTexture(zone('terrace', 'hinoki'))).toEqual({ id: 'concrete-tiles', rotation: 0 })
  })

  it('keeps the seasonal lawn tint only while the lawn wears grass', () => {
    expect(zoneTintFor(zone('lawn'), 1)).not.toBe(zoneTintFor(zone('lawn'), 7))
    expect(zoneTintFor(zone('lawn', 'river-pebbles'), 1)).toBe(zoneTintFor(zone('lawn', 'river-pebbles'), 7))
    expect(zoneTintFor(zone('terrace'), 1)).toBe(zoneTintFor(zone('terrace'), 7))
  })

  it('rejects scans that do not fit the surface and accepts none', () => {
    expect(() => validateTextureChoice('wall', 'leafy-grass')).toThrow(/wall/)
    expect(() => validateTextureChoice('ground', 'rusty-painted-metal')).toThrow(/ground/)
    expect(() => validateTextureChoice('wall', 'marble')).toThrow(/list_textures/)
    expect(() => validateTextureChoice('wall', 'none')).not.toThrow()
    expect(() => validateTextureChoice('ground', 'dirt')).not.toThrow()
  })

  it('reports which scans a project draws so they can load before the rest of the library', () => {
    const inUse = textureIdsInUse(sampleProject)
    expect(inUse).toContain('leafy-grass')
    expect(inUse).toContain('concrete-tiles')
    expect(inUse).not.toContain('medieval-brick')
    expect(new Set(inUse).size).toBe(inUse.length)
    const barn = structuredClone(modernBarnProject)
    barn.buildings[0].walls[0].finish = { material: 'brick', colorHex: '#8B4E3C' }
    expect(textureIdsInUse(barn)).toContain('medieval-brick')
    expect(textureIdsInUse(barn)).toContain('coated-pine')
  })
})
