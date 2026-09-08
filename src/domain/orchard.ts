import type { PlantModel, ProjectV2 } from './types'

export const STARTER_ORCHARD_VERSION = 2

const legacyOrchardPositions: Record<string, { x: number; z: number }> = {
  'plant/orchard-sour-cherry': { x: 5, z: 23 },
  'plant/orchard-pear': { x: 10.5, z: 23 },
  'plant/orchard-plum': { x: 16, z: 23 },
}

export const starterOrchardPlants: PlantModel[] = [
  {
    ref: 'plant/orchard-sour-cherry', name: 'Sour cherry', species: 'Prunus cerasus', kind: 'tree', position: { x: 4, z: 18 },
    matureHeightM: 4.5, canopyM: 4, sunNeed: 'sun', waterNeed: 0.8, hardinessMinC: -25,
    leafMonths: [4, 5, 6, 7, 8, 9, 10], bloomMonths: [4, 5], locked: false,
  },
  {
    ref: 'plant/orchard-pear', name: 'European pear', species: 'Pyrus communis', kind: 'tree', position: { x: 10.5, z: 18 },
    matureHeightM: 5, canopyM: 4.2, sunNeed: 'sun', waterNeed: 0.85, hardinessMinC: -25,
    leafMonths: [4, 5, 6, 7, 8, 9, 10], bloomMonths: [4, 5], locked: false,
  },
  {
    ref: 'plant/orchard-plum', name: 'European plum', species: 'Prunus domestica', kind: 'tree', position: { x: 17, z: 18 },
    matureHeightM: 4.4, canopyM: 3.8, sunNeed: 'sun', waterNeed: 0.8, hardinessMinC: -25,
    leafMonths: [4, 5, 6, 7, 8, 9, 10], bloomMonths: [4], locked: false,
  },
]

export const ensureStarterOrchard = (source: ProjectV2): ProjectV2 => {
  const project = structuredClone(source)
  if (project.landscape.orchardCatalogVersion >= STARTER_ORCHARD_VERSION) return project
  const existingRefs = new Set(project.landscape.plants.map((plant) => plant.ref))
  project.landscape.plants.push(...starterOrchardPlants.filter((plant) => !existingRefs.has(plant.ref)).map((plant) => structuredClone(plant)))
  if (project.landscape.orchardCatalogVersion === 1) {
    project.landscape.plants = project.landscape.plants.map((plant) => {
      const legacy = legacyOrchardPositions[plant.ref]
      const replacement = starterOrchardPlants.find((candidate) => candidate.ref === plant.ref)
      return legacy && replacement && plant.position.x === legacy.x && plant.position.z === legacy.z
        ? { ...plant, position: { ...replacement.position } }
        : plant
    })
  }
  project.landscape.orchardCatalogVersion = STARTER_ORCHARD_VERSION
  return project
}
