import { buildingGroundOffset, elevationAt, offsetPolygon, pointOnPolygonBoundary, polygonBounds, polygonCentroid, wallLength } from './geometry'
import { gableEndWall, roofWings } from './roofWings'
import { roomInsideFootprint } from './roomDimensions'
import { decomposeOrthogonalLFootprint } from './roofs'
import type { BuildingModel, ProjectV2, Vec2, WallModel } from './types'

export const ZIELONKI_INTERIOR_ID = 'zielonki-reference-interior-v1'
export const hasZielonkiInterior = (project: ProjectV2) => project.buildings.some((b) => b.interiorSource?.id === ZIELONKI_INTERIOR_ID)

const paperRoofNote = 'Zielonki roof revision 2026-09-09: the main gable ends at the upper-floor wall; a perpendicular gable meets its ridge, and the exposed garage has a separate flat roof at ground-floor ceiling level.'
const ridgeHeightNote = 'Main roof pitches follow MPZP IX/55/2007, §13(6)(4): 37–45 degrees, fitted toward an 8.90 m ground-to-ridge height using the model terrain datum. Room heights are retained. The flat garage roof is a user-requested concept, not confirmed planning permission.'
const glazingNote = 'ICON glazing revision 2026-09-09: the projecting living gable is glazed to the ridge; the former mezzanine floor is a full-height living void. The adjacent kitchen-side gable has half-width glazing aligned with the window below.'

/** Apply the requested glazed gables and living void once, also to saved copies. */
export function upgradeZielonkiGlazing(source: ProjectV2): ProjectV2 {
  const eligible = source.buildings.filter((b) => b.interiorSource?.id === ZIELONKI_INTERIOR_ID && !b.interiorSource.notes.includes(glazingNote))
  if (!eligible.length) return source
  const project = structuredClone(source)
  let changed = false
  for (const building of project.buildings.filter((b) => eligible.some((old) => old.ref === b.ref))) {
    const front = building.roof.segments.find((s) => s.ref.endsWith('/rear-barn') && s.type === 'gable')
    const side = building.roof.segments.find((s) => s.ref.endsWith('/front-barn') && s.type === 'gable')
    const mezzanine = building.spaces.find((s) => s.ref === 'space/reference-mezzanine')
    const upperSlab = building.slabs.find((s) => s.ref === mezzanine?.baseSlabRef)
    if (!front || !side || !mezzanine || !upperSlab) continue
    const voidFootprint = roomInsideFootprint(building, mezzanine)
    upperSlab.holes = [...(upperSlab.holes ?? []), voidFootprint]
    // Retain the exterior shell and the partitions to bedrooms, but close the former door into the void.
    building.walls.forEach((wall) => { wall.openings = wall.openings.filter((o) => o.ref !== 'opening/reference-mezzanine-access') })
    building.spaces = building.spaces.filter((s) => s.ref !== mezzanine.ref)
    building.storeys.forEach((s) => { s.spaceRefs = s.spaceRefs.filter((ref) => ref !== mezzanine.ref) })
    const removedFinishes = new Set(building.ceilingFinishes.filter((f) => f.spaceRef === mezzanine.ref || f.spaceRef === 'space/reference-living').map((f) => f.ref))
    building.ceilingFinishes = building.ceilingFinishes.filter((f) => !removedFinishes.has(f.ref))
    building.storeys.forEach((s) => { s.ceilingFinishRefs = s.ceilingFinishRefs.filter((ref) => !removedFinishes.has(ref)) })

    for (const [segment, end, from, to, groundOpeningRef] of [
      [front, 'max', 0.09, 0.91, 'opening/reference-terrace-east'],
      [side, 'min', 0.09, 0.5, 'opening/reference-terrace-north'],
    ] as const) {
      segment.gableGlazing = { ...segment.gableGlazing, [end]: { from, to, roofInsetM: 0.28 } }
      const bounds = polygonBounds(segment.footprint)
      const across = segment.ridgeDirection === 'z' ? 'x' : 'z'
      const min = across === 'x' ? bounds.minX : bounds.minZ
      const max = across === 'x' ? bounds.maxX : bounds.maxZ
      const center = min + (max - min) * (from + to) / 2
      const widthM = (max - min) * (to - from)
      const endValue = segment.ridgeDirection === 'z' ? (end === 'min' ? bounds.minZ : bounds.maxZ) : (end === 'min' ? bounds.minX : bounds.maxX)
      const upperWall = gableEndWall(building, roofWings(building).find((w) => w.ref === segment.ref)!, segment.ridgeDirection, endValue)
      const groundWall = building.walls.find((w) => w.openings.some((o) => o.ref === groundOpeningRef))
      for (const wall of [groundWall, upperWall]) {
        if (!wall) continue
        const offsetM = Math.abs(center - wall.start[across])
        if (offsetM - widthM / 2 < 0 || offsetM + widthM / 2 > wallLength(wall)) continue
        const ref = wall === groundWall ? groundOpeningRef : `${segment.ref}/glazing-upper`
        wall.openings = wall.openings.filter((o) => o.ref !== ref)
        wall.openings.push({ ref, kind: 'window', wallRef: wall.ref, offsetM, widthM, sillM: 0.08, heightM: wall.heightM - 0.16 })
      }
    }
    building.interiorSource!.notes.push(glazingNote)
    changed = true
  }
  if (!changed) return source
  project.revision += 1; project.updatedAt = new Date().toISOString()
  return project
}

/** Set the initial pitch once, using the same terrain datum as the height tool; later roof edits remain editable. */
function fitRoofPitch(project: ProjectV2, building: BuildingModel) {
  if (!building.interiorSource || building.interiorSource.notes.includes(ridgeHeightNote)) return false
  const segments = building.roof.segments.filter((segment) => segment.type === 'gable')
  if (segments.length !== 2) return false
  const angle = building.rotationDegrees * Math.PI / 180
  const slope = Math.min(...segments.map((segment) => {
    const center = polygonCentroid(segment.footprint)
    const x = building.position.x + center.x * Math.cos(angle) + center.z * Math.sin(angle)
    const z = building.position.z - center.x * Math.sin(angle) + center.z * Math.cos(angle)
    const ridgeElevation = 8.9 + elevationAt(project, x, z) - buildingGroundOffset(building, 0)
    const bounds = polygonBounds(segment.footprint)
    const span = segment.ridgeDirection === 'z' ? bounds.maxX - bounds.minX : bounds.maxZ - bounds.minZ
    return (ridgeElevation - segment.baseElevationM) / (span / 2)
  }))
  if (slope <= 0) throw new Error('The eaves must be below the requested 8.90 m ridge height.')
  const pitch = Math.max(37, Math.min(45, Math.atan(slope) * 180 / Math.PI))
  building.roof.pitchDegrees = pitch
  segments.forEach((segment) => { segment.pitchDegrees = pitch })
  building.interiorSource.notes.push(ridgeHeightNote)
  return true
}

/** Join the two gables over the upper floor and cap only the exposed garage below. */
function fitGarageRoof(building: BuildingModel) {
  const roof = building.roof
  const main = roof.segments.find((s) => s.ref === `${roof.ref}/front-barn`)!
  const side = roof.segments.find((s) => s.ref === `${roof.ref}/rear-barn`)!
  const ground = [...building.storeys].sort((a, b) => a.level - b.level)[0]
  const upper = [...building.storeys].sort((a, b) => b.level - a.level)[0]
  const groundBounds = polygonBounds(building.slabs.find((s) => s.ref === ground.baseSlabRef)!.footprint)
  const upperBounds = polygonBounds(building.slabs.find((s) => s.ref === upper.baseSlabRef)!.footprint)
  const long = polygonBounds(main.footprint); const cross = polygonBounds(side.footprint)
  // Slab edges extend 0.10 m past the wall centreline used by roof footprints.
  const endZ = upperBounds.maxZ - 0.1
  main.footprint = [{ x: long.minX, z: cross.minZ }, { x: long.maxX, z: cross.minZ }, { x: long.maxX, z: endZ }, { x: long.minX, z: endZ }]
  // Meet at the main ridge. The overlapping slopes form the two valley lines.
  const ridgeX = (long.minX + long.maxX) / 2
  side.footprint = [{ x: ridgeX, z: cross.minZ }, { x: cross.maxX, z: cross.minZ }, { x: cross.maxX, z: cross.maxZ }, { x: ridgeX, z: cross.maxZ }]
  const previousCap = roof.segments.find((s) => s.ref === `${roof.ref}/garage-cap`)
  roof.segments = roof.segments.filter((s) => s.ref !== `${roof.ref}/garage-cap`)
  roof.segments.push({
    ref: `${roof.ref}/garage-cap`, storeyRef: ground.ref,
    footprint: [{ x: long.minX, z: endZ }, { x: long.maxX, z: endZ }, { x: long.maxX, z: groundBounds.maxZ - 0.1 }, { x: long.minX, z: groundBounds.maxZ - 0.1 }],
    baseElevationM: ground.elevationM + ground.clearHeightM, type: 'flat', pitchDegrees: 0, overhangM: 0.1,
    ridgeDirection: 'z', finish: previousCap?.finish ?? { material: 'membrane', colorHex: '#777269' }, adjacentSegmentRefs: [],
  })
  roof.footprint = [{ x: long.minX, z: cross.minZ }, { x: cross.maxX, z: cross.minZ }, { x: cross.maxX, z: cross.maxZ }, { x: long.maxX, z: cross.maxZ }, { x: long.maxX, z: endZ }, { x: long.minX, z: endZ }]
}

/** Correct the former continuous garage gable once; subsequent roof edits remain untouched. */
export function upgradeZielonkiRoof(source: ProjectV2): ProjectV2 {
  const legacy = source.buildings.filter((b) => b.interiorSource?.id === ZIELONKI_INTERIOR_ID
    && !b.interiorSource.notes.includes(paperRoofNote)
    && (b.roof.segments.length === 2 || (b.roof.segments.length === 3 && b.roof.segments.some((s) => s.ref === `${b.roof.ref}/garage-cap` && s.type === 'flat')))
    && ['front-barn', 'rear-barn'].every((name) => b.roof.segments.some((s) => s.ref === `${b.roof.ref}/${name}` && s.type === 'gable')))
  if (!legacy.length) return source
  const project = structuredClone(source)
  for (const building of project.buildings.filter((b) => legacy.some((old) => old.ref === b.ref))) {
    fitGarageRoof(building)
    building.interiorSource!.notes = building.interiorSource!.notes.filter((note) => !/^(Zielonki exterior:|Roof follows the September 2026 paper reference:|Initial roof pitch adjusted)/.test(note))
    building.interiorSource!.notes.push(paperRoofNote)
    fitRoofPitch(project, building)
  }
  project.revision += 1; project.updatedAt = new Date().toISOString()
  return project
}

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
  if (hasZielonkiInterior(project)) return upgradeZielonkiGlazing(upgradeZielonkiRoof(project))
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
  building.roof = {
    ref: roofRef, type: 'gable', pitchDegrees: 45, overhangM, baseElevationM: eaves, footprint: outline, finish,
    segments: wings.map((footprint, i) => ({ ref: refs[i], footprint, storeyRef: upper.ref, baseElevationM: eaves, type: 'gable', pitchDegrees: 45, overhangM,
      ridgeDirection: i === 0 ? 'x' : 'z', finish: structuredClone(finish), adjacentSegmentRefs: [refs[1 - i]], gableWallFinishes: { min: structuredClone(facade), max: structuredClone(facade) } })),
    junctions: [{ ref: `${roofRef}/barn-valley`, type: 'valley', segmentRefs: refs }],
  }
  fitGarageRoof(building)
  building.interiorSource = { id: ZIELONKI_INTERIOR_ID, notes: [
    'Measured September floor plans fitted to the Zielonki house; all room and furniture dimensions are retained. The original Zielonki site, plants and house position are preserved.',
    'Ground-floor outside dimensions: 11.19 × 18.31 m. Upper floor: 11.28 × 15.14 m. The screenshots differ by 9–10 cm at the east wall; this difference is retained.',
    paperRoofNote,
    'Clear ceiling heights remain provisional at 2.80 m per floor. Door and window sizes without printed dimensions are estimates.',
    ...reference.site.knowledgeBase.caveats.filter((note) => !/roof|plot|site/i.test(note)),
  ] }
  project.buildings = project.buildings.map((b) => b.ref === old.ref ? building : b)
  fitRoofPitch(project, building)
  project.name = 'Zielonki · Dom z planów'
  project.revision += 1; project.updatedAt = new Date().toISOString()
  return upgradeZielonkiGlazing(project)
}
