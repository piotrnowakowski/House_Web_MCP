import { describe, expect, it } from 'vitest'
import { applyCommand } from './commands'
import { interiorCatalog, itemFitsFloor } from './interior'
import { parseProject } from './schema'
import { modernBarnProject } from './sampleProject'
import { polygonBounds, spaceFootprint } from './geometry'
import { useStudioStore } from '../state/store'
import type { InteriorItem, ProjectCommand } from './types'

const house = modernBarnProject.buildings.find((b) => b.kind === 'house')!
const floor = house.storeys[0]
const item: InteriorItem = { ref: 'interior/test-sofa', catalogId: 'sofa', storeyRef: floor.ref, name: 'My sofa', position: { x: -4, z: -2 }, widthM: 2.4, depthM: 0.95, heightM: 0.85, rotationDegrees: 0, color: '#64827e' }
const put = (value = item): ProjectCommand => ({ type: 'interior.update', buildingRef: house.ref, storeyRef: floor.ref, action: 'put', item: value })

describe('Interior project edits', () => {
  it('persists add, movement, rotation and deletion without losing other building data', () => {
    const added = applyCommand(modernBarnProject, put())
    expect(house.furniture).toBeUndefined()
    const moved = applyCommand(parseProject(JSON.parse(JSON.stringify(added))), put({ ...item, position: { x: -3, z: -2 }, rotationDegrees: 90 }))
    expect(moved.buildings[0].furniture?.[0]).toMatchObject({ position: { x: -3, z: -2 }, rotationDegrees: 90 })
    expect(moved.buildings[0].walls).toEqual(house.walls)
    const removed = applyCommand(moved, { type: 'interior.update', action: 'remove', buildingRef: house.ref, storeyRef: floor.ref, itemRef: item.ref })
    expect(removed.buildings[0].furniture).toEqual([])
  })
  it('rejects invalid dimensions, wrong floors and rotated objects outside the L-shaped slab atomically', () => {
    expect(() => applyCommand(modernBarnProject, put({ ...item, widthM: -1 }))).toThrow()
    expect(() => applyCommand(modernBarnProject, put({ ...item, heightM: 4 }))).toThrow(/taller/)
    expect(() => applyCommand(modernBarnProject, put({ ...item, storeyRef: 'missing' }))).toThrow(/floor/)
    expect(() => applyCommand(modernBarnProject, put({ ...item, position: { x: 7.5, z: -2 }, rotationDegrees: 45 }))).toThrow(/inside/)
    const lShape = [{ x: 0, z: 0 }, { x: 5, z: 0 }, { x: 5, z: 1 }, { x: 1, z: 1 }, { x: 1, z: 5 }, { x: 0, z: 5 }]
    expect(itemFitsFloor({ ...item, position: { x: 2, z: 2 }, widthM: 3, depthM: 0.4, rotationDegrees: 45 }, lShape)).toBe(false)
    expect(house.furniture).toBeUndefined()
  })
  it('renames a real room and resizes shared wall endpoints without creating walls', () => {
    const room = house.spaces.find((s) => floor.spaceRefs.includes(s.ref))!
    const before = polygonBounds(spaceFootprint(house, room))
    const updated = applyCommand(modernBarnProject, { type: 'interior.update', action: 'room', buildingRef: house.ref, storeyRef: floor.ref, spaceRef: room.ref, name: 'Kitchen & breakfast', widthM: before.maxX - before.minX - 0.4, depthM: before.maxZ - before.minZ - 0.4 })
    const next = updated.buildings[0]; const resized = next.spaces.find((s) => s.ref === room.ref)!
    expect(resized.name).toBe('Kitchen & breakfast')
    expect(next.walls.length).toBe(house.walls.length)
    const bounds = polygonBounds(spaceFootprint(next, resized))
    expect(bounds.maxX - bounds.minX).toBeCloseTo(before.maxX - before.minX - 0.4)
    expect(() => applyCommand(modernBarnProject, { type: 'interior.update', action: 'room', buildingRef: house.ref, storeyRef: floor.ref, spaceRef: room.ref, name: 'Too large', widthM: 100 })).toThrow()
  })
  it('uses the project history for undo and keeps furniture isolated by floor', () => {
    useStudioStore.setState({ project: structuredClone(modernBarnProject), history: [], variants: [], proposals: [], draftChangeSets: [] })
    useStudioStore.getState().commitCommand(put())
    expect(useStudioStore.getState().project.buildings[0].furniture).toHaveLength(1)
    expect(useStudioStore.getState().project.revision).toBe(modernBarnProject.revision + 1)
    expect(() => useStudioStore.getState().commitCommand({ type: 'interior.update', action: 'remove', buildingRef: house.ref, storeyRef: house.storeys[1].ref, itemRef: item.ref })).toThrow(/floor/)
    useStudioStore.getState().undo()
    expect(useStudioStore.getState().project.buildings[0].furniture).toBeUndefined()
  })
  it('has correctly sized kitchen, bathroom, bedroom and garage objects', () => {
    expect(new Set(interiorCatalog.map((entry) => entry.id)).size).toBe(interiorCatalog.length)
    expect(interiorCatalog.find((entry) => entry.id === 'car')?.size).toEqual([1.85, 4.5, 1.45])
    expect(new Set(interiorCatalog.map((entry) => entry.category)).size).toBe(5)
  })
})
