import { applyCommand } from './commands'
import { pointInPolygon, pointOnPolygonBoundary, polygonArea, polygonCentroid, spaceFootprint } from './geometry'
import { decomposeOrthogonalLFootprint, ridgeDirectionForFootprint } from './roofs'
import type { BuildingModel, Polygon2, ProjectV2, StoreyModel } from './types'

const containsFootprint = (outer: Polygon2, inner: Polygon2) => inner.every((point) => pointInPolygon(point, outer) || pointOnPolygonBoundary(point, outer))

const sameFootprint = (first: Polygon2, second: Polygon2) => Math.abs(polygonArea(first) - polygonArea(second)) < 0.02
  && containsFootprint(first, second)
  && containsFootprint(second, first)

const topStorey = (building: BuildingModel) => [...building.storeys].sort((first, second) => second.level - first.level)[0]

const targetFootprint = (building: BuildingModel) => building.roof.footprint
  ?? building.slabs.find((slab) => slab.ref === building.storeys[0]?.baseSlabRef)?.footprint
  ?? building.slabs[0]?.footprint
  ?? []

const spaceForFootprint = (building: BuildingModel, storey: StoreyModel, footprint: Polygon2) => {
  const center = polygonCentroid(footprint)
  return building.spaces.find((space) => storey.spaceRefs.includes(space.ref) && (() => {
    try {
      const candidate = spaceFootprint(building, space)
      return pointInPolygon(center, candidate) || pointOnPolygonBoundary(center, candidate)
    } catch {
      return false
    }
  })())?.ref ?? storey.spaceRefs[0]
}

export const isModernBarnPreset = (project: ProjectV2) => {
  const building = project.buildings.find((item) => item.ref === 'house/main') ?? project.buildings.find((item) => item.kind === 'house')
  if (!building || building.architecturalStyle !== 'barn' || building.storeys.length < 2 || building.roof.type !== 'gable' || building.roof.pitchDegrees !== 45) return false
  const upper = topStorey(building)
  const upperSlab = building.slabs.find((slab) => slab.ref === upper.baseSlabRef)
  const footprint = targetFootprint(building)
  const eavesElevationM = upper.elevationM + upper.clearHeightM
  if (!upperSlab || !sameFootprint(upperSlab.footprint, footprint)) return false
  if (building.roof.segments.some((segment) => segment.storeyRef !== upper.ref || Math.abs(segment.baseElevationM - eavesElevationM) > 0.001)) return false
  const wings = decomposeOrthogonalLFootprint(footprint)
  if (!wings) return true
  const directions = new Set(building.roof.segments.map((segment) => segment.ridgeDirection))
  return building.roof.segments.length === 2
    && directions.has('x')
    && directions.has('z')
    && building.roof.junctions.some((junction) => junction.type === 'valley'
      && building.roof.segments.every((segment) => junction.segmentRefs.includes(segment.ref)))
}

export const applyModernBarnPreset = (source: ProjectV2): ProjectV2 => {
  if (isModernBarnPreset(source)) return structuredClone(source)
  let project = structuredClone(source)
  let building = project.buildings.find((item) => item.ref === 'house/main') ?? project.buildings.find((item) => item.kind === 'house')
  if (!building) return structuredClone(source)
  if (building.architecturalStyle !== 'barn' || building.roof.type !== 'gable' || building.roof.pitchDegrees !== 45) {
    project = applyCommand(project, { type: 'building.update', action: 'set-style', buildingRef: building.ref, architecturalStyle: 'barn' })
    building = project.buildings.find((item) => item.ref === building!.ref)!
  }
  if (building.storeys.length < 2) {
    project = applyCommand(project, {
      type: 'storey.update', action: 'add', buildingRef: building.ref, storeyRef: `${building.ref}/storey-upper`, name: 'Upper storey', clearHeightM: 2.9,
    })
    building = project.buildings.find((item) => item.ref === building!.ref)!
  }

  let upper = topStorey(building)
  let upperSlab = building.slabs.find((slab) => slab.ref === upper.baseSlabRef)
  const footprint = targetFootprint(building)
  if (upperSlab && polygonArea(footprint) > polygonArea(upperSlab.footprint) + 0.01) {
    const extensionRef = `${upper.ref}/space-wing`
    const previousUpperWallRefs = new Set(upper.wallRefs)
    const inheritedFinish = building.walls.find((wall) => upper.wallRefs.includes(wall.ref))?.finish
    project = applyCommand(project, {
      type: 'storey.update', action: 'extend-footprint', buildingRef: building.ref, storeyRef: upper.ref, footprint,
      spaceRef: building.spaces.some((space) => space.ref === extensionRef) ? `${extensionRef}-2` : extensionRef,
      spaceName: 'Upper wing', usage: 'living',
    })
    building = project.buildings.find((item) => item.ref === building!.ref)!
    upper = topStorey(building)
    upperSlab = building.slabs.find((slab) => slab.ref === upper.baseSlabRef)
    if (inheritedFinish) {
      for (const wallRef of upper.wallRefs.filter((ref) => !previousUpperWallRefs.has(ref))) {
        project = applyCommand(project, {
          type: 'wall.finish', buildingRef: building.ref, wallRef,
          material: inheritedFinish.material, colorHex: inheritedFinish.colorHex,
        })
        building = project.buildings.find((item) => item.ref === building!.ref)!
        upper = topStorey(building)
      }
    }
  }

  const wings = decomposeOrthogonalLFootprint(upperSlab?.footprint ?? footprint)
  if (wings && building.roof.segments.length === 1) {
    const sourceSegment = building.roof.segments[0]
    const segmentRefs = wings.map((wing, index) => `${building!.roof.ref}/segment-${ridgeDirectionForFootprint(wing)}-wing-${index + 1}`) as [string, string]
    project = applyCommand(project, {
      type: 'roof.update', action: 'split-segment', buildingRef: building.ref, segmentRef: sourceSegment.ref,
      segments: wings.map((wing, index) => ({
        segmentRef: segmentRefs[index], footprint: wing, ridgeDirection: ridgeDirectionForFootprint(wing), storeyRef: upper.ref,
        spaceRef: spaceForFootprint(building!, upper, wing), baseElevationM: upper.elevationM + upper.clearHeightM,
        material: building!.roof.finish.material, colorHex: building!.roof.finish.colorHex,
      })),
      junctions: [{ ref: `${building.roof.ref}/junction-wings`, type: 'valley', segmentRefs }],
    })
    building = project.buildings.find((item) => item.ref === building!.ref)!
    upper = topStorey(building)
  }

  if (wings && building.roof.segments.length === 2) {
    const segmentRefs = building.roof.segments.map((segment) => segment.ref) as [string, string]
    const hasValley = building.roof.junctions.some((junction) => junction.type === 'valley' && segmentRefs.every((ref) => junction.segmentRefs.includes(ref)))
    if (!hasValley) {
      project = applyCommand(project, {
        type: 'roof.update', action: 'update', buildingRef: building.ref, segmentRef: segmentRefs[0],
        junctions: [{ ref: `${building.roof.ref}/junction-wings`, type: 'valley', segmentRefs }],
      })
      building = project.buildings.find((item) => item.ref === building!.ref)!
      upper = topStorey(building)
    }
  }

  const eavesElevationM = upper.elevationM + upper.clearHeightM
  for (const segment of building.roof.segments) {
    project = applyCommand(project, {
      type: 'roof.update', action: 'update', buildingRef: building.ref, segmentRef: segment.ref,
      storeyRef: upper.ref, spaceRef: spaceForFootprint(building, upper, segment.footprint), targetEavesElevationM: eavesElevationM,
      material: building.roof.finish.material, colorHex: building.roof.finish.colorHex, synchronization: 'roof-only',
    })
    building = project.buildings.find((item) => item.ref === building!.ref)!
    upper = topStorey(building)
  }
  return project
}
