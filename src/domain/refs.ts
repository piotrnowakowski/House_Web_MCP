import type { ProjectV2 } from './types'
import { gableWallsForBuilding } from './roofWings'
import { resolveGableWallFinish } from './wallFinishes'

export type ProjectObjectKind = 'building' | 'storey' | 'slab' | 'wall' | 'opening' | 'space' | 'roof' | 'roof-segment' | 'platform' | 'ceiling-finish' | 'zone' | 'plant' | 'fixture' | 'parcel' | 'entrance'
export interface ProjectObjectLookup { kind: ProjectObjectKind; buildingRef?: string; storeyRef?: string; wallRef?: string; object: unknown }

/** Compact building card: identity, placement and child references, without the child geometry. */
const buildingCard = (project: ProjectV2, ref: string) => {
  const building = project.buildings.find((item) => item.ref === ref)!
  return {
    ref: building.ref, name: building.name, kind: building.kind, architecturalStyle: building.architecturalStyle, position: building.position, rotationDegrees: building.rotationDegrees,
    storeys: building.storeys.map((storey) => ({ ref: storey.ref, name: storey.name, level: storey.level, elevationM: storey.elevationM, clearHeightM: storey.clearHeightM, wallRefs: storey.wallRefs, spaceRefs: storey.spaceRefs })),
    slabRefs: building.slabs.map((slab) => slab.ref), wallRefs: building.walls.map((wall) => wall.ref), spaceRefs: building.spaces.map((space) => space.ref), roof: building.roof,
  }
}

/** Resolves any stable semantic reference to the object it names, so an agent can read one thing instead of a whole slice. */
export const findProjectObject = (project: ProjectV2, ref: string): ProjectObjectLookup | null => {
  for (const building of project.buildings) {
    if (building.ref === ref) return { kind: 'building', buildingRef: building.ref, object: buildingCard(project, ref) }
    if (building.roof.ref === ref) return { kind: 'roof', buildingRef: building.ref, object: building.roof }
    const segment = building.roof.segments.find((item) => item.ref === ref); if (segment) return { kind: 'roof-segment', buildingRef: building.ref, object: segment }
    const storey = building.storeys.find((item) => item.ref === ref); if (storey) return { kind: 'storey', buildingRef: building.ref, object: storey }
    const slab = building.slabs.find((item) => item.ref === ref); if (slab) return { kind: 'slab', buildingRef: building.ref, object: slab }
    const wall = building.walls.find((item) => item.ref === ref)
    if (wall) return { kind: 'wall', buildingRef: building.ref, storeyRef: building.storeys.find((item) => item.wallRefs.includes(wall.ref))?.ref, object: wall }
    const gable = gableWallsForBuilding(building).find((item) => item.ref === ref)
    if (gable) return { kind: 'wall', buildingRef: building.ref, object: { ...gable, wallType: 'gable', finish: resolveGableWallFinish(building, gable) } }
    for (const host of building.walls) { const opening = host.openings.find((item) => item.ref === ref); if (opening) return { kind: 'opening', buildingRef: building.ref, wallRef: host.ref, object: opening } }
    const space = building.spaces.find((item) => item.ref === ref)
    if (space) return { kind: 'space', buildingRef: building.ref, storeyRef: building.storeys.find((item) => item.spaceRefs.includes(space.ref))?.ref, object: space }
    const platform = building.platforms.find((item) => item.ref === ref); if (platform) return { kind: 'platform', buildingRef: building.ref, object: platform }
    const finish = building.ceilingFinishes.find((item) => item.ref === ref); if (finish) return { kind: 'ceiling-finish', buildingRef: building.ref, object: finish }
  }
  const zone = project.landscape.zones.find((item) => item.ref === ref); if (zone) return { kind: 'zone', object: zone }
  const plant = project.landscape.plants.find((item) => item.ref === ref); if (plant) return { kind: 'plant', object: plant }
  const fixture = project.landscape.fixtures.find((item) => item.ref === ref); if (fixture) return { kind: 'fixture', object: fixture }
  const parcel = project.site.parcels.find((item) => item.ref === ref); if (parcel) return { kind: 'parcel', object: parcel }
  const entrance = project.site.entrances.find((item) => item.ref === ref); if (entrance) return { kind: 'entrance', object: entrance }
  return null
}

export const knowledgeSections = ['sources', 'measurements', 'terrain', 'geotechnical', 'planting', 'designRules', 'caveats'] as const
export type KnowledgeSection = typeof knowledgeSections[number]

/** Knowledge-bank overview without the large arrays, or one named section. */
export const knowledgeSlice = (project: ProjectV2, section?: KnowledgeSection) => {
  const bank = project.site.knowledgeBase
  if (section) return bank[section]
  return {
    datasetVersion: bank.datasetVersion, locality: bank.locality, addressContext: bank.addressContext, cadastralDistrict: bank.cadastralDistrict,
    coordinateSystem: bank.coordinateSystem, heightSystem: bank.heightSystem, terrain: bank.terrain,
    sectionCounts: { sources: bank.sources.length, measurements: bank.measurements.length, boreholes: bank.geotechnical.boreholes.length, plantingRecommendations: bank.planting.recommendations.length, designRules: bank.designRules.length, caveats: bank.caveats.length },
    sections: knowledgeSections,
  }
}
