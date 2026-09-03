import { buildingFootprintsWorld, distanceToSegment, mergeAdjacentPolygons, offsetPolygon, pointInPolygon, pointOnPolygonBoundary, polygonArea, polygonBounds, polygonPerimeter } from './geometry'
import type { PlantKind, PlantModel, PlantingAreaMetadata, Polygon2, ProjectV2, Vec2 } from './types'

export interface PlantingAreaInput {
  plantingRef: string
  mode: 'boundary' | 'line' | 'polygon'
  sourceRefs?: string[]
  points?: Vec2[]
  inwardOffsetM: number
  spacingM: number
  rowCount: number
  rowSpacingM: number
  cornerTreatment: 'include' | 'distribute' | 'skip'
  plantingPaletteRef?: string
  species?: string
  kind?: PlantKind
  clearanceM: number
}

export interface PlantingConflict { code: string; message: string; subjectRef?: string; skippedCount?: number }
export interface PlantingAreaPlan {
  metadata: PlantingAreaMetadata
  plants: PlantModel[]
  conflicts: PlantingConflict[]
  affectedParcelRefs: string[]
}

const round = (value: number) => Math.round(value * 1000) / 1000
const samePoint = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.z - b.z) < 0.001

const boundaryForSources = (project: ProjectV2, sourceRefs: string[]) => {
  if (!sourceRefs.length || sourceRefs.includes('site')) return project.site.boundary.map((point) => ({ ...point }))
  const parcels = sourceRefs.map((ref) => project.site.parcels.find((parcel) => parcel.ref === ref) ?? (() => { throw new Error(`Parcel not found: ${ref}`) })())
  if (parcels.length === project.site.parcels.length) return project.site.boundary.map((point) => ({ ...point }))
  return parcels.slice(1).reduce((boundary, parcel) => mergeAdjacentPolygons(boundary, parcel.boundary), parcels[0].boundary)
}

const pointAtDistance = (points: Vec2[], distance: number, closed: boolean) => {
  let remaining = distance
  const edgeCount = closed ? points.length : points.length - 1
  for (let index = 0; index < edgeCount; index += 1) {
    const start = points[index]; const end = points[(index + 1) % points.length]
    const length = Math.hypot(end.x - start.x, end.z - start.z)
    if (remaining <= length || index === edgeCount - 1) {
      const ratio = length ? Math.min(1, remaining / length) : 0
      return { x: start.x + (end.x - start.x) * ratio, z: start.z + (end.z - start.z) * ratio }
    }
    remaining -= length
  }
  return { ...points[points.length - 1] }
}

const samplePath = (points: Vec2[], spacingM: number, closed: boolean, corners: PlantingAreaInput['cornerTreatment']) => {
  const length = closed ? polygonPerimeter(points) : points.slice(0, -1).reduce((sum, start, index) => sum + Math.hypot(points[index + 1].x - start.x, points[index + 1].z - start.z), 0)
  if (corners === 'distribute') {
    const intervals = Math.max(1, Math.round(length / spacingM)); const step = length / intervals
    return Array.from({ length: closed ? intervals : intervals + 1 }, (_, index) => pointAtDistance(points, index * step, closed))
  }
  const sampled: Vec2[] = []
  const edgeCount = closed ? points.length : points.length - 1
  for (let index = 0; index < edgeCount; index += 1) {
    const start = points[index]; const end = points[(index + 1) % points.length]; const length = Math.hypot(end.x - start.x, end.z - start.z)
    const first = corners === 'include' ? 0 : Math.min(spacingM / 2, length / 2)
    const last = corners === 'include' ? length : Math.max(first, length - spacingM / 2)
    for (let distance = first; distance <= last + 0.001; distance += spacingM) {
      const ratio = length ? Math.min(1, distance / length) : 0
      const point = { x: start.x + (end.x - start.x) * ratio, z: start.z + (end.z - start.z) * ratio }
      if (!sampled.some((candidate) => samePoint(candidate, point))) sampled.push(point)
    }
  }
  if (!closed && corners === 'include' && !sampled.some((point) => samePoint(point, points.at(-1)!))) sampled.push({ ...points.at(-1)! })
  return sampled
}

const offsetLine = (points: Vec2[], distance: number) => points.map((point, index) => {
  const previous = points[Math.max(0, index - 1)]; const next = points[Math.min(points.length - 1, index + 1)]
  const dx = next.x - previous.x; const dz = next.z - previous.z; const length = Math.hypot(dx, dz) || 1
  return { x: point.x - dz / length * distance, z: point.z + dx / length * distance }
})

const fillPolygon = (polygon: Polygon2, spacingM: number, rowCount: number) => {
  const bounds = polygonBounds(polygon); const points: Vec2[] = []
  for (let row = 0, z = bounds.minZ; z <= bounds.maxZ + 0.001; row += 1, z += spacingM) {
    const stagger = row % 2 ? spacingM / 2 : 0
    for (let x = bounds.minX + stagger; x <= bounds.maxX + 0.001; x += spacingM) {
      const point = { x, z }
      if (pointInPolygon(point, polygon) || pointOnPolygonBoundary(point, polygon)) points.push(point)
    }
    if (rowCount > 1 && row + 1 >= rowCount) break
  }
  return points
}

const candidateConflicts = (project: ProjectV2, point: Vec2, clearanceM: number) => {
  const refs: string[] = []
  for (const building of project.buildings) {
    for (const footprint of buildingFootprintsWorld(building)) {
      if (pointInPolygon(point, footprint) || footprint.some((start, index) => distanceToSegment(point, start, footprint[(index + 1) % footprint.length]) < clearanceM)) refs.push(building.ref)
    }
  }
  project.landscape.zones.filter((zone) => ['path', 'driveway', 'rain-garden'].includes(zone.kind)).forEach((zone) => {
    if (pointInPolygon(point, zone.footprint) || zone.footprint.some((start, index) => distanceToSegment(point, start, zone.footprint[(index + 1) % zone.footprint.length]) < clearanceM)) refs.push(zone.ref)
  })
  project.site.entrances.forEach((entrance) => { if (distanceToSegment(point, entrance.start, entrance.end) < clearanceM) refs.push(entrance.ref) })
  return [...new Set(refs)]
}

export const createPlantingAreaPlan = (project: ProjectV2, input: PlantingAreaInput): PlantingAreaPlan => {
  if (project.landscape.plants.some((plant) => plant.ref.startsWith(`${input.plantingRef}/`))) throw new Error(`Planting reference already exists: ${input.plantingRef}`)
  const sourceRefs = input.mode === 'boundary' ? (input.sourceRefs?.length ? input.sourceRefs : ['site']) : ['custom-geometry']
  const source = input.mode === 'boundary' ? boundaryForSources(project, sourceRefs) : input.points?.map((point) => ({ ...point }))
  if (!source || source.length < (input.mode === 'line' ? 2 : 3)) throw new Error(`${input.mode} planting requires ${input.mode === 'line' ? 'at least two' : 'at least three'} points.`)
  const palette = input.plantingPaletteRef ? project.site.knowledgeBase.planting.recommendations.find((item) => item.ref === input.plantingPaletteRef) : undefined
  if (input.plantingPaletteRef && !palette) throw new Error(`Planting palette reference not found: ${input.plantingPaletteRef}`)
  if (!palette && !input.species) throw new Error('A plantingPaletteRef or species is required.')
  const paths: Polygon2[] = []
  let candidates: Vec2[] = []
  if (input.mode === 'polygon') {
    const inset = offsetPolygon(source, input.inwardOffsetM)
    paths.push(inset); candidates = fillPolygon(inset, input.spacingM, input.rowCount)
  } else if (input.mode === 'boundary') {
    for (let row = 0; row < input.rowCount; row += 1) paths.push(offsetPolygon(source, input.inwardOffsetM + row * input.rowSpacingM))
    candidates = paths.flatMap((path) => samplePath(path, input.spacingM, true, input.cornerTreatment))
  } else {
    for (let row = 0; row < input.rowCount; row += 1) paths.push(offsetLine(source, input.inwardOffsetM + row * input.rowSpacingM))
    candidates = paths.flatMap((path) => samplePath(path, input.spacingM, false, input.cornerTreatment))
  }
  const conflictCounts = new Map<string, number>()
  const accepted = candidates.filter((point) => {
    if (!(pointInPolygon(point, project.site.boundary) || pointOnPolygonBoundary(point, project.site.boundary))) { conflictCounts.set('site', (conflictCounts.get('site') ?? 0) + 1); return false }
    const conflicts = candidateConflicts(project, point, input.clearanceM)
    conflicts.forEach((ref) => conflictCounts.set(ref, (conflictCounts.get(ref) ?? 0) + 1))
    return conflicts.length === 0
  })
  const matureHeightM = palette?.kind === 'tree' ? 8 : palette?.kind === 'hedge' ? 2.2 : 1.2
  const canopyM = palette?.kind === 'tree' ? 5 : palette?.kind === 'hedge' ? Math.max(0.5, input.spacingM) : 0.8
  const plants: PlantModel[] = accepted.map((position, index) => ({
    ref: `${input.plantingRef}/plant-${String(index + 1).padStart(4, '0')}`, name: `${palette?.commonName ?? input.species} ${index + 1}`,
    species: palette?.botanicalName ?? input.species!, kind: palette?.kind ?? input.kind ?? 'hedge', position: { x: round(position.x), z: round(position.z) },
    matureHeightM, canopyM, sunNeed: palette?.sunNeed ?? 'sun', waterNeed: palette?.preferredMoisture === 'wet' ? 0.9 : palette?.preferredMoisture === 'moist' ? 0.75 : 0.6,
    hardinessMinC: palette?.minHardinessC ?? -20, leafMonths: [4, 5, 6, 7, 8, 9, 10], bloomMonths: [], locked: false,
  }))
  const affectedParcelRefs = project.site.parcels.filter((parcel) => plants.some((plant) => pointInPolygon(plant.position, parcel.boundary) || pointOnPolygonBoundary(plant.position, parcel.boundary))).map((parcel) => parcel.ref)
  const conflicts: PlantingConflict[] = [...conflictCounts].map(([subjectRef, skippedCount]) => ({ code: subjectRef === 'site' ? 'planting.outside-site' : 'planting.clearance', subjectRef, skippedCount, message: `${skippedCount} candidate plant${skippedCount === 1 ? '' : 's'} skipped for ${subjectRef === 'site' ? 'site containment' : `clearance from ${subjectRef}`}.` }))
  conflicts.push({ code: 'planting.utilities-unmapped', message: 'Utility alignments are referenced by source evidence but are not modeled as semantic geometry; verify the complete scheme against the current utility survey before approval.' })
  const metadata: PlantingAreaMetadata = {
    plantingRef: input.plantingRef, mode: input.mode, sourceRefs, spacingM: input.spacingM, rowCount: input.rowCount,
    inwardOffsetM: input.inwardOffsetM, cornerTreatment: input.cornerTreatment,
    ...(input.mode === 'polygon' ? { areaM2: round(polygonArea(paths[0])) } : { totalLengthM: round(paths.reduce((sum, path) => sum + (input.mode === 'boundary' ? polygonPerimeter(path) : path.slice(0, -1).reduce((length, point, index) => length + Math.hypot(path[index + 1].x - point.x, path[index + 1].z - point.z), 0)), 0)) }),
  }
  return { metadata, plants, conflicts, affectedParcelRefs }
}
