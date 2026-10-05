import { describe, expect, it } from 'vitest'
import { OrthographicCamera, PerspectiveCamera, Vector2, Vector3 } from 'three'
import { sampleProject } from '../domain/sampleProject'
import { interiorMeasurementEdges, measurementScreenPoint, siteMeasurementEdges, snapMeasurementPoint, type MeasurementEdge } from './measurementSnapping'

const viewport = { left: 40, top: 70, width: 1000, height: 1000 }
const camera = new OrthographicCamera(-5, 5, 5, -5, 0.1, 100)
camera.position.set(0, 10, 0); camera.lookAt(0, 0, 0); camera.updateMatrixWorld()

describe('measurement snapping', () => {
  it('snaps near an edge and its endpoints, but leaves distant points free', () => {
    const edge: MeasurementEdge = [new Vector3(-2, 0, 0), new Vector3(2, 0, 0)]
    const middle = measurementScreenPoint(new Vector3(), camera, viewport)!
    expect(snapMeasurementPoint(middle.clone().add(new Vector2(0, 12)), [edge], camera, viewport)?.length()).toBeCloseTo(0)
    expect(snapMeasurementPoint(middle.clone().add(new Vector2(0, 18)), [edge], camera, viewport)).toBeNull()
    const end = measurementScreenPoint(edge[1], camera, viewport)!
    expect(snapMeasurementPoint(end.add(new Vector2(5, 0)), [edge], camera, viewport)?.distanceTo(edge[1])).toBeCloseTo(0)
  })

  it('preserves the pixel tolerance after zooming', () => {
    const zoomed = camera.clone(); zoomed.zoom = 3; zoomed.updateProjectionMatrix()
    const pointer = measurementScreenPoint(new Vector3(), zoomed, viewport)!.add(new Vector2(0, 12))
    expect(snapMeasurementPoint(pointer, [[new Vector3(-1, 0, 0), new Vector3(1, 0, 0)]], zoomed, viewport)?.length()).toBeCloseTo(0)
  })

  it('returns the exact world point on a perspective edge', () => {
    const perspective = new PerspectiveCamera(60, 1, 0.1, 100)
    perspective.position.set(3, 7, 9); perspective.lookAt(0, 0, 0); perspective.updateMatrixWorld()
    const edge: MeasurementEdge = [new Vector3(-3, 0, -3), new Vector3(3, 0, 3)]
    const point = edge[0].clone().lerp(edge[1], 0.3)
    const pointer = measurementScreenPoint(point, perspective, viewport)!
    expect(snapMeasurementPoint(pointer, [edge], perspective, viewport)?.distanceTo(point)).toBeLessThan(1e-10)
    expect(snapMeasurementPoint(pointer, [[new Vector3(0, 10, 20), new Vector3(1, 10, 20)]], perspective, viewport)).toBeNull()
  })

  it('includes wall faces, opening jambs, floor holes and only current-floor furniture', () => {
    const building = structuredClone(sampleProject.buildings[0]); const storey = building.storeys[0]
    building.walls = [{ ...building.walls[0], start: { x: -2, z: 0 }, end: { x: 2, z: 0 }, thicknessM: 0.24, openings: [{ ...building.walls[0].openings[0], offsetM: 2, widthM: 1 }] }]
    storey.wallRefs = [building.walls[0].ref]
    building.slabs[0].holes = [[{ x: 10, z: 10 }, { x: 11, z: 10 }, { x: 11, z: 11 }, { x: 10, z: 11 }]]
    const item = { ref: 'test/sofa', name: 'Sofa', catalogId: 'sofa' as const, storeyRef: storey.ref, position: { x: 20, z: 20 }, widthM: 2, depthM: 1, heightM: 1, rotationDegrees: 90, color: '#ffffff' }
    building.furniture = [item, { ...item, ref: 'test/other-floor', storeyRef: 'other-floor', position: { x: 40, z: 40 } }]
    const edges = interiorMeasurementEdges(building, storey)
    expect(edges.some(([a, b]) => a.z === 0.12 && b.z === 0.12 && a.x === -2 && b.x === -0.5)).toBe(true)
    expect(edges.some(([a, b]) => a.x === -0.5 && b.x === -0.5)).toBe(true)
    expect(edges.some(([a, b]) => a.z === 0.12 && b.z === 0.12 && a.x < 0 && b.x > 0)).toBe(false)
    expect(edges.some(([a, b]) => a.x === 10 && b.x === 11 && a.z === 10 && b.z === 10)).toBe(true)
    expect(edges.some(([a]) => a.x === 19.5 && a.z === 21)).toBe(true)
    expect(edges.some(([a]) => a.x > 30)).toBe(false)
  })

  it('uses the actual rotated building footprint and includes site boundaries', () => {
    const project = structuredClone(sampleProject)
    project.buildings[0].rotationDegrees = 90
    project.buildings[0].position = { x: 20, z: 30 }
    const edges = siteMeasurementEdges(project)
    const local = project.buildings[0].slabs[0].footprint[0]
    expect(edges.some(([a]) => Math.abs(a.x - (20 + local.z)) < 1e-8 && Math.abs(a.z - (30 - local.x)) < 1e-8)).toBe(true)
    expect(edges[0][0].x).toBe(project.site.boundary[0].x)
  })
})
