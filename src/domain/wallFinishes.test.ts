import { describe, expect, it } from 'vitest'
import { applyCommands } from './commands'
import { modernBarnProject } from './sampleProject'
import { exteriorWallsForBuilding, wallFinishCommands } from './wallFinishes'

describe('wall finishes', () => {
  it('changes one wall material and normalized opaque color', () => {
    const commands = wallFinishCommands(modernBarnProject, { buildingRef: 'house/main', scope: 'wall', wallRef: 'wall/courtyard-right', material: 'natural-timber', colorHex: '#8a6544' })
    const result = applyCommands(modernBarnProject, commands)
    expect(result.buildings[0].walls.find((wall) => wall.ref === 'wall/courtyard-right')?.finish).toEqual({ material: 'natural-timber', colorHex: '#8A6544' })
    expect(result.buildings[0].walls.find((wall) => wall.ref === 'wall/rear-partition')?.finish?.material).toBe('charred-timber')
  })

  it('changes every exterior wall without changing internal partitions', () => {
    const commands = wallFinishCommands(modernBarnProject, { buildingRef: 'house/main', scope: 'all-exterior', material: 'light-render', colorHex: '#F1EFE8' })
    const result = applyCommands(modernBarnProject, commands); const building = result.buildings[0]
    expect(exteriorWallsForBuilding(building).every((wall) => wall.finish?.material === 'light-render' && wall.finish.colorHex === '#F1EFE8')).toBe(true)
    expect(building.walls.find((wall) => wall.ref === 'wall/rear-partition')?.finish?.material).toBe('charred-timber')
  })
})
