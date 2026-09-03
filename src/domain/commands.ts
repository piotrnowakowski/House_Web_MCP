import { estimateDayPartTemperatures } from './climate'
import { gardenFixtureById } from './gardenFixtures'
import { buildingFootprintsWorld, mergeAdjacentPolygons, pointInPolygon, pointOnSegment, polygonArea, polygonSelfIntersects, rectangle, spaceFootprint, splitPolygonEdges, wallLength } from './geometry'
import { sunMismatchIssues } from './sunlight'
import type { BuildingModel, LandscapeZone, OpeningModel, Polygon2, ProjectCommand, ProjectIssue, ProjectMetrics, ProjectV2, SpaceBoundaryUse, StoreyModel, Vec2, WallModel } from './types'

export { polygonArea } from './geometry'
const clone = <T>(value: T): T => structuredClone(value)
const styleRoof: Record<BuildingModel['architecturalStyle'], Pick<BuildingModel['roof'], 'type' | 'pitchDegrees' | 'overhangM'>> = {
  classic: { type: 'gable', pitchDegrees: 32, overhangM: 0.55 },
  futuristic: { type: 'flat', pitchDegrees: 0, overhangM: 0.8 },
  barn: { type: 'gable', pitchDegrees: 45, overhangM: 0.3 },
}
const samePoint = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.z - b.z) < 0.001
const getBuilding = (project: ProjectV2, ref: string) => { const value = project.buildings.find((item) => item.ref === ref); if (!value) throw new Error(`Building not found: ${ref}`); return value }
const getStorey = (building: BuildingModel, ref: string) => { const value = building.storeys.find((item) => item.ref === ref); if (!value) throw new Error(`Storey not found: ${ref}`); return value }
const getWall = (building: BuildingModel, ref: string) => { const value = building.walls.find((item) => item.ref === ref); if (!value) throw new Error(`Wall not found: ${ref}`); return value }

const findReusableWall = (building: BuildingModel, start: Vec2, end: Vec2, baseElevationM: number) => {
  const exact = building.walls.find((wall) => Math.abs(wall.baseElevationM - baseElevationM) < 0.001
    && ((samePoint(wall.start, start) && samePoint(wall.end, end)) || (samePoint(wall.start, end) && samePoint(wall.end, start))))
  if (exact) return exact
  const contained = building.walls.filter((wall) => Math.abs(wall.baseElevationM - baseElevationM) < 0.001
    && pointOnSegment(wall.start, start, end) && pointOnSegment(wall.end, start, end)).sort((a, b) => wallLength(b) - wallLength(a))[0]
  if (!contained) return undefined
  const oldStart = clone(contained.start); const oldEnd = clone(contained.end); const oldLength = wallLength(contained)
  const length = Math.hypot(end.x - start.x, end.z - start.z); const ux = (end.x - start.x) / length; const uz = (end.z - start.z) / length
  contained.openings.forEach((opening) => {
    const oldUx = (oldEnd.x - oldStart.x) / oldLength; const oldUz = (oldEnd.z - oldStart.z) / oldLength
    const center = { x: oldStart.x + oldUx * opening.offsetM, z: oldStart.z + oldUz * opening.offsetM }
    opening.offsetM = (center.x - start.x) * ux + (center.z - start.z) * uz
  })
  contained.start = clone(start); contained.end = clone(end)
  return contained
}

const buildBoundary = (building: BuildingModel, storey: StoreyModel, spaceRef: string, footprint: Polygon2): SpaceBoundaryUse[] => footprint.map((start, index) => {
  const end = footprint[(index + 1) % footprint.length]
  const existing = findReusableWall(building, start, end, storey.elevationM)
  if (existing) {
    if (!storey.wallRefs.includes(existing.ref)) storey.wallRefs.push(existing.ref)
    return { wallRef: existing.ref, direction: samePoint(existing.start, start) ? 1 : -1 }
  }
  const ref = `${spaceRef}/wall-${index + 1}`
  const wall: WallModel = { ref, start: clone(start), end: clone(end), thicknessM: 0.22, baseElevationM: storey.elevationM, heightM: storey.clearHeightM, openings: [], finish: { material: 'light-render', colorHex: '#E8E1D2' }, locked: false }
  building.walls.push(wall)
  storey.wallRefs.push(ref)
  return { wallRef: ref, direction: 1 }
})

const defaultBuilding = (ref: string, name: string, kind: BuildingModel['kind'], position: Vec2): BuildingModel => {
  const footprint = rectangle({ x: 0, z: 0 }, kind === 'garage' ? 6 : 8, kind === 'garage' ? 6.5 : 8)
  const slabRef = `${ref}/slab-ground`
  const roofRef = `${ref}/roof`
  const storey: StoreyModel = { ref: `${ref}/storey-ground`, name: 'Ground storey', level: 0, elevationM: 0.4, clearHeightM: 2.8, baseSlabRef: slabRef, topBoundaryRef: roofRef, wallRefs: [], spaceRefs: [`${ref}/space-main`], platformRefs: [], ceilingFinishRefs: [] }
  const building: BuildingModel = {
    ref, name, kind, architecturalStyle: 'classic', position, rotationDegrees: 0, storeys: [storey],
    slabs: [{ ref: slabRef, footprint, topElevationM: 0.4, thicknessM: 0.3, locked: false }], walls: [], spaces: [], platforms: [], ceilingFinishes: [],
    roof: { ref: roofRef, type: kind === 'garage' ? 'flat' : 'gable', baseElevationM: 3.2, pitchDegrees: kind === 'garage' ? 0 : 28, overhangM: 0.4 },
  }
  building.spaces.push({ ref: storey.spaceRefs[0], name: kind === 'garage' ? 'Parking' : 'Main space', usage: kind === 'garage' ? 'garage' : 'living', boundary: buildBoundary(building, storey, storey.spaceRefs[0], footprint), baseSlabRef: slabRef, topBoundaryRef: roofRef, locked: false })
  return building
}

const applySite = (project: ProjectV2, command: Extract<ProjectCommand, { type: 'site.update' }>) => {
  if (command.boundary) { project.site.boundary = clone(command.boundary); project.site.terrain.boundary = clone(command.boundary) }
  if (command.northDegrees !== undefined) project.site.northDegrees = command.northDegrees
}

const applyBuilding = (project: ProjectV2, command: Extract<ProjectCommand, { type: 'building.update' }>) => {
  if (command.action === 'add') {
    if (project.buildings.some((item) => item.ref === command.buildingRef)) throw new Error(`Reference already exists: ${command.buildingRef}`)
    project.buildings.push(defaultBuilding(command.buildingRef, command.name ?? 'New building', command.kind ?? 'house', command.position ?? { x: 0, z: 0 }))
    return
  }
  if (command.action === 'remove') { project.buildings = project.buildings.filter((item) => item.ref !== command.buildingRef); return }
  const building = getBuilding(project, command.buildingRef)
  if (command.position) building.position = clone(command.position)
  if (command.rotationDegrees !== undefined) building.rotationDegrees = command.rotationDegrees
  if (command.architecturalStyle) {
    building.architecturalStyle = command.architecturalStyle
    Object.assign(building.roof, styleRoof[command.architecturalStyle])
  }
}

const applyStorey = (project: ProjectV2, command: Extract<ProjectCommand, { type: 'storey.update' }>) => {
  const building = getBuilding(project, command.buildingRef)
  if (command.action === 'add') {
    if (building.storeys.some((item) => item.ref === command.storeyRef)) throw new Error(`Reference already exists: ${command.storeyRef}`)
    const previous = [...building.storeys].sort((a, b) => b.level - a.level)[0]
    const previousSlab = building.slabs.find((item) => item.ref === previous.baseSlabRef)!
    const footprint = clone(command.footprint ?? previousSlab.footprint)
    const slabRef = `${command.storeyRef}/base-slab`
    const elevationM = previous.elevationM + previous.clearHeightM
    building.slabs.push({ ref: slabRef, footprint, topElevationM: elevationM, thicknessM: 0.26, locked: false })
    previous.topBoundaryRef = slabRef
    building.spaces.filter((space) => previous.spaceRefs.includes(space.ref)).forEach((space) => { space.topBoundaryRef = slabRef })
    const storey: StoreyModel = { ref: command.storeyRef, name: command.name ?? `Storey ${previous.level + 1}`, level: previous.level + 1, elevationM, clearHeightM: command.clearHeightM ?? 2.9, baseSlabRef: slabRef, topBoundaryRef: building.roof.ref, wallRefs: [], spaceRefs: [`${command.storeyRef}/space-main`], platformRefs: [], ceilingFinishRefs: [] }
    building.storeys.push(storey)
    const spaceRef = storey.spaceRefs[0]
    building.spaces.push({ ref: spaceRef, name: 'Upper space', usage: 'flex', boundary: buildBoundary(building, storey, spaceRef, footprint), baseSlabRef: slabRef, topBoundaryRef: building.roof.ref, locked: false })
    building.roof.baseElevationM = elevationM + storey.clearHeightM
    return
  }
  const storey = getStorey(building, command.storeyRef)
  if (command.action === 'extend-footprint') {
    const slab = building.slabs.find((item) => item.ref === storey.baseSlabRef)
    if (!slab) throw new Error(`Base slab not found: ${storey.baseSlabRef}`)
    if (slab.locked) throw new Error(`Slab is locked: ${slab.ref}`)
    if (!command.footprint && !command.extensionFootprint) throw new Error('A complete footprint or extensionFootprint is required.')
    const completeFootprint = clone(command.footprint ?? mergeAdjacentPolygons(slab.footprint, command.extensionFootprint!))
    if (command.extensionFootprint && command.footprint) {
      const expectedArea = polygonArea(slab.footprint) + polygonArea(command.extensionFootprint)
      if (Math.abs(polygonArea(completeFootprint) - expectedArea) > 0.02) throw new Error('Complete footprint area must equal the existing storey plus the non-overlapping extension.')
    }
    if (polygonArea(completeFootprint) <= polygonArea(slab.footprint) + 0.01) throw new Error('The new storey footprint must increase modeled floor area.')
    if (command.extensionFootprint) {
      const spaceRef = command.spaceRef ?? `${storey.ref}/space-extension`
      if (building.spaces.some((space) => space.ref === spaceRef)) throw new Error(`Reference already exists: ${spaceRef}`)
      const extensionFootprint = splitPolygonEdges(command.extensionFootprint, slab.footprint)
      building.spaces.push({ ref: spaceRef, name: command.spaceName ?? 'Storey extension', usage: command.usage ?? 'flex', boundary: buildBoundary(building, storey, spaceRef, extensionFootprint), baseSlabRef: slab.ref, topBoundaryRef: storey.topBoundaryRef, locked: false })
      storey.spaceRefs.push(spaceRef)
    } else {
      const primarySpace = building.spaces.find((space) => storey.spaceRefs.includes(space.ref) && !space.locked)
      const spaceRef = primarySpace?.ref ?? command.spaceRef ?? `${storey.ref}/space-main`
      if (primarySpace) primarySpace.boundary = buildBoundary(building, storey, primarySpace.ref, completeFootprint)
      else {
        building.spaces.push({ ref: spaceRef, name: command.spaceName ?? 'Extended storey', usage: command.usage ?? 'flex', boundary: buildBoundary(building, storey, spaceRef, completeFootprint), baseSlabRef: slab.ref, topBoundaryRef: storey.topBoundaryRef, locked: false })
        storey.spaceRefs.push(spaceRef)
      }
    }
    slab.footprint = completeFootprint
    if (storey.level === Math.max(...building.storeys.map((item) => item.level))) building.roof.footprint = clone(completeFootprint)
    const usedWallRefs = new Set(building.spaces.filter((space) => storey.spaceRefs.includes(space.ref)).flatMap((space) => space.boundary.map((use) => use.wallRef)))
    const obsoleteWallRefs = new Set(storey.wallRefs.filter((ref) => !usedWallRefs.has(ref)))
    storey.wallRefs = [...usedWallRefs]
    const otherStoreyWallRefs = new Set(building.storeys.filter((item) => item.ref !== storey.ref).flatMap((item) => item.wallRefs))
    building.walls = building.walls.filter((wall) => !obsoleteWallRefs.has(wall.ref) || otherStoreyWallRefs.has(wall.ref))
    return
  }
  if (command.action === 'remove') {
    const highest = Math.max(...building.storeys.map((item) => item.level))
    if (storey.level !== highest || building.storeys.length === 1) throw new Error('Only the highest non-ground storey can be removed.')
    const lower = building.storeys.find((item) => item.level === storey.level - 1)!
    lower.topBoundaryRef = building.roof.ref
    building.spaces.filter((space) => lower.spaceRefs.includes(space.ref)).forEach((space) => { space.topBoundaryRef = building.roof.ref })
    building.storeys = building.storeys.filter((item) => item.ref !== storey.ref)
    building.spaces = building.spaces.filter((item) => !storey.spaceRefs.includes(item.ref))
    building.walls = building.walls.filter((item) => !storey.wallRefs.includes(item.ref))
    building.slabs = building.slabs.filter((item) => item.ref !== storey.baseSlabRef)
    building.roof.baseElevationM = lower.elevationM + lower.clearHeightM
    return
  }
  if (command.clearHeightM !== undefined) {
    const delta = command.clearHeightM - storey.clearHeightM
    storey.clearHeightM = command.clearHeightM
    building.walls.filter((wall) => storey.wallRefs.includes(wall.ref)).forEach((wall) => { wall.heightM = command.clearHeightM! })
    building.storeys.filter((item) => item.level > storey.level).forEach((item) => { item.elevationM += delta })
    building.slabs.filter((slab) => slab.topElevationM > storey.elevationM).forEach((slab) => { slab.topElevationM += delta })
    building.walls.filter((wall) => wall.baseElevationM > storey.elevationM).forEach((wall) => { wall.baseElevationM += delta })
    building.roof.baseElevationM += delta
  }
}

const applySpace = (project: ProjectV2, command: Extract<ProjectCommand, { type: 'space.update' }>) => {
  const building = getBuilding(project, command.buildingRef)
  const storey = getStorey(building, command.storeyRef)
  const index = building.spaces.findIndex((item) => item.ref === command.spaceRef)
  if (command.action === 'add') {
    if (index >= 0 || !command.footprint) throw new Error(index >= 0 ? `Reference already exists: ${command.spaceRef}` : 'A polygon footprint is required.')
    building.spaces.push({ ref: command.spaceRef, name: command.name ?? 'New space', usage: command.usage ?? 'flex', boundary: buildBoundary(building, storey, command.spaceRef, command.footprint), baseSlabRef: storey.baseSlabRef, topBoundaryRef: storey.topBoundaryRef, locked: false })
    storey.spaceRefs.push(command.spaceRef)
    return
  }
  if (index < 0) throw new Error(`Space not found: ${command.spaceRef}`)
  const space = building.spaces[index]
  if (space.locked) throw new Error(`${space.name} is locked.`)
  if (command.action === 'remove') { building.spaces.splice(index, 1); storey.spaceRefs = storey.spaceRefs.filter((ref) => ref !== space.ref); return }
  if (command.action === 'set-footprint' && command.footprint) space.boundary = buildBoundary(building, storey, space.ref, command.footprint)
  if (command.action === 'set-usage' && command.usage) space.usage = command.usage
  if (command.action === 'set-lowered-ceiling') {
    const ref = `${space.ref}/ceiling-finish`
    const existing = building.ceilingFinishes.find((item) => item.ref === ref)
    const elevationM = command.ceilingElevationM ?? storey.elevationM + storey.clearHeightM - 0.25
    if (existing) existing.elevationM = elevationM
    else { building.ceilingFinishes.push({ ref, spaceRef: space.ref, hostBoundaryRef: space.topBoundaryRef, elevationM, thicknessM: 0.08 }); storey.ceilingFinishRefs.push(ref) }
  }
}

const applyCommandMutable = (project: ProjectV2, command: ProjectCommand) => {
  if (command.type === 'site.update') applySite(project, command)
  else if (command.type === 'terrain.update') project.site.terrain.elevationPoints = clone(command.elevationPoints)
  else if (command.type === 'building.update') applyBuilding(project, command)
  else if (command.type === 'storey.update') applyStorey(project, command)
  else if (command.type === 'space.update') applySpace(project, command)
  else if (command.type === 'slab.update') {
    const building = getBuilding(project, command.buildingRef)
    const slab = building.slabs.find((item) => item.ref === command.slabRef)
    if (!slab) throw new Error(`Slab not found: ${command.slabRef}`)
    if (command.footprint) slab.footprint = clone(command.footprint)
    if (command.thicknessM !== undefined) slab.thicknessM = command.thicknessM
    if (command.topElevationM !== undefined) {
      const previousTop = slab.topElevationM; const delta = command.topElevationM - previousTop
      const hostedStorey = building.storeys.find((storey) => storey.baseSlabRef === slab.ref)
      const lowerStorey = building.storeys.find((storey) => storey.topBoundaryRef === slab.ref)
      slab.topElevationM = command.topElevationM
      if (lowerStorey) lowerStorey.clearHeightM = command.topElevationM - lowerStorey.elevationM
      if (hostedStorey && Math.abs(delta) > 0.0001) {
        const affected = building.storeys.filter((storey) => storey.level >= hostedStorey.level)
        affected.forEach((storey) => { storey.elevationM += delta })
        const wallRefs = new Set(affected.flatMap((storey) => storey.wallRefs)); building.walls.filter((wall) => wallRefs.has(wall.ref)).forEach((wall) => { wall.baseElevationM += delta })
        building.slabs.filter((candidate) => candidate.ref !== slab.ref && candidate.topElevationM > previousTop).forEach((candidate) => { candidate.topElevationM += delta })
        const spaceRefs = new Set(affected.flatMap((storey) => storey.spaceRefs)); building.platforms.filter((platform) => spaceRefs.has(platform.spaceRef)).forEach((platform) => { platform.elevationM += delta })
        building.ceilingFinishes.filter((finish) => spaceRefs.has(finish.spaceRef)).forEach((finish) => { finish.elevationM += delta })
        building.roof.baseElevationM += delta
      }
    }
  } else if (command.type === 'wall.update') {
    const wall = getWall(getBuilding(project, command.buildingRef), command.wallRef)
    if (wall.locked) throw new Error(`Wall is locked: ${wall.ref}`)
    if (command.start) wall.start = clone(command.start); if (command.end) wall.end = clone(command.end)
    if (command.thicknessM !== undefined) wall.thicknessM = command.thicknessM
    if (command.heightM !== undefined) wall.heightM = command.heightM
  } else if (command.type === 'wall.finish') {
    const wall = getWall(getBuilding(project, command.buildingRef), command.wallRef)
    if (wall.locked) throw new Error(`Wall is locked: ${wall.ref}`)
    if (!/^#[0-9a-fA-F]{6}$/.test(command.colorHex)) throw new Error('Wall color must be a six-digit hex value such as #242927.')
    wall.finish = { material: command.material, colorHex: command.colorHex.toUpperCase() }
  } else if (command.type === 'opening.update') {
    const wall = getWall(getBuilding(project, command.buildingRef), command.wallRef)
    const index = wall.openings.findIndex((item) => item.ref === command.openingRef)
    if (command.action === 'add') {
      if (index >= 0) throw new Error(`Reference already exists: ${command.openingRef}`)
      wall.openings.push({ ref: command.openingRef, kind: command.kind ?? 'window', wallRef: wall.ref, offsetM: command.offsetM ?? wallLength(wall) / 2, widthM: command.widthM ?? 1.2, heightM: command.heightM ?? 1.2, sillM: command.sillM ?? 0.9 })
    } else if (command.action === 'remove') wall.openings = wall.openings.filter((item) => item.ref !== command.openingRef)
    else {
      if (index < 0) throw new Error(`Opening not found: ${command.openingRef}`)
      const opening = wall.openings[index]
      if (command.offsetM !== undefined) opening.offsetM = command.offsetM; if (command.widthM !== undefined) opening.widthM = command.widthM
      if (command.heightM !== undefined) opening.heightM = command.heightM; if (command.sillM !== undefined) opening.sillM = command.sillM
    }
  } else if (command.type === 'roof.update') {
    const roof = getBuilding(project, command.buildingRef).roof
    if (command.roofType) roof.type = command.roofType; if (command.pitchDegrees !== undefined) roof.pitchDegrees = command.pitchDegrees; if (command.overhangM !== undefined) roof.overhangM = command.overhangM
  } else if (command.type === 'platform.update') {
    const building = getBuilding(project, command.buildingRef); const storey = getStorey(building, command.storeyRef)
    if (command.action === 'add') { if (!command.footprint) throw new Error('Platform footprint is required.'); building.platforms.push({ ref: command.platformRef, spaceRef: command.spaceRef, footprint: clone(command.footprint), elevationM: command.elevationM ?? storey.elevationM + 2.2, thicknessM: command.thicknessM ?? 0.18 }); storey.platformRefs.push(command.platformRef) }
    else if (command.action === 'remove') { building.platforms = building.platforms.filter((item) => item.ref !== command.platformRef); storey.platformRefs = storey.platformRefs.filter((ref) => ref !== command.platformRef) }
    else { const platform = building.platforms.find((item) => item.ref === command.platformRef); if (!platform) throw new Error(`Platform not found: ${command.platformRef}`); if (command.footprint) platform.footprint = clone(command.footprint); if (command.elevationM !== undefined) platform.elevationM = command.elevationM }
  } else if (command.type === 'landscape.update') {
    const index = project.landscape.zones.findIndex((item) => item.ref === command.zoneRef)
    if (command.action === 'add') { if (!command.footprint) throw new Error('Landscape polygon is required.'); project.landscape.zones.push({ ref: command.zoneRef, name: command.name ?? 'Landscape zone', kind: command.kind ?? 'lawn', footprint: clone(command.footprint), locked: false }) }
    else if (command.action === 'remove') project.landscape.zones = project.landscape.zones.filter((item) => item.ref !== command.zoneRef)
    else { if (index < 0) throw new Error(`Landscape zone not found: ${command.zoneRef}`); const zone = project.landscape.zones[index]; if (zone.locked) throw new Error(`${zone.name} is locked.`); if (command.footprint) zone.footprint = clone(command.footprint); if (command.delta) zone.footprint = zone.footprint.map((point) => ({ x: point.x + command.delta!.x, z: point.z + command.delta!.z })) }
  } else if (command.type === 'plant.update') {
    const index = project.landscape.plants.findIndex((item) => item.ref === command.plantRef)
    if (command.action === 'add') { if (!command.position) throw new Error('Plant position is required.'); project.landscape.plants.push({ ref: command.plantRef, name: command.name ?? 'Plant', species: command.species ?? 'Unspecified', kind: command.kind ?? 'shrub', position: clone(command.position), matureHeightM: 1.5, canopyM: 1.2, sunNeed: 'sun', waterNeed: 0.7, hardinessMinC: -20, leafMonths: [4,5,6,7,8,9,10], bloomMonths: [], locked: false }) }
    else if (command.action === 'remove') project.landscape.plants = project.landscape.plants.filter((item) => item.ref !== command.plantRef)
    else { if (index < 0 || !command.position) throw new Error(index < 0 ? `Plant not found: ${command.plantRef}` : 'Plant position is required.'); if (project.landscape.plants[index].locked) throw new Error(`${project.landscape.plants[index].name} is locked.`); project.landscape.plants[index].position = clone(command.position) }
  } else if (command.type === 'planting-area.update') {
    const existingRefs = new Set(project.landscape.plants.map((plant) => plant.ref))
    const duplicate = command.plants.find((plant, index) => existingRefs.has(plant.ref) || command.plants.findIndex((candidate) => candidate.ref === plant.ref) !== index)
    if (duplicate) throw new Error(`Reference already exists: ${duplicate.ref}`)
    project.landscape.plants.push(...clone(command.plants))
  } else if (command.type === 'garden-fixture.update') {
    const index = project.landscape.fixtures.findIndex((item) => item.ref === command.fixtureRef)
    if (command.action === 'add') {
      if (index >= 0) throw new Error(`Reference already exists: ${command.fixtureRef}`)
      if (!command.catalogId || !command.position) throw new Error('Fixture catalogId and position are required.')
      const definition = gardenFixtureById(command.catalogId)
      project.landscape.fixtures.push({ ref: command.fixtureRef, catalogId: command.catalogId, name: command.name ?? definition.name, position: clone(command.position), rotationDegrees: command.rotationDegrees ?? 0, locked: false })
    } else {
      if (index < 0) throw new Error(`Garden fixture not found: ${command.fixtureRef}`)
      const fixture = project.landscape.fixtures[index]
      if (fixture.locked) throw new Error(`${fixture.name} is locked.`)
      if (command.action === 'remove') project.landscape.fixtures.splice(index, 1)
      else if (command.action === 'move') { if (!command.position) throw new Error('Fixture position is required.'); fixture.position = clone(command.position) }
      else { if (command.rotationDegrees === undefined) throw new Error('Fixture rotation is required.'); fixture.rotationDegrees = command.rotationDegrees }
    }
  } else if (command.type === 'climate.update') {
    const month = project.climateProfile.months.find((item) => item.month === command.month); if (!month) throw new Error(`Month not found: ${command.month}`); Object.assign(month, command.values)
    if (!command.values.temperatureByDayPartC && (command.values.meanMinC !== undefined || command.values.meanMaxC !== undefined)) month.temperatureByDayPartC = estimateDayPartTemperatures(month.meanMinC, month.meanMaxC)
  }
}

export const applyCommand = (source: ProjectV2, command: ProjectCommand): ProjectV2 => {
  const project = clone(source); applyCommandMutable(project, command); project.updatedAt = new Date().toISOString(); return project
}
export const applyCommands = (source: ProjectV2, commands: ProjectCommand[]) => commands.reduce(applyCommand, source)

const allRefs = (building: BuildingModel) => [building.ref, building.roof.ref, ...building.storeys.map((item) => item.ref), ...building.slabs.map((item) => item.ref), ...building.walls.map((item) => item.ref), ...building.spaces.map((item) => item.ref), ...building.platforms.map((item) => item.ref), ...building.ceilingFinishes.map((item) => item.ref), ...building.walls.flatMap((wall) => wall.openings.map((item) => item.ref))]

export const validateProject = (project: ProjectV2): ProjectIssue[] => {
  const issues: ProjectIssue[] = []
  const constructionParcels = project.site.parcels.filter((parcel) => parcel.landRole === 'construction')
  if (polygonSelfIntersects(project.site.boundary)) issues.push({ severity: 'error', code: 'site.self-intersection', message: 'Site boundary self-intersects.', subjectRef: 'site' })
  project.buildings.forEach((building) => {
    const refs = allRefs(building); const duplicates = refs.filter((ref, index) => refs.indexOf(ref) !== index)
    if (duplicates.length) issues.push({ severity: 'error', code: 'ref.duplicate', message: `Duplicate reference: ${duplicates[0]}`, subjectRef: duplicates[0] })
    building.storeys.forEach((storey) => {
      const base = building.slabs.find((slab) => slab.ref === storey.baseSlabRef)
      if (!base) issues.push({ severity: 'error', code: 'storey.base-slab', message: `${storey.name} has no base slab.`, subjectRef: storey.ref })
      storey.wallRefs.forEach((ref) => { if (!building.walls.some((wall) => wall.ref === ref)) issues.push({ severity: 'error', code: 'storey.wall', message: `${storey.name} references a missing wall.`, subjectRef: ref }) })
      storey.spaceRefs.forEach((ref) => { if (!building.spaces.some((space) => space.ref === ref)) issues.push({ severity: 'error', code: 'storey.space', message: `${storey.name} references a missing space.`, subjectRef: ref }) })
      const upper = building.storeys.find((item) => item.level === storey.level + 1)
      if (upper && storey.topBoundaryRef !== upper.baseSlabRef) issues.push({ severity: 'error', code: 'slab.shared-boundary', message: `${storey.name} ceiling must be the upper storey floor slab.`, subjectRef: storey.ref })
    })
    building.spaces.forEach((space) => {
      try { const footprint = spaceFootprint(building, space); if (polygonArea(footprint) < 1 || polygonSelfIntersects(footprint)) issues.push({ severity: 'error', code: 'space.polygon', message: `${space.name} has an invalid polygon.`, subjectRef: space.ref }) }
      catch (error) { issues.push({ severity: 'error', code: 'space.wall', message: error instanceof Error ? error.message : 'Space boundary is invalid.', subjectRef: space.ref }) }
    })
    building.walls.forEach((wall) => wall.openings.forEach((opening: OpeningModel) => {
      if (opening.offsetM - opening.widthM / 2 < 0 || opening.offsetM + opening.widthM / 2 > wallLength(wall)) issues.push({ severity: 'error', code: 'opening.bounds', message: `${opening.ref} exceeds its host wall.`, subjectRef: opening.ref })
      if (opening.sillM + opening.heightM > wall.heightM) issues.push({ severity: 'error', code: 'opening.height', message: `${opening.ref} exceeds wall height.`, subjectRef: opening.ref })
    }))
    if (!buildingFootprintsWorld(building).flat().every((point) => constructionParcels.some((parcel) => pointInPolygon(point, parcel.boundary)))) issues.push({ severity: 'error', code: 'building.site', message: `${building.name} is outside the construction parcels.`, subjectRef: building.ref })
  })
  project.landscape.zones.forEach((zone: LandscapeZone) => {
    if (polygonArea(zone.footprint) < 0.01 || polygonSelfIntersects(zone.footprint)) issues.push({ severity: 'error', code: 'landscape.polygon', message: `${zone.name} has an invalid polygon.`, subjectRef: zone.ref })
    if (!zone.footprint.every((point) => pointInPolygon(point, project.site.boundary))) issues.push({ severity: 'error', code: 'landscape.site', message: `${zone.name} extends outside the site.`, subjectRef: zone.ref })
  })
  const hostRefs = new Set(['site/terrain', ...project.landscape.zones.map((zone) => zone.ref), ...project.buildings.flatMap((building) => [building.roof.ref, ...building.slabs.map((slab) => slab.ref), ...building.walls.map((wall) => wall.ref), ...building.platforms.map((platform) => platform.ref)])])
  project.landscape.plants.forEach((plant) => {
    if (!pointInPolygon(plant.position, project.site.boundary)) issues.push({ severity: 'error', code: 'plant.site', message: `${plant.name} is outside the site.`, subjectRef: plant.ref })
    if (plant.attachment && !hostRefs.has(plant.attachment.hostRef)) issues.push({ severity: 'error', code: 'plant.support', message: `${plant.name} has an unknown support surface.`, subjectRef: plant.ref })
  })
  project.landscape.fixtures.forEach((fixture) => {
    const definition = gardenFixtureById(fixture.catalogId); const radians = fixture.rotationDegrees * Math.PI / 180; const c = Math.cos(radians); const s = Math.sin(radians)
    const corners = [[-definition.widthM / 2, -definition.depthM / 2], [definition.widthM / 2, -definition.depthM / 2], [definition.widthM / 2, definition.depthM / 2], [-definition.widthM / 2, definition.depthM / 2]]
      .map(([x, z]) => ({ x: fixture.position.x + x * c + z * s, z: fixture.position.z - x * s + z * c }))
    if (!corners.every((corner) => project.site.parcels.some((parcel) => pointInPolygon(corner, parcel.boundary)))) issues.push({ severity: 'error', code: 'fixture.site', message: `${fixture.name} extends outside the owned parcels.`, subjectRef: fixture.ref })
  })
  const raisedBeds = project.landscape.fixtures.filter((fixture) => fixture.catalogId === 'raised-bed-2x1')
  project.landscape.fixtures.filter((fixture) => fixture.catalogId !== 'raised-bed-2x1').forEach((fixture) => {
    if (!raisedBeds.some((bed) => Math.hypot(bed.position.x - fixture.position.x, bed.position.z - fixture.position.z) < 0.15)) issues.push({ severity: 'error', code: 'fixture.crop-host', message: `${fixture.name} must remain colocated with a raised bed.`, subjectRef: fixture.ref })
  })
  issues.push(...sunMismatchIssues(project))
  if (project.site.knowledgeBase.geotechnical.documentationNeed) issues.push({ severity: 'warning', code: 'site.geotechnical-review', message: project.site.knowledgeBase.geotechnical.documentationNeed, subjectRef: 'site' })
  return issues
}

export const calculateMetrics = (project: ProjectV2): ProjectMetrics => {
  const homeAreaM2 = project.buildings.filter((building) => building.kind === 'house').reduce((sum, building) => sum + building.storeys.reduce((area, storey) => area + polygonArea(building.slabs.find((slab) => slab.ref === storey.baseSlabRef)?.footprint ?? []), 0), 0)
  const garageAreaM2 = project.buildings.filter((building) => building.kind === 'garage').reduce((sum, building) => sum + building.storeys.reduce((area, storey) => area + polygonArea(building.slabs.find((slab) => slab.ref === storey.baseSlabRef)?.footprint ?? []), 0), 0)
  const landscapeAreaM2 = project.landscape.zones.reduce((sum, zone) => sum + polygonArea(zone.footprint), 0)
  const green = new Set(['lawn', 'bed', 'rain-garden', 'vegetable'])
  return { homeAreaM2, garageAreaM2, landscapeAreaM2, greenAreaM2: project.landscape.zones.filter((zone) => green.has(zone.kind)).reduce((sum, zone) => sum + polygonArea(zone.footprint), 0), spaceCount: project.buildings.reduce((sum, building) => sum + building.spaces.length, 0), plantCount: project.landscape.plants.length, fixtureCount: project.landscape.fixtures.length, annualWaterBalanceMm: project.climateProfile.months.reduce((sum, month) => sum + month.precipitationMm + project.climateProfile.irrigationMm - month.et0Mm, 0) }
}
