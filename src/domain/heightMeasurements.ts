import { buildingGroundOffset, elevationAt, polygonCentroid, spaceFootprint } from './geometry'
import { roofSegmentRidgeElevation, roofSegmentRise } from './roofs'
import type { BuildingModel, HeightMeasureKind, HeightMeasurement, HeightMeasurementPoint, ProjectV2, RoofSegmentModel, Vec3 } from './types'

export type HeightMeasurementRequest =
  | { mode: 'semantic'; objectRef: string; measurement?: HeightMeasureKind }
  | { mode: 'free-vertical'; startPoint: Vec3; endPoint: Vec3 }

const round = (value: number) => Math.round(value * 1000) / 1000

const localToProject = (building: BuildingModel, x: number, z: number) => {
  const angle = building.rotationDegrees * Math.PI / 180; const cosine = Math.cos(angle); const sine = Math.sin(angle)
  return { x: building.position.x + x * cosine + z * sine, z: building.position.z - x * sine + z * cosine }
}

const highestSegment = (building: BuildingModel): RoofSegmentModel => [...building.roof.segments].sort((a, b) => roofSegmentRidgeElevation(b) - roofSegmentRidgeElevation(a))[0]

const measured = (project: ProjectV2, input: {
  objectRef?: string; buildingRef?: string; kind: HeightMeasurement['kind']; label: string
  bottom: HeightMeasurementPoint; top: HeightMeasurementPoint
}): HeightMeasurement => {
  const datum = project.site.knowledgeBase.terrain.datumElevationM
  const bottomY = Math.min(input.bottom.y, input.top.y); const topY = Math.max(input.bottom.y, input.top.y)
  const bottom = input.bottom.y <= input.top.y ? input.bottom : input.top; const top = input.bottom.y <= input.top.y ? input.top : input.bottom
  return {
    objectRef: input.objectRef, buildingRef: input.buildingRef, kind: input.kind, label: input.label, heightM: round(topY - bottomY),
    bottomPoint: { ...bottom, y: round(bottomY) }, topPoint: { ...top, y: round(topY) },
    bottomElevation: { localProjectM: round(bottomY), absoluteM: round(datum + bottomY) },
    topElevation: { localProjectM: round(topY), absoluteM: round(datum + topY) },
  }
}

const point = (x: number, y: number, z: number, reference: string): HeightMeasurementPoint => ({ x: round(x), y: round(y), z: round(z), reference })

export const measureHeight = (project: ProjectV2, request: HeightMeasurementRequest): HeightMeasurement => {
  if (request.mode === 'free-vertical') {
    const start = point(request.startPoint.x, request.startPoint.y, request.startPoint.z, 'picked/start')
    const end = point(request.endPoint.x, request.endPoint.y, request.endPoint.z, 'picked/end')
    return measured(project, { kind: 'free-vertical', label: 'Free vertical distance', bottom: start, top: end })
  }
  const requestedKind = request.measurement ?? 'auto'
  for (const building of project.buildings) {
    const offsetY = buildingGroundOffset(building, 0)
    const selectedSegment = building.roof.segments.find((segment) => segment.ref === request.objectRef)
    const measuredSegment = selectedSegment ?? highestSegment(building)
    const roofFootprint = measuredSegment.footprint ?? building.roof.footprint ?? building.slabs.at(-1)?.footprint ?? building.slabs[0]?.footprint
    const roofCenterLocal = roofFootprint ? polygonCentroid(roofFootprint) : { x: 0, z: 0 }
    const roofCenter = localToProject(building, roofCenterLocal.x, roofCenterLocal.z)
    const terrainY = elevationAt(project, roofCenter.x, roofCenter.z)
    const eavesY = measuredSegment.baseElevationM + offsetY; const ridgeY = eavesY + roofSegmentRise(measuredSegment)
    const groundTo = (kind: 'ground-to-eaves' | 'ground-to-ridge') => measured(project, {
      objectRef: request.objectRef, buildingRef: building.ref, kind, label: kind === 'ground-to-eaves' ? 'Ground to eaves' : 'Ground to ridge',
      bottom: point(roofCenter.x, terrainY, roofCenter.z, 'terrain/surface'),
      top: point(roofCenter.x, kind === 'ground-to-eaves' ? eavesY : ridgeY, roofCenter.z, `${selectedSegment?.ref ?? building.roof.ref}/${kind === 'ground-to-eaves' ? 'eaves' : 'ridge'}`),
    })
    const terrainClearance = (label: string, x: number, z: number, targetY: number, targetRef: string) => measured(project, {
      objectRef: request.objectRef, buildingRef: building.ref, kind: 'terrain-clearance', label,
      bottom: point(x, elevationAt(project, x, z), z, 'terrain/surface'), top: point(x, targetY, z, targetRef),
    })
    const ownsRef = building.ref === request.objectRef || building.roof.ref === request.objectRef || building.roof.segments.some((segment) => segment.ref === request.objectRef)
      || building.storeys.some((item) => item.ref === request.objectRef) || building.slabs.some((item) => item.ref === request.objectRef)
      || building.walls.some((item) => item.ref === request.objectRef || item.openings.some((opening) => opening.ref === request.objectRef))
      || building.spaces.some((item) => item.ref === request.objectRef) || building.platforms.some((item) => item.ref === request.objectRef)
      || building.ceilingFinishes.some((item) => item.ref === request.objectRef)
    if (!ownsRef) continue
    if (requestedKind === 'ground-to-eaves') return groundTo('ground-to-eaves')
    if (requestedKind === 'ground-to-ridge') return groundTo('ground-to-ridge')
    if (building.ref === request.objectRef) {
      const bottomStored = Math.min(...building.slabs.map((slab) => slab.topElevationM - slab.thicknessM)); const bottomY = bottomStored + offsetY
      if (requestedKind === 'terrain-clearance') return terrainClearance('Terrain to building base', roofCenter.x, roofCenter.z, bottomY, `${building.ref}/base`)
      return measured(project, { objectRef: building.ref, buildingRef: building.ref, kind: requestedKind, label: 'Building height', bottom: point(roofCenter.x, bottomY, roofCenter.z, `${building.ref}/base`), top: point(roofCenter.x, ridgeY, roofCenter.z, `${building.roof.ref}/ridge`) })
    }
    if (building.roof.ref === request.objectRef || selectedSegment) {
      if (requestedKind === 'terrain-clearance') return terrainClearance('Terrain to roof eaves', roofCenter.x, roofCenter.z, eavesY, `${building.roof.ref}/eaves`)
      const ref = selectedSegment?.ref ?? building.roof.ref
      return measured(project, { objectRef: ref, buildingRef: building.ref, kind: requestedKind, label: selectedSegment ? 'Roof segment rise' : 'Roof rise', bottom: point(roofCenter.x, eavesY, roofCenter.z, `${ref}/eaves`), top: point(roofCenter.x, ridgeY, roofCenter.z, `${ref}/ridge`) })
    }
    const storey = building.storeys.find((item) => item.ref === request.objectRef || item.spaceRefs.includes(request.objectRef) || item.wallRefs.includes(request.objectRef) || item.platformRefs.includes(request.objectRef) || item.ceilingFinishRefs.includes(request.objectRef))
    const storeyFootprint = building.slabs.find((slab) => slab.ref === storey?.baseSlabRef)?.footprint
    const storeyCenterLocal = storeyFootprint ? polygonCentroid(storeyFootprint) : roofCenterLocal; const storeyCenter = localToProject(building, storeyCenterLocal.x, storeyCenterLocal.z)
    if (storey && (storey.ref === request.objectRef || building.spaces.some((space) => space.ref === request.objectRef))) {
      if (requestedKind === 'terrain-clearance') return terrainClearance('Terrain to storey floor', storeyCenter.x, storeyCenter.z, storey.elevationM + offsetY, `${storey.ref}/floor-face`)
      return measured(project, { objectRef: request.objectRef, buildingRef: building.ref, kind: requestedKind === 'auto' ? 'clear-height' : requestedKind, label: `${storey.name} clear height`, bottom: point(storeyCenter.x, storey.elevationM + offsetY, storeyCenter.z, `${storey.ref}/floor-face`), top: point(storeyCenter.x, storey.elevationM + storey.clearHeightM + offsetY, storeyCenter.z, `${storey.ref}/ceiling-face`) })
    }
    const wall = building.walls.find((item) => item.ref === request.objectRef || item.openings.some((opening) => opening.ref === request.objectRef))
    if (wall) {
      const wallMidLocal = { x: (wall.start.x + wall.end.x) / 2, z: (wall.start.z + wall.end.z) / 2 }; const wallMid = localToProject(building, wallMidLocal.x, wallMidLocal.z)
      const opening = wall.openings.find((item) => item.ref === request.objectRef)
      if (opening) {
        const length = Math.hypot(wall.end.x - wall.start.x, wall.end.z - wall.start.z); const ratio = length ? opening.offsetM / length : 0
        const openingLocal = { x: wall.start.x + (wall.end.x - wall.start.x) * ratio, z: wall.start.z + (wall.end.z - wall.start.z) * ratio }; const position = localToProject(building, openingLocal.x, openingLocal.z)
        const sillY = wall.baseElevationM + opening.sillM + offsetY
        if (requestedKind === 'terrain-clearance') return terrainClearance('Terrain to opening sill', position.x, position.z, sillY, `${opening.ref}/sill`)
        return measured(project, { objectRef: opening.ref, buildingRef: building.ref, kind: requestedKind === 'auto' ? 'opening-height' : requestedKind, label: `${opening.kind === 'door' ? 'Door' : 'Window'} opening height`, bottom: point(position.x, sillY, position.z, `${opening.ref}/sill`), top: point(position.x, sillY + opening.heightM, position.z, `${opening.ref}/head`) })
      }
      if (requestedKind === 'terrain-clearance') return measured(project, { objectRef: wall.ref, buildingRef: building.ref, kind: requestedKind, label: 'Terrain to wall base', bottom: point(wallMid.x, elevationAt(project, wallMid.x, wallMid.z), wallMid.z, 'terrain/surface'), top: point(wallMid.x, wall.baseElevationM + offsetY, wallMid.z, `${wall.ref}/base`) })
      return measured(project, { objectRef: wall.ref, buildingRef: building.ref, kind: requestedKind, label: 'Wall height', bottom: point(wallMid.x, wall.baseElevationM + offsetY, wallMid.z, `${wall.ref}/base`), top: point(wallMid.x, wall.baseElevationM + wall.heightM + offsetY, wallMid.z, `${wall.ref}/top`) })
    }
    const slab = building.slabs.find((item) => item.ref === request.objectRef)
    if (slab) {
      const centerLocal = polygonCentroid(slab.footprint); const center = localToProject(building, centerLocal.x, centerLocal.z)
      if (requestedKind === 'terrain-clearance') return terrainClearance('Terrain to slab underside', center.x, center.z, slab.topElevationM - slab.thicknessM + offsetY, `${slab.ref}/bottom-face`)
      return measured(project, { objectRef: slab.ref, buildingRef: building.ref, kind: requestedKind, label: 'Slab thickness', bottom: point(center.x, slab.topElevationM - slab.thicknessM + offsetY, center.z, `${slab.ref}/bottom-face`), top: point(center.x, slab.topElevationM + offsetY, center.z, `${slab.ref}/top-face`) })
    }
    const platform = building.platforms.find((item) => item.ref === request.objectRef)
    if (platform) {
      const centerLocal = polygonCentroid(platform.footprint); const center = localToProject(building, centerLocal.x, centerLocal.z)
      if (requestedKind === 'terrain-clearance') return terrainClearance('Terrain to platform underside', center.x, center.z, platform.elevationM - platform.thicknessM + offsetY, `${platform.ref}/bottom-face`)
      return measured(project, { objectRef: platform.ref, buildingRef: building.ref, kind: requestedKind, label: 'Platform thickness', bottom: point(center.x, platform.elevationM - platform.thicknessM + offsetY, center.z, `${platform.ref}/bottom-face`), top: point(center.x, platform.elevationM + offsetY, center.z, `${platform.ref}/top-face`) })
    }
    const finish = building.ceilingFinishes.find((item) => item.ref === request.objectRef)
    if (finish) {
      const space = building.spaces.find((item) => item.ref === finish.spaceRef); const centerLocal = space ? polygonCentroid(spaceFootprint(building, space)) : roofCenterLocal; const center = localToProject(building, centerLocal.x, centerLocal.z)
      if (requestedKind === 'terrain-clearance') return terrainClearance('Terrain to ceiling finish', center.x, center.z, finish.elevationM - finish.thicknessM + offsetY, `${finish.ref}/bottom-face`)
      return measured(project, { objectRef: finish.ref, buildingRef: building.ref, kind: requestedKind, label: 'Ceiling finish thickness', bottom: point(center.x, finish.elevationM - finish.thicknessM + offsetY, center.z, `${finish.ref}/bottom-face`), top: point(center.x, finish.elevationM + offsetY, center.z, `${finish.ref}/top-face`) })
    }
  }
  throw new Error(`Height-measurable semantic object not found: ${request.objectRef}`)
}
