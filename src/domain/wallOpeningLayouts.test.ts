import { describe, expect, it } from 'vitest'
import { applyCommands, validateProject } from './commands'
import { modernBarnProject } from './sampleProject'
import { inferWallOpeningLayout, wallOpeningLayoutCommands, type WallOpeningLayoutPreset } from './wallOpeningLayouts'

const wallAfter = (preset: WallOpeningLayoutPreset) => {
  const result = applyCommands(modernBarnProject, wallOpeningLayoutCommands(modernBarnProject, 'house/main', 'wall/courtyard-living', preset))
  expect(validateProject(result).filter((issue) => issue.severity === 'error')).toEqual([])
  return result.buildings[0].walls.find((wall) => wall.ref === 'wall/courtyard-living')!
}

describe('wall façade layouts', () => {
  it('replaces full glazing with two regular windows', () => {
    const wall = wallAfter('two-windows')
    expect(wall.openings).toHaveLength(2)
    expect(wall.openings.every((opening) => opening.kind === 'window' && opening.sillM > 0)).toBe(true)
    expect(inferWallOpeningLayout(wall)).toBe('two-windows')
  })

  it.each([
    ['full-glass', 1, 'window'],
    ['center-window', 1, 'window'],
    ['balcony-door', 1, 'door'],
    ['solid-wall', 0, undefined],
  ] as const)('builds the %s preset without invalid openings', (preset, count, kind) => {
    const wall = wallAfter(preset)
    expect(wall.openings).toHaveLength(count)
    if (kind) expect(wall.openings[0].kind).toBe(kind)
    expect(inferWallOpeningLayout(wall)).toBe(preset)
  })
})
