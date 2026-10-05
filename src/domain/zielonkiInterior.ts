import { offsetPolygon, pointOnPolygonBoundary, polygonBounds } from './geometry'
import { decomposeOrthogonalLFootprint } from './roofs'
import type { BuildingModel, Polygon2, ProjectV2, Vec2, WallModel } from './types'

export const ZIELONKI_INTERIOR_ID = 'zielonki-reference-interior-v1'
export const hasZielonkiInterior = (project: ProjectV2) => project.buildings.some((b) => b.interiorSource?.id === ZIELONKI_INTERIOR_ID)

/** Classify by actual storey envelope, independently of the names of rooms and walls. */
export const isExteriorWall = (building: BuildingModel, wall: WallModel) => {
  const storey = building.storeys.find((s) => s.wallRefs.includes(wall.ref))
  const slab = building.slabs.find((s) => s.ref === storey?.baseSlabRef)
  if (!slab) return false
  const outline = offsetPolygon(slab.footprint, wall.thicknessM / 2)
  return [wall.start, wall.end, { x: (wall.start.x + wall.end.x) / 2, z: (wall.start.z + wall.end.z) / 2 }]
    .every((p) => pointOnPolygonBoundary(p, outline))
}

/** Transfer the measured floor plan into the existing site, retaining its house placement and finishes. */
export function fitZielonkiInterior(target: ProjectV2, reference: ProjectV2): ProjectV2 {
  const project = structuredClone(target)
  if (hasZielonkiInterior(project)) return project
  const old = project.buildings.find((b) => b.kind === 'house')
  const source = reference.buildings.find((b) => b.kind === 'house')
  if (!old || !source) throw new Error('Both projects must contain a house.')
  const building = structuredClone(source)
  const ground = [...building.storeys].sort((a, b) => a.level - b.level)[0]
  const upper = [...building.storeys].sort((a, b) => b.level - a.level)[0]
  if (ground === upper) throw new Error('The reference house needs both floors.')
  const oldGround = [...old.storeys].sort((a, b) => a.level - b.level)[0]
  const oldBounds = polygonBounds(old.slabs.find((s) => s.ref === oldGround.baseSlabRef)!.footprint)
  const sourceBounds = polygonBounds(building.slabs.find((s) => s.ref === ground.baseSlabRef)!.footprint)
  const dx = (oldBounds.minX + oldBounds.maxX - sourceBounds.minX - sourceBounds.maxX) / 2
  const dz = (oldBounds.minZ + oldBounds.maxZ - sourceBounds.minZ - sourceBounds.maxZ) / 2
  const dy = oldGround.elevationM - ground.elevationM
  // Translation only: never stretch clear room dimensions or furniture to fit the old shell.
  const move = (p: Vec2): Vec2 => ({ x: +(p.x + dx).toFixed(6), z: +(p.z + dz).toFixed(6) })
  building.ref = old.ref; building.name = 'Zielonki · Dom z planów'
  building.architecturalStyle = 'barn'; building.position = old.position; building.rotationDegrees = old.rotationDegrees
  for (const slab of building.slabs) { slab.footprint = slab.footprint.map(move); slab.holes = slab.holes?.map((hole) => hole.map(move)); slab.topElevationM += dy }
  for (const storey of building.storeys) storey.elevationM += dy
  const facade = structuredClone(old.walls.find((w) => w.finish?.material === 'charred-timber')?.finish ?? { material: 'charred-timber' as const, colorHex: '#242927' })
  for (const wall of building.walls) {
    wall.start = move(wall.start); wall.end = move(wall.end); wall.baseElevationM += dy
    if (isExteriorWall(building, wall)) wall.finish = structuredClone(facade)
  }
  for (const item of building.furniture ?? []) item.position = move(item.position)
  for (const stair of building.stairs ?? []) stair.start = move(stair.start)
  for (const platform of building.platforms) { platform.footprint = platform.footprint.map(move); platform.elevationM += dy }
  for (const finish of building.ceilingFinishes) finish.elevationM += dy
  const outline = offsetPolygon(building.slabs.find((s) => s.ref === upper.baseSlabRef)!.footprint, 0.1)
    .map((p) => ({ x: +p.x.toFixed(6), z: +p.z.toFixed(6) }))
  const wings = decomposeOrthogonalLFootprint(outline)
  if (!wings) throw new Error('The upper floor needs an L-shaped outline for the Zielonki roof.')
  const roofRef = building.roof.ref
  const refs: [string, string] = [`${roofRef}/rear-barn`, `${roofRef}/front-barn`]
  const finish = structuredClone(old.roof.finish)
  const overhangM = old.roof.overhangM
  const eaves = upper.elevationM + upper.clearHeightM
  const upperBounds = polygonBounds(outline)
  const groundOutline = offsetPolygon(building.slabs.find((s) => s.ref === ground.baseSlabRef)!.footprint, 0.1)
  const groundBounds = polygonBounds(groundOutline)
  const garageEast = groundOutline.find((p) => Math.abs(p.z - groundBounds.maxZ) < 0.001 && p.x > groundBounds.minX)!.x
  const garageCap: Polygon2 = [{ x: groundBounds.minX, z: upperBounds.maxZ }, { x: garageEast, z: upperBounds.maxZ }, { x: garageEast, z: groundBounds.maxZ }, { x: groundBounds.minX, z: groundBounds.maxZ }]
  building.roof = {
    ref: roofRef, type: 'gable', pitchDegrees: 45, overhangM, baseElevationM: eaves, footprint: outline, finish,
    segments: wings.map((footprint, i) => ({ ref: refs[i], footprint, storeyRef: upper.ref, baseElevationM: eaves, type: 'gable', pitchDegrees: 45, overhangM,
      ridgeDirection: i === 0 ? 'x' : 'z', finish: structuredClone(finish), adjacentSegmentRefs: [refs[1 - i]], gableWallFinishes: { min: structuredClone(facade), max: structuredClone(facade) } })),
    junctions: [{ ref: `${roofRef}/barn-valley`, type: 'valley', segmentRefs: refs }],
  }
  if (groundBounds.maxZ > upperBounds.maxZ + 0.01) building.roof.segments.push({ ref: `${roofRef}/garage-cap`, footprint: garageCap, storeyRef: ground.ref,
    baseElevationM: ground.elevationM + ground.clearHeightM, type: 'flat', pitchDegrees: 0, overhangM: 0.1, ridgeDirection: 'z', finish: { material: 'membrane', colorHex: finish.colorHex }, adjacentSegmentRefs: [] })
  building.interiorSource = { id: ZIELONKI_INTERIOR_ID, notes: [
    'Measured September floor plans fitted to the Zielonki house; all room and furniture dimensions are retained. The original Zielonki site, plants and house position are preserved.',
    'Ground-floor outside dimensions: 11.19 × 18.31 m. Upper floor: 11.28 × 15.14 m. The screenshots differ by 9–10 cm at the east wall; this difference is retained.',
    'Zielonki exterior: dark timber cladding, standing-seam metal gables at 45°, and a lower flat roof over the exposed front of the garage. Roof form is adapted to the plan, not specified in the interior screenshots.',
    'Clear ceiling heights remain provisional at 2.80 m per floor. Door and window sizes without printed dimensions are estimates.',
    ...reference.site.knowledgeBase.caveats.filter((note) => !/roof|plot|site/i.test(note)),
  ] }
  project.buildings = project.buildings.map((b) => b.ref === old.ref ? building : b)
  project.name = 'Zielonki · Dom z planów'
  project.revision += 1; project.updatedAt = new Date().toISOString()
  return project
}
