import type { PlantModel, ProjectV2 } from './types'

export const STARTER_ORCHARD_VERSION = 1

export const starterOrchardPlants: PlantModel[] = [
  {
    ref: 'plant/orchard-sour-cherry', name: 'Sour cherry', species: 'Prunus cerasus', kind: 'tree', position: { x: 5, z: 23 },
    matureHeightM: 4.5, canopyM: 4, sunNeed: 'sun', waterNeed: 0.8, hardinessMinC: -25,
    leafMonths: [4, 5, 6, 7, 8, 9, 10], bloomMonths: [4, 5], locked: false,
  },
  {
    ref: 'plant/orchard-pear', name: 'European pear', species: 'Pyrus communis', kind: 'tree', position: { x: 10.5, z: 23 },
    matureHeightM: 5, canopyM: 4.2, sunNeed: 'sun', waterNeed: 0.85, hardinessMinC: -25,
    leafMonths: [4, 5, 6, 7, 8, 9, 10], bloomMonths: [4, 5], locked: false,
  },
  {
    ref: 'plant/orchard-plum', name: 'European plum', species: 'Prunus domestica', kind: 'tree', position: { x: 16, z: 23 },
    matureHeightM: 4.4, canopyM: 3.8, sunNeed: 'sun', waterNeed: 0.8, hardinessMinC: -25,
    leafMonths: [4, 5, 6, 7, 8, 9, 10], bloomMonths: [4], locked: false,
  },
]

export const ensureStarterOrchard = (source: ProjectV2): ProjectV2 => {
  const project = structuredClone(source)
  if (project.landscape.orchardCatalogVersion >= STARTER_ORCHARD_VERSION) return project
  const existingRefs = new Set(project.landscape.plants.map((plant) => plant.ref))
  project.landscape.plants.push(...starterOrchardPlants.filter((plant) => !existingRefs.has(plant.ref)).map((plant) => structuredClone(plant)))
  project.landscape.orchardCatalogVersion = STARTER_ORCHARD_VERSION
  return project
}
