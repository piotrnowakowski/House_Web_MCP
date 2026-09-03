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
})
