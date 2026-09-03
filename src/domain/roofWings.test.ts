import { describe, expect, it } from 'vitest'
import { applyCommand } from './commands'
import { polygonBounds } from './geometry'
import { measureHeight } from './heightMeasurements'
import { buildingPlacement, roofRidgeElevation, roofWings } from './roofWings'
import { modernBarnProject, sampleProject } from './sampleProject'

const tan = (degrees: number) => Math.tan(degrees * Math.PI / 180)
const extendUpperStorey = () => applyCommand(modernBarnProject, {
  type: 'storey.update', action: 'extend-footprint', buildingRef: 'house/main', storeyRef: 'house/main/storey-upper',
  extensionFootprint: [{ x: -8, z: -5 }, { x: 8, z: -5 }, { x: 8, z: 1 }, { x: -2, z: 1 }, { x: -8, z: 1 }],
})

describe('roof wings', () => {
  it('gives a rectangular gable one wing with the ridge along z and eaves at the overhang tip', () => {
    const building = sampleProject.buildings[0]
    const wings = roofWings(building)
    expect(wings).toHaveLength(1)
    expect(wings[0].ridgeAxis).toBe('z')
    expect(wings[0].baseElevationM).toBeCloseTo(3.45, 6)
    expect(wings[0].ridgeElevationM).toBeCloseTo(3.45 + tan(28) * (12 / 2 + 0.45), 6)
    expect(polygonBounds(wings[0].footprint)).toEqual({ minX: -6, maxX: 6, minZ: -4.5, maxZ: 4.5 })
  })

  it('splits the L-shaped barn into a full-width rear wing and a projecting wing rising from the storeys that cover them', () => {
    const building = modernBarnProject.buildings[0]
    const wings = roofWings(building)
    expect(wings).toHaveLength(2)
    const rear = wings.find((wing) => wing.ridgeAxis === 'x')!
    const projecting = wings.find((wing) => wing.ridgeAxis === 'z')!
    expect(polygonBounds(rear.footprint)).toEqual({ minX: -8, maxX: 8, minZ: -5, maxZ: 1 })
    expect(polygonBounds(projecting.footprint)).toEqual({ minX: -8, maxX: -2, minZ: 1, maxZ: 10 })
    expect(rear.baseElevationM).toBeCloseTo(3.45, 6)
    expect(projecting.baseElevationM).toBeCloseTo(6.55, 6)
    expect(rear.ridgeElevationM).toBeCloseTo(6.87, 6)
    expect(projecting.ridgeElevationM).toBeCloseTo(9.97, 6)
    expect(roofRidgeElevation(building)).toBeCloseTo(9.97, 6)
  })

  it('lifts the rear wing once the upper storey is extended over it', () => {
    const building = extendUpperStorey().buildings[0]
    const wings = roofWings(building)
    expect(wings).toHaveLength(2)
    expect(wings.every((wing) => Math.abs(wing.baseElevationM - 6.55) < 1e-6)).toBe(true)
    expect(roofRidgeElevation(building)).toBeCloseTo(9.97, 6)
  })

  it('treats flat and hip roofs as a single wing', () => {
    const flat = applyCommand(sampleProject, { type: 'roof.update', buildingRef: 'house/main', roofType: 'flat' }).buildings[0]
    expect(roofWings(flat)).toHaveLength(1)
    expect(roofRidgeElevation(flat)).toBeCloseTo(3.45 + 0.24, 6)
    const hip = applyCommand(sampleProject, { type: 'roof.update', buildingRef: 'house/main', roofType: 'hip', pitchDegrees: 30 }).buildings[0]
    expect(roofWings(hip)).toHaveLength(1)
    expect(roofRidgeElevation(hip)).toBeCloseTo(3.45 + tan(30) * (12 / 2 + 0.45), 6)
  })

  it('drives building height and ground-to-ridge measurement from the tallest wing', () => {
    expect(buildingPlacement(modernBarnProject.buildings[0]).heightM).toBeCloseTo(9.82, 6)
    const ridge = measureHeight(modernBarnProject, { mode: 'semantic', objectRef: 'house/main', measurement: 'ground-to-ridge' })
    expect(ridge.topPoint.y).toBeCloseTo(9.82, 3)
    expect(ridge.topPoint.reference).toBe('roof/main/ridge')
  })
})
