import { describe, expect, it } from 'vitest'
import { GROUND_SURFACE_SKIN_M, TERRAIN_SURFACE_Y, groundContactY, groundedBoxCenterY, groundSurfaceY } from './groundContact'

describe('ground contact boundary', () => {
  it('keeps the bottom of a grounded solid on the rendered terrain', () => {
    const heightM = 0.08
    expect(groundedBoxCenterY(heightM) - heightM / 2).toBe(TERRAIN_SURFACE_Y)
  })

  it('supports objects hosted by another grounded object without introducing a gap', () => {
    expect(groundContactY(0.41)).toBeCloseTo(TERRAIN_SURFACE_Y + 0.41)
  })

  it('limits coplanar finish separation to a render-only skin', () => {
    expect(groundSurfaceY() - TERRAIN_SURFACE_Y).toBe(GROUND_SURFACE_SKIN_M)
    expect(GROUND_SURFACE_SKIN_M).toBeLessThan(0.01)
  })

  it('rejects impossible support dimensions', () => {
    expect(() => groundContactY(-0.01)).toThrow(/support height/i)
    expect(() => groundedBoxCenterY(0)).toThrow(/object height/i)
  })
})
