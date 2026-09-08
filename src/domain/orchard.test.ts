import { describe, expect, it } from 'vitest'
import { sampleProject } from './sampleProject'
import { ensureStarterOrchard, STARTER_ORCHARD_VERSION } from './orchard'

describe('mapped tree migration', () => {
  it('replaces the demo orchard with the 17 map symbols, all 15 metres tall', () => {
    const project = ensureStarterOrchard(sampleProject)
    const trees = project.landscape.plants.filter((plant) => plant.kind === 'tree')
    expect(trees).toHaveLength(17)
    expect(trees.every((plant) => plant.matureHeightM === 15 && plant.surveyHandle)).toBe(true)
    expect(trees.filter((plant) => plant.species === 'Unidentified fruit')).toHaveLength(3)
    expect(project.landscape.plants.filter((plant) => plant.kind !== 'tree')).toEqual(sampleProject.landscape.plants.filter((plant) => plant.kind !== 'tree'))
  })

  it('corrects the older heights while retaining custom heights and lock state', () => {
    const legacy = ensureStarterOrchard(sampleProject)
    legacy.landscape.orchardCatalogVersion = 2
    const apple = legacy.landscape.plants.find((plant) => plant.ref === 'plant/apple')!
    apple.matureHeightM = 5.5
    legacy.landscape.plants.find((plant) => plant.ref === 'plant/orchard-pear')!.matureHeightM = 12
    const migrated = ensureStarterOrchard(legacy)
    expect(migrated.landscape.plants.find((plant) => plant.ref === apple.ref)).toMatchObject({ matureHeightM: 15, locked: apple.locked })
    expect(migrated.landscape.plants.find((plant) => plant.ref === 'plant/orchard-pear')!.matureHeightM).toBe(12)
    expect(migrated.revision).toBe(legacy.revision + 1)
    expect(apple.matureHeightM).toBe(5.5)
  })

  it('does not restore deleted trees or overwrite edits after the map correction', () => {
    const project = ensureStarterOrchard(sampleProject)
    project.landscape.plants = project.landscape.plants.filter((plant) => plant.ref !== 'plant/orchard-plum')
    const apple = project.landscape.plants.find((plant) => plant.ref === 'plant/apple')!
    apple.position = { x: -13, z: 20 }; apple.matureHeightM = 12; apple.canopyM = 8
    expect(project.landscape.orchardCatalogVersion).toBe(STARTER_ORCHARD_VERSION)
    expect(ensureStarterOrchard(project)).toEqual(project)
  })
})
