import { describe, expect, it } from 'vitest'
import { sampleProject } from './sampleProject'
import { ensureStarterOrchard, STARTER_ORCHARD_VERSION } from './orchard'

describe('starter orchard migration', () => {
  it('adds the recommended fruit trees once', () => {
    const first = ensureStarterOrchard(sampleProject)
    const second = ensureStarterOrchard(first)
    expect(first.landscape.orchardCatalogVersion).toBe(STARTER_ORCHARD_VERSION)
    expect(first.landscape.plants.filter((plant) => ['Prunus cerasus', 'Pyrus communis', 'Prunus domestica'].includes(plant.species))).toHaveLength(3)
    expect(second.landscape.plants).toHaveLength(first.landscape.plants.length)
  })

  it('moves only untouched version-one orchard defaults away from the raised beds', () => {
    const versionOne = ensureStarterOrchard({
      ...sampleProject,
      landscape: { ...sampleProject.landscape, orchardCatalogVersion: 0 },
    })
    versionOne.landscape.orchardCatalogVersion = 1
    versionOne.landscape.plants.find((plant) => plant.ref === 'plant/orchard-sour-cherry')!.position = { x: 5, z: 23 }
    versionOne.landscape.plants.find((plant) => plant.ref === 'plant/orchard-plum')!.position = { x: 16, z: 23 }
    const pear = versionOne.landscape.plants.find((plant) => plant.ref === 'plant/orchard-pear')!
    pear.position = { x: 13, z: 20 }
    const migrated = ensureStarterOrchard(versionOne)

    expect(migrated.landscape.plants.find((plant) => plant.ref === 'plant/orchard-sour-cherry')?.position).toEqual({ x: 4, z: 18 })
    expect(migrated.landscape.plants.find((plant) => plant.ref === 'plant/orchard-pear')?.position).toEqual({ x: 13, z: 20 })
    expect(migrated.landscape.orchardCatalogVersion).toBe(2)
  })
})
