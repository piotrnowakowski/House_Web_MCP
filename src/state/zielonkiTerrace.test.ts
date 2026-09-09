import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { expect, it } from 'vitest'
import { validateProject } from '../domain/commands'
import { diffProjects } from '../domain/diff'
import { gableGlazingProfile } from '../domain/gableGlazing'
import { pointInPolygon, polygonBounds } from '../domain/geometry'
import { createReferenceHouse } from '../domain/referenceHouse'
import { modernBarnProject } from '../domain/sampleProject'
import { parseProject } from '../domain/schema'
import { fitZielonkiInterior, upgradeZielonkiTerrace } from '../domain/zielonkiInterior'
import { upgradeZielonkiPlacement } from '../domain/zielonkiPlacement'
import { saveWorkspace } from '../services/persistence'
import { useStudioStore } from './store'

it('adds front glazing and bedroom exits aligned with the guarded garage terrace', () => {
  const source = createReferenceHouse()
  const project = fitZielonkiInterior(modernBarnProject, source)
  const b = project.buildings[0]
  const front = b.roof.segments.find((s) => s.ref.endsWith('/front-barn'))!
  const garage = b.roof.segments.find((s) => s.ref.endsWith('/garage-cap'))!
  const profile = gableGlazingProfile(front, 'max')!
  expect(profile.opening.every((p) => pointInPolygon(p, profile.outline))).toBe(true)
  expect(polygonBounds(front.footprint).maxZ).toBeCloseTo(polygonBounds(garage.footprint).minZ)
  expect(garage.terrace).toEqual({ railingHeightM: 1.1, openEdgeIndex: 0, frameColorHex: '#121817' })
  const doors = b.walls.flatMap((wall) => wall.openings.filter((o) => o.glazed).map((opening) => ({ wall, opening })))
  expect(doors).toHaveLength(2)
  for (const { wall, opening } of doors) {
    expect(opening.kind).toBe('door')
    expect(wall.start.z).toBeCloseTo(polygonBounds(garage.footprint).minZ)
    expect(wall.baseElevationM + opening.sillM).toBeCloseTo(garage.baseElevationM + 0.24)
    expect(opening.sillM + opening.heightM).toBeLessThan(wall.heightM)
  }
  expect(source.buildings[0].walls.flatMap((w) => w.openings).some((o) => o.glazed)).toBe(false)
  expect(validateProject(project).filter((i) => i.severity === 'error')).toEqual([])
  expect(parseProject(project)).toEqual(project)
  expect(upgradeZielonkiTerrace(project)).toBe(project)
})

it('upgrades a saved study once and preserves custom terrace and glazing edits after reopening', async () => {
  globalThis.indexedDB = new IDBFactory()
  const old = upgradeZielonkiPlacement(fitZielonkiInterior(modernBarnProject, createReferenceHouse()))
  old.ref = 'project/terrace-migration'
  const house = old.buildings[0]
  house.interiorSource!.notes = house.interiorSource!.notes.filter((n) => !n.startsWith('Driveway terrace'))
  const front = house.roof.segments.find((s) => s.ref.endsWith('/front-barn'))!
  delete front.gableGlazing!.max
  delete house.roof.segments.find((s) => s.ref.endsWith('/garage-cap'))!.terrace
  house.walls.flatMap((w) => w.openings).filter((o) => o.glazed).forEach((o) => {
    delete o.glazed; o.kind = 'window'; o.sillM = 0.8; o.heightM = 1.5
  })
  await saveWorkspace({ version: 1, project: old, proposals: [], draftChangeSets: [] })
  await useStudioStore.getState().openWorkspace(old.ref)
  const restored = useStudioStore.getState().project
  expect(restored.revision).toBe(old.revision + 1)
  expect(restored.site).toEqual(old.site)
  expect(restored.buildings[0].slabs).toEqual(house.slabs)
  const diff = diffProjects(old, restored)
  expect(diff.changes.some((c) => c.fields?.includes('terrace'))).toBe(true)
  expect(diff.changes.filter((c) => c.fields?.includes('glazed'))).toHaveLength(2)
  restored.buildings[0].roof.segments.find((s) => s.ref.endsWith('/garage-cap'))!.terrace!.railingHeightM = 1.2
  restored.buildings[0].roof.segments.find((s) => s.ref.endsWith('/front-barn'))!.gableGlazing!.max!.roofInsetM = 0.35
  await saveWorkspace({ version: 1, project: restored, proposals: [], draftChangeSets: [] })
  await useStudioStore.getState().openWorkspace(old.ref)
  expect(useStudioStore.getState().project).toEqual(restored)
})
