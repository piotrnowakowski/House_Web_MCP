import { describe, expect, it } from 'vitest'
import { plantVisualSeed, sharedVegetationGeometry, vegetationGeometry } from './vegetationGeometry'

describe('garden vegetation', () => {
  it('keeps foliage within the saved metre envelope with bounded mobile geometry', () => {
    for (const detailed of [false, true]) for (let seed = 0; seed < 4; seed++) {
      const geometry = vegetationGeometry(seed, detailed), bounds = geometry.boundingBox!
      expect(bounds.min.y).toBeGreaterThanOrEqual(0)
      expect(bounds.max.y).toBeLessThanOrEqual(1.001)
      expect(Math.max(Math.abs(bounds.min.x), Math.abs(bounds.max.x), Math.abs(bounds.min.z), Math.abs(bounds.max.z))).toBeLessThanOrEqual(.501)
      expect(geometry.getAttribute('position').count / 3).toBeLessThan(detailed ? 2400 : 1300)
      expect(geometry.getAttribute('color').count).toBe(geometry.getAttribute('position').count)
      expect([...geometry.getAttribute('normal').array].every(Number.isFinite)).toBe(true)
      geometry.dispose()
    }
  })
  it('shares tufts while keeping each plant deterministic through reload', () => {
    const seed = plantVisualSeed('plant/thuja-9')
    expect(seed).toBe(plantVisualSeed('plant/thuja-9'))
    expect(sharedVegetationGeometry(seed, true)).toBe(sharedVegetationGeometry(seed + 4, true))
    expect(sharedVegetationGeometry(seed, true)).not.toBe(sharedVegetationGeometry(seed, false))
  })
})
