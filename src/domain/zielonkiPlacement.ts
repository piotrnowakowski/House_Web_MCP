import { buildingFootprintsWorld, polygonBounds } from './geometry'
import { ZIELONKI_INTERIOR_ID } from './zielonkiInterior'
import type { BuildingModel, ProjectV2, Vec2 } from './types'

export const ZIELONKI_PLACEMENT_NOTE = 'Zielonki placement and portal revision 2026-09-09: parallel to the neighbour boundary, 4 m neighbour clearance and 5.25 m road clearance; road-side garage approach, no eaves and 40 cm graphite gable frames.'
const courtyardNote = 'Courtyard terrace revision 2026-09-09: the former Sheltered L-courtyard terrace fills the inner corner of the fitted house, flush with both ground-floor facades.'
const dot = (a: Vec2, b: Vec2) => a.x * b.x + a.z * b.z
const subtract = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, z: a.z - b.z })
const world = (b: BuildingModel, p: Vec2): Vec2 => {
  const angle = b.rotationDegrees * Math.PI / 180
  return { x: b.position.x + p.x * Math.cos(angle) + p.z * Math.sin(angle), z: b.position.z - p.x * Math.sin(angle) + p.z * Math.cos(angle) }
}

/** Outside faces, including both floors, rather than the building origin or wall centrelines. */
export const houseEnvelopeWorld = (building: BuildingModel): Vec2[] => [
  ...buildingFootprintsWorld(building).flat(),
  ...building.walls.flatMap((wall) => {
    const delta = subtract(wall.end, wall.start); const length = Math.hypot(delta.x, delta.z)
    const nx = -delta.z / length * wall.thicknessM / 2; const nz = delta.x / length * wall.thicknessM / 2
    return [wall.start, wall.end].flatMap((p) => [-1, 1].map((s) => world(building, { x: p.x + s * nx, z: p.z + s * nz })))
  }),
]

export function zielonkiSetbackLines(project: ProjectV2) {
  const parcel = project.site.parcels.find((p) => p.cadastralNumber === '54/3')
  if (!parcel || parcel.boundary.length < 3) throw new Error('The surveyed 54/3 road and neighbour boundary is required.')
  const [roadEnd, corner, neighbourEnd] = parcel.boundary
  const road = subtract(roadEnd, corner); const neighbour = subtract(neighbourEnd, corner)
  const roadLength = Math.hypot(road.x, road.z); const neighbourLength = Math.hypot(neighbour.x, neighbour.z)
  return { corner, neighbour, roadNormal: { x: road.z / roadLength, z: -road.x / roadLength }, neighbourNormal: { x: -neighbour.z / neighbourLength, z: neighbour.x / neighbourLength } }
}

/** One-time revision of the furnished study and saved copies; subsequent user edits survive reload. */
export function upgradeZielonkiPlacement(source: ProjectV2): ProjectV2 {
  const eligible = source.buildings.filter((b) => b.interiorSource?.id === ZIELONKI_INTERIOR_ID && !b.interiorSource.notes.includes(ZIELONKI_PLACEMENT_NOTE))
  if (!eligible.length) return upgradeZielonkiCourtyard(source)
  const project = structuredClone(source)
  const { corner, neighbour, roadNormal, neighbourNormal } = zielonkiSetbackLines(project)
  for (const building of project.buildings.filter((b) => eligible.some((old) => old.ref === b.ref))) {
    building.rotationDegrees = 270 - Math.atan2(neighbour.z, neighbour.x) * 180 / Math.PI
    building.position = { x: 0, z: 0 }
    const envelope = houseEnvelopeWorld(building)
    const roadOffset = 5.25 + dot(roadNormal, corner) - Math.min(...envelope.map((p) => dot(roadNormal, p)))
    const neighbourOffset = 4 + dot(neighbourNormal, corner) - Math.min(...envelope.map((p) => dot(neighbourNormal, p)))
    const determinant = roadNormal.x * neighbourNormal.z - roadNormal.z * neighbourNormal.x
    building.position = {
      x: (roadOffset * neighbourNormal.z - roadNormal.z * neighbourOffset) / determinant,
      z: (roadNormal.x * neighbourOffset - roadOffset * neighbourNormal.x) / determinant,
    }
    building.roof.overhangM = 0
    for (const segment of building.roof.segments) {
      segment.overhangM = 0
      if (segment.type === 'gable') segment.gableFrame = { widthM: 0.4, depthM: 0.26, colorHex: '#343a3e' }
    }
    const garage = building.walls.find((w) => w.openings.some((o) => o.ref === 'opening/reference-garage-gate'))
    const driveway = project.landscape.zones.find((z) => z.ref === 'zone/driveway')
    if (garage && driveway) {
      // This gate is on the local +z facade. Extend the apron from its outside face to the road boundary.
      const garageSide = Math.min(garage.start.x, garage.end.x) - garage.thicknessM / 2
      const garageFront = garage.start.z + garage.thicknessM / 2
      const a = world(building, { x: garageSide - 1.3, z: garageFront })
      const b = world(building, { x: Math.max(garage.start.x, garage.end.x) + garage.thicknessM / 2, z: garage.start.z + garage.thicknessM / 2 })
      const projectToRoad = (p: Vec2): Vec2 => { const d = dot(subtract(p, corner), roadNormal); return { x: p.x - d * roadNormal.x, z: p.z - d * roadNormal.z } }
      const roadA = projectToRoad(a); const roadB = projectToRoad(b)
      driveway.footprint = [roadA, a, b, roadB]
      driveway.name = 'Road-side garage apron'
      const entrance = project.site.entrances.find((e) => e.ref === 'entrance/house-road')
      if (entrance) { entrance.start = roadA; entrance.end = roadB }
      const entryWall = building.walls.find((w) => w.openings.some((o) => o.ref === 'opening/reference-entrance'))
      const entry = entryWall?.openings.find((o) => o.ref === 'opening/reference-entrance')
      const path = project.landscape.zones.find((z) => z.ref === 'zone/path')
      if (entryWall && entry && path) {
        const direction = Math.sign(entryWall.end.z - entryWall.start.z)
        const entryZ = entryWall.start.z + direction * entry.offsetM
        const endZ = entryZ - entry.widthM / 2 - 0.3
        path.footprint = [
          { x: garageSide - 1.3, z: garageFront }, { x: garageSide, z: garageFront },
          { x: garageSide, z: endZ }, { x: garageSide - 1.3, z: endZ },
        ].map((p) => world(building, p))
        path.name = 'Garage apron to front door'
      }
    }
    building.interiorSource!.notes.push(ZIELONKI_PLACEMENT_NOTE)
  }
  project.revision += 1; project.updatedAt = new Date().toISOString()
  return upgradeZielonkiCourtyard(project)
}

/** Fit the legacy courtyard to the actual house once, including its current rotation and placement. */
export function upgradeZielonkiCourtyard(source: ProjectV2): ProjectV2 {
  const terrace = source.landscape.zones.find((zone) => zone.ref === 'zone/terrace' && zone.name === 'Sheltered L-courtyard terrace')
  const building = source.buildings.find((b) => b.interiorSource?.id === ZIELONKI_INTERIOR_ID && !b.interiorSource.notes.includes(courtyardNote))
  if (!terrace || !building) return source
  const ground = [...building.storeys].sort((a, b) => a.level - b.level)[0]
  const slab = building.slabs.find((s) => s.ref === ground?.baseSlabRef)
  if (!slab) return source
  const bounds = polygonBounds(slab.footprint)
  const corner = slab.footprint.find((p) => p.x > bounds.minX + 0.01 && p.x < bounds.maxX - 0.01
    && p.z > bounds.minZ + 0.01 && p.z < bounds.maxZ - 0.01)
  if (!corner) return source
  const project = structuredClone(source)
  const updated = project.landscape.zones.find((zone) => zone.ref === terrace.ref)!
  updated.name = 'Taras przy budynku'
  updated.kind = 'terrace'
  updated.footprint = [corner, { x: bounds.maxX, z: corner.z }, { x: bounds.maxX, z: bounds.maxZ }, { x: corner.x, z: bounds.maxZ }]
    .map((point) => world(building, point))
  project.buildings.find((b) => b.ref === building.ref)!.interiorSource!.notes.push(courtyardNote)
  project.revision += 1; project.updatedAt = new Date().toISOString()
  return project
}
