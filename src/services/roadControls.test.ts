import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { expect, it } from 'vitest'
import original from '../../project-data/zielonki/project.json'
import front from '../../project-data/zielonki-v2/project.json'
import rear from '../../project-data/zielonki-rear-carport/project.json'
import originalBase from '../../project-data/zielonki/before-road-controls-r51.json'
import frontBase from '../../project-data/zielonki-v2/before-road-controls-r69.json'
import rearBase from '../../project-data/zielonki-rear-carport/before-road-controls-r90.json'
import { parseProject } from '../domain/schema'
import { validateProject } from '../domain/commands'
import { buildingFootprintsWorld, pointInPolygon } from '../domain/geometry'
import { loadWorkspace, saveWorkspace, synchronizePublishedProject } from './persistence'
import { useStudioStore } from '../state/store'

for (const [data, base] of [[original, originalBase], [front, frontBase], [rear, rearBase]]) {
  it(`${data.ref}: keeps every building unchanged and places bins inside the road boundary`, () => {
    const project = parseProject(data), before = parseProject(base)
    expect(project.buildings).toEqual(before.buildings)
    expect(project.site.boundary).toEqual(before.site.boundary)
    expect(project.landscape.plants).toEqual(before.landscape.plants)
    expect(validateProject(project).filter(i => i.severity === 'error')).toEqual([])
    const bins = project.landscape.fixtures.find(f => f.catalogId === 'recycling-bins')!
    // Match the rendered fixture transform, including all corners of the concrete pad.
    const angle = bins.rotationDegrees * Math.PI / 180
    const corners = [[-1.8, -0.55], [1.8, -0.55], [1.8, 0.55], [-1.8, 0.55]].map(([x, z]) => ({ x: bins.position.x + x * Math.cos(angle) - z * Math.sin(angle), z: bins.position.z + x * Math.sin(angle) + z * Math.cos(angle) }))
    for (const p of corners) {
      expect(pointInPolygon(p, project.site.boundary)).toBe(true)
      expect(project.buildings.flatMap(buildingFootprintsWorld).some(f => pointInPolygon(p, f))).toBe(false)
      expect(pointInPolygon(p, project.landscape.zones.find(z => z.ref === 'zone/driveway')!.footprint)).toBe(false)
    }
    const f = project.landscape.zones.find(z => z.ref === 'zone/driveway')!.footprint
    const road = { x: 1.375, z: 25.63 }
    const along = { x: f[3].x - f[0].x, z: f[3].z - f[0].z }
    const across = { x: f[1].x - f[0].x, z: f[1].z - f[0].z }
    expect(Math.abs(along.x * road.z - along.z * road.x)).toBeLessThan(0.01)
    expect(Math.abs(across.x * road.x + across.z * road.z)).toBeLessThan(0.01)
  })

  it(`${data.ref}: migrates the new layout while retaining local edits and deleted bins after reload`, async () => {
    globalThis.indexedDB = new IDBFactory()
    const published = parseProject(data), baseline = parseProject(base)
    await synchronizePublishedProject(baseline, baseline)
    const saved = (await loadWorkspace(baseline.ref))!
    const removedTree = saved.project.landscape.plants.pop()!.ref
    const removedFurniture = saved.project.buildings[0].furniture!.pop()!.ref
    saved.project.name = 'My house'
    await saveWorkspace(saved)
    expect(await synchronizePublishedProject(published, baseline)).toEqual([])
    const migrated = (await loadWorkspace(baseline.ref))!
    expect(migrated.project.name).toBe('My house')
    expect(migrated.project.landscape.plants.some(p => p.ref === removedTree)).toBe(false)
    expect(migrated.project.buildings[0].furniture!.some(p => p.ref === removedFurniture)).toBe(false)
    expect(migrated.project.landscape.fixtures.some(f => f.catalogId === 'recycling-bins')).toBe(true)
    migrated.project.landscape.fixtures = migrated.project.landscape.fixtures.filter(f => f.catalogId !== 'recycling-bins')
    await saveWorkspace(migrated)
    await synchronizePublishedProject(published, baseline)
    expect((await loadWorkspace(baseline.ref))!.project).toEqual(migrated.project)
  })
}

it('tree visibility is a view preference and does not modify the project or undo history', () => {
  const { project, history } = useStudioStore.getState()
  useStudioStore.getState().setTreesVisible(false)
  expect(useStudioStore.getState().treesVisible).toBe(false)
  expect(useStudioStore.getState().project).toBe(project)
  expect(useStudioStore.getState().history).toBe(history)
  useStudioStore.getState().setTreesVisible(true)
})
