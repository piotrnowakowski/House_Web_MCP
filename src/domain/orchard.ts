import type { PlantModel, ProjectV2 } from './types'
import { surveyTreePosition, surveyTreeRef, zielonkiSurveyTrees } from '../../knowledge-bank/zielonki/trees'
import { pointInPolygon } from './geometry'

export const STARTER_ORCHARD_VERSION = 6

/** Owner-reported site tree height, not a species-wide mature-height recommendation. */
export const ZIELONKI_TREE_HEIGHT_M = 15
const legacyTreeHeights: Record<string, number> = {
  'plant/apple': 5.5,
  'plant/orchard-sour-cherry': 4.5,
  'plant/orchard-pear': 5,
  'plant/orchard-plum': 4.4,
}

export const starterOrchardPlants: PlantModel[] = [
  {
    ref: 'plant/orchard-sour-cherry', name: 'Sour cherry', species: 'Prunus cerasus', kind: 'tree', position: { x: 4, z: 18 },
    matureHeightM: ZIELONKI_TREE_HEIGHT_M, canopyM: 4, sunNeed: 'sun', waterNeed: 0.8, hardinessMinC: -25,
    leafMonths: [4, 5, 6, 7, 8, 9, 10], bloomMonths: [4, 5], locked: false,
  },
  {
    ref: 'plant/orchard-pear', name: 'European pear', species: 'Pyrus communis', kind: 'tree', position: { x: 10.5, z: 18 },
    matureHeightM: ZIELONKI_TREE_HEIGHT_M, canopyM: 4.2, sunNeed: 'sun', waterNeed: 0.85, hardinessMinC: -25,
    leafMonths: [4, 5, 6, 7, 8, 9, 10], bloomMonths: [4, 5], locked: false,
  },
  {
    ref: 'plant/orchard-plum', name: 'European plum', species: 'Prunus domestica', kind: 'tree', position: { x: 17, z: 18 },
    matureHeightM: ZIELONKI_TREE_HEIGHT_M, canopyM: 3.8, sunNeed: 'sun', waterNeed: 0.8, hardinessMinC: -25,
    leafMonths: [4, 5, 6, 7, 8, 9, 10], bloomMonths: [4], locked: false,
  },
]

export const ensureStarterOrchard = (source: ProjectV2): ProjectV2 => {
  const project = structuredClone(source)
  if (project.landscape.orchardCatalogVersion >= STARTER_ORCHARD_VERSION) return project
  project.landscape.plants.forEach((plant) => {
    if (project.landscape.orchardCatalogVersion < 3 && plant.kind === 'tree' && plant.matureHeightM === legacyTreeHeights[plant.ref]) {
      plant.matureHeightM = ZIELONKI_TREE_HEIGHT_M
    }
  })
  for (const tree of zielonkiSurveyTrees) {
    const oldRef = `plant/survey-${tree.handle.toLowerCase()}`
    const ref = surveyTreeRef(tree.handle)
    const existing = project.landscape.plants.find((plant) => plant.ref === ref)
      ?? project.landscape.plants.find((plant) => plant.ref === oldRef)
    const position = surveyTreePosition(tree.handle)
    const placementRole = pointInPolygon(position, project.site.boundary) ? 'site' : 'context'
    // The v5 inventory is complete: correct positions without restoring deletions or resetting tree edits.
    if (project.landscape.orchardCatalogVersion === 5) {
      if (existing) Object.assign(existing, { position, placementRole })
      continue
    }
    // Version four added a second copy of the four original tree records.
    project.landscape.plants = project.landscape.plants.filter((plant) => plant.ref !== ref && plant.ref !== oldRef)
    project.landscape.plants.push({
      ref, name: `Mapped ${tree.category} tree ${tree.handle}`, species: `Unidentified ${tree.category}`,
      kind: 'tree', position, matureHeightM: existing?.matureHeightM ?? ZIELONKI_TREE_HEIGHT_M,
      canopyM: tree.category === 'conifer' ? 5.2 : tree.category === 'fruit' ? 6 : 7,
      surveyHandle: tree.handle,
      crownShape: tree.category === 'conifer' ? 'conical' : 'rounded',
      placementRole,
      sunNeed: 'sun', waterNeed: 1, hardinessMinC: -25,
      leafMonths: tree.category === 'conifer' ? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] : [4, 5, 6, 7, 8, 9, 10],
      bloomMonths: [], locked: existing?.locked ?? true,
    })
  }
  // Old pending proposals contain full project snapshots and must not erase these corrections.
  project.revision += 1
  project.updatedAt = new Date().toISOString()
  project.landscape.orchardCatalogVersion = STARTER_ORCHARD_VERSION
  return project
}
