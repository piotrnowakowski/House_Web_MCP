import { expect, it } from 'vitest'
import { InteriorItemSchema } from '../domain/interior'
import { islandSeating } from './islandSeating'

const island = { ref: 'island', catalogId: 'kitchen-island', storeyRef: 'ground', name: 'Island', position: { x: 0, z: 0 }, widthM: 2.8, depthM: 1.1, heightM: .92, rotationDegrees: 90, color: '#202427', cabinetry: 'island', seatingOverhangM: .38 }

it('retains the full-length overhang of existing islands without a specified recess', () => {
  expect(islandSeating(island)).toEqual({ width: 2.8, centre: 0, start: -1.4, end: 1.4, cabinets: [] })
})

it('fills the rest of an offset two-seat recess with full-depth cabinets', () => {
  const result = islandSeating({ ...island, seatingWidthM: 1.2, seatingOffsetM: .8 })
  expect(result.start).toBeCloseTo(.2)
  expect(result.end).toBeCloseTo(1.4)
  expect(result.cabinets).toHaveLength(1)
  expect(result.cabinets[0].width).toBeCloseTo(1.6)
  expect(result.cabinets[0].centre).toBeCloseTo(-.6)
  expect(result.width + result.cabinets.reduce((sum, c) => sum + c.width, 0)).toBeCloseTo(island.widthM)
})

it('supports a centred recess and rejects recesses extending beyond the countertop', () => {
  expect(islandSeating({ ...island, seatingWidthM: 1.2 }).cabinets).toHaveLength(2)
  expect(InteriorItemSchema.safeParse({ ...island, seatingWidthM: 1.2, seatingOffsetM: .8 }).success).toBe(true)
  for (const change of [{ seatingOffsetM: .81 }, { seatingWidthM: 3 }, { seatingOverhangM: 0 }, { cabinetry: 'base' }, { depthM: .8 }]) {
    expect(InteriorItemSchema.safeParse({ ...island, seatingWidthM: 1.2, seatingOffsetM: .8, ...change }).success).toBe(false)
  }
  expect(InteriorItemSchema.safeParse({ ...island, seatingOffsetM: .5 }).success).toBe(false)
})
