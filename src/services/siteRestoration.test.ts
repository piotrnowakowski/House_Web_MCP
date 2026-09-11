import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, expect, it } from 'vitest'
import original from '../../project-data/zielonki/project.json'
import front from '../../project-data/zielonki-v2/project.json'
import rear from '../../project-data/zielonki-rear-carport/project.json'
import originalBase from '../../project-data/zielonki/before-site-restoration-r49.json'
import frontBase from '../../project-data/zielonki-v2/before-site-restoration-r67.json'
import rearBase from '../../project-data/zielonki-rear-carport/before-site-restoration-r88.json'
import { surveyTreePosition, surveyTreeRef, zielonkiSurveyTrees } from '../../knowledge-bank/zielonki/trees'
import { parseProject } from '../domain/schema'
import { validateProject } from '../domain/commands'
import { loadWorkspace, saveWorkspace, synchronizePublishedProject } from './persistence'

beforeEach(() => { globalThis.indexedDB = new IDBFactory() })

for (const [data, before] of [[original, originalBase], [front, frontBase], [rear, rearBase]]) {
  it(`${data.ref}: restores the emailed map and shares the field building without changing the house`, () => {
    const project = parseProject(data)
    expect(validateProject(project).filter(i => i.severity === 'error')).toEqual([])
    expect(project.landscape.plants).toHaveLength(17)
    for (const tree of zielonkiSurveyTrees) {
      const plant = project.landscape.plants.find(p => p.ref === surveyTreeRef(tree.handle))!
      expect(plant.surveyHandle).toBe(tree.handle)
      expect(plant.position).toEqual(surveyTreePosition(tree.handle))
    }
    for (const building of before.buildings) expect(project.buildings).toContainEqual(building)
    const source = frontBase.buildings.find(b => b.ref === 'building/garden-outbuilding')!
    expect(project.buildings.find(b => b.ref === source.ref)).toEqual(source)
    for (const key of ['zones', 'fixtures'] as const) {
      for (const item of frontBase.landscape[key].filter(x => x.ref.includes('/outbuilding/'))) {
        expect(project.landscape[key]).toContainEqual(item)
      }
    }
    expect(project.site).toEqual(before.site)
  })

  it(`${data.ref}: migrates once and preserves later tree/equipment deletions across save and reload`, async () => {
    const baseline = parseProject(before), published = parseProject(data)
    await synchronizePublishedProject(baseline, baseline)
    const local = (await loadWorkspace(baseline.ref))!
    local.project.name = 'My independent design'
    local.project.landscape.plants.find(p => p.ref === 'plant/orchard-plum')!.matureHeightM = 12
    await saveWorkspace(local)
    expect(await synchronizePublishedProject(published, baseline)).toEqual([])
    const updated = (await loadWorkspace(baseline.ref))!
    expect(updated.project.name).toBe(local.project.name)
    expect(updated.project.landscape.plants).toHaveLength(17)
    expect(updated.project.landscape.plants.find(p => p.ref === 'plant/orchard-plum')!.matureHeightM).toBe(12)
    updated.project.landscape.plants = updated.project.landscape.plants.filter(p => p.ref !== 'plant/survey-5024')
    const outbuilding = updated.project.buildings.find(b => b.ref === 'building/garden-outbuilding')!
    const removed = outbuilding.furniture!.pop()!.ref
    await saveWorkspace(updated)
    expect(await synchronizePublishedProject(published, baseline)).toEqual([])
    const reloaded = (await loadWorkspace(baseline.ref))!.project
    expect(reloaded.landscape.plants.some(p => p.ref === 'plant/survey-5024')).toBe(false)
    expect(reloaded.buildings.find(b => b.ref === outbuilding.ref)!.furniture!.some(f => f.ref === removed)).toBe(false)
  })
}
