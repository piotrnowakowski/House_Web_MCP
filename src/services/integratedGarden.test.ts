import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { expect, it } from 'vitest'
import { DoubleSide, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three'
import currentData from '../../project-data/zielonki-rear-bath-room/before-compact-garden-r81.json'
import previousData from '../../project-data/zielonki-rear-bath-room/before-integrated-garden-r80.json'
import { validateProject } from '../domain/commands'
import { parseProject } from '../domain/schema'
import { pointInPolygon } from '../domain/geometry'
import { landUseAreas } from '../domain/zoning'
import { gardenFixtureById } from '../domain/gardenFixtures'
import { excavatedGroundGeometry, fireLoungeExcavation, gardenExcavations } from '../scene/gardenGround'
import { loadWorkspace, saveWorkspace, synchronizePublishedProject } from './persistence'

const current = parseProject(currentData), previous = parseProject(previousData)
const fixture = (suffix: string) => current.landscape.fixtures.find(f => f.ref.endsWith(suffix))!
const lounge = fixture('/sunken-court'), greenhouse = fixture('/greenhouse')

it('integrates the existing garden by stable refs without changing the house, terrain data or other projects', () => {
  expect(current.revision).toBe(81)
  expect(validateProject(current).filter(i => i.severity === 'error')).toEqual([])
  expect(current.buildings).toEqual(previous.buildings)
  expect(current.site).toEqual(previous.site)
  expect(current.landscape.plants).toEqual(previous.landscape.plants)
  expect(previous.landscape.fixtures.every(old => current.landscape.fixtures.some(f => f.ref === old.ref))).toBe(true)
  const beds = current.landscape.fixtures.filter(f => f.catalogId === 'larch-bed-long')
  expect(beds).toHaveLength(8)
  for (const bed of beds) {
    const crop = fixture(bed.ref.split('/').at(-1)!.replace('bed-', 'crop-'))
    expect(crop.position).toEqual(bed.position)
    expect(crop.rotationDegrees).toBe(bed.rotationDegrees)
  }
  // From the greenhouse doorway to the first bed is a shared 1.7 m gravel landing.
  expect(beds[0].position.z - 1.8 - (greenhouse.position.z + 1.5)).toBeCloseTo(1.7)
  const construction = landUseAreas(current).filter(a => a.landRole === 'construction')
  const definition = gardenFixtureById(greenhouse.catalogId)
  for (const x of [-1, 1]) for (const z of [-1, 1]) {
    const corner = { x: greenhouse.position.x + x * definition.widthM / 2, z: greenhouse.position.z + z * definition.depthM / 2 }
    expect(construction.some(a => pointInPolygon(corner, a.boundary))).toBe(true)
  }
})

it('places the court on the right half, away from the house and stored wood away from the boundary', () => {
  const house = current.buildings.find(b => b.ref === 'house/main')!
  const a = -house.rotationDegrees * Math.PI / 180
  const corners = house.slabs[0].footprint.map(p => ({ x: house.position.x + p.x * Math.cos(a) - p.z * Math.sin(a), z: house.position.z + p.x * Math.sin(a) + p.z * Math.cos(a) }))
  expect(Math.min(...corners.map(p => Math.hypot(p.x - lounge.position.x, p.z - lounge.position.z)))).toBeGreaterThan(35)
  expect(lounge.position.x).toBeGreaterThan(9)
  expect(lounge.position.z).toBeGreaterThan(30)
  // Screen outer edge, including its cap, compared to the sloping right cadastral boundary.
  const east = lounge.position.x + 4.05 + 0.465, south = lounge.position.z + 2.9
  const rightBoundary = 19.477 - (south - 15.882) * (19.477 - 18.554407) / (69.05 - 15.882)
  expect(rightBoundary - east).toBeGreaterThan(4)
  expect(4.05 - 0.31 - 0.58).toBeGreaterThan(3) // wood to bowl rim
})

it('cuts the actual terrain and parcel skins, including a rotated excavation crossing a parcel edge', () => {
  const hole = gardenExcavations(current)
  const geometry = excavatedGroundGeometry(current.site.boundary, hole)
  const material = new MeshBasicMaterial({ side: DoubleSide }), mesh = new Mesh(geometry, material)
  const ray = new Raycaster(new Vector3(lounge.position.x, 10, lounge.position.z), new Vector3(0, -1, 0))
  expect(ray.intersectObject(mesh)).toHaveLength(0)
  ray.set(new Vector3(lounge.position.x + 3.4, 10, lounge.position.z), new Vector3(0, -1, 0))
  expect(ray.intersectObject(mesh).length).toBeGreaterThan(0)
  geometry.dispose()
  const rotated = { ...lounge, position: { x: 0, z: 0 }, rotationDegrees: 35 }
  const partial = excavatedGroundGeometry([{ x: -6, z: -6 }, { x: 0, z: -6 }, { x: 0, z: 6 }, { x: -6, z: 6 }], [fireLoungeExcavation(rotated)])
  mesh.geometry = partial
  ray.set(new Vector3(-0.5, 10, 0), new Vector3(0, -1, 0))
  expect(ray.intersectObject(mesh)).toHaveLength(0)
  ray.set(new Vector3(-5, 10, 0), new Vector3(0, -1, 0))
  expect(ray.intersectObject(mesh).length).toBeGreaterThan(0)
  partial.dispose(); material.dispose()
})

it('migrates r80 by refs, retaining a renamed room and a deleted bed, and keeps the new court deleted after reload', async () => {
  globalThis.indexedDB = new IDBFactory()
  await synchronizePublishedProject(previous, previous)
  const saved = (await loadWorkspace(previous.ref))!
  saved.project.buildings[0].spaces[0].name = 'Moja nazwa pokoju'
  saved.project.landscape.fixtures = saved.project.landscape.fixtures.filter(f => !['fixture/kitchen-garden/bed-nw1', 'fixture/kitchen-garden/crop-nw1'].includes(f.ref))
  await saveWorkspace(saved)
  // A deleted object that incoming moves is an explicit edit/delete conflict; retain both versions.
  expect((await synchronizePublishedProject(current, previous)).length).toBeGreaterThan(0)
  const retained = (await loadWorkspace(previous.ref))!
  expect(retained.project.landscape.fixtures.some(f => f.ref === 'fixture/kitchen-garden/bed-nw1')).toBe(false)
  expect(retained.project.buildings[0].spaces[0].name).toBe('Moja nazwa pokoju')
  globalThis.indexedDB = new IDBFactory()
  await synchronizePublishedProject(previous, previous)
  const independent = (await loadWorkspace(previous.ref))!
  independent.project.buildings[0].spaces[0].name = 'Moja nazwa pokoju'
  await saveWorkspace(independent)
  expect(await synchronizePublishedProject(current, previous)).toEqual([])
  const merged = (await loadWorkspace(current.ref))!
  expect(merged.project.buildings[0].spaces[0].name).toBe('Moja nazwa pokoju')
  merged.project.landscape.fixtures = merged.project.landscape.fixtures.filter(f => f.ref !== lounge.ref)
  await saveWorkspace(merged)
  expect(await synchronizePublishedProject(current, previous)).toEqual([])
  expect((await loadWorkspace(current.ref))!.project.landscape.fixtures.some(f => f.ref === lounge.ref)).toBe(false)
})
