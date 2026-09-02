import type {
  BuildingModel, FloorModel, GardenZone, PlantModel, ProjectCommand, ProjectIssue, ProjectMetrics, ProjectV1, RoomModel,
} from './types'

const clone = <T,>(value: T): T => structuredClone(value)

export const pointInPolygon = (point: { x: number; z: number }, polygon: Array<{ x: number; z: number }>) => {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]
    const b = polygon[j]
    const intersects = ((a.z > point.z) !== (b.z > point.z))
      && point.x < ((b.x - a.x) * (point.z - a.z)) / ((b.z - a.z) || 1e-9) + a.x
    if (intersects) inside = !inside
  }
  return inside
}

export const polygonArea = (points: Array<{ x: number; z: number }>) => Math.abs(points.reduce((sum, point, index) => {
  const next = points[(index + 1) % points.length]
  return sum + point.x * next.z - next.x * point.z
}, 0) / 2)

const getBuilding = (project: ProjectV1, ref: string) => {
  const building = project.buildings.find((item) => item.ref === ref)
  if (!building) throw new Error(`Building not found: ${ref}`)
  return building
}

const getFloor = (building: BuildingModel, ref: string) => {
  const floor = building.floors.find((item) => item.ref === ref)
  if (!floor) throw new Error(`Floor not found: ${ref}`)
  return floor
}

const getRoom = (floor: FloorModel, ref: string) => {
  const room = floor.rooms.find((item) => item.ref === ref)
  if (!room) throw new Error(`Room not found: ${ref}`)
  return room
}

const ensureEditable = (room: RoomModel) => {
  if (room.locked) throw new Error(`${room.ref} is locked and cannot be changed`)
}

const defaultFloor = (ref: string, name: string, level: number, elevationM: number, heightM: number): FloorModel => ({
  ref, name, level, elevationM, defaultHeightM: heightM, rooms: [],
})

const defaultRoom = (ref: string, name: string, usage: string, position = { x: 0, z: 0 }, widthM = 4, depthM = 4, heightM = 3): RoomModel => ({
  ref, name, usage, position, widthM, depthM, heightM, rotationDegrees: 0, ceilingType: 'flat', locked: false, openings: [], mezzanines: [],
})

const applyBuilding = (project: ProjectV1, command: Extract<ProjectCommand, { type: 'building.update' }>) => {
  if (command.action === 'add') {
    if (project.buildings.some((item) => item.ref === command.buildingRef)) throw new Error(`Reference already exists: ${command.buildingRef}`)
    project.buildings.push({
      ref: command.buildingRef, name: command.name ?? 'New building', kind: command.kind ?? 'house', position: command.position ?? { x: 0, z: 0 },
      rotationDegrees: command.rotationDegrees ?? 0, floors: [defaultFloor(`${command.buildingRef}/ground`, 'Ground floor', 0, 0.4, 3)],
      roof: command.roof ?? { type: 'flat', pitchDegrees: 0, overhangM: 0.3 },
    })
    return
  }
  if (command.action === 'remove') {
    project.buildings = project.buildings.filter((item) => item.ref !== command.buildingRef)
    return
  }
  const building = getBuilding(project, command.buildingRef)
  if (command.action === 'set-roof' && command.roof) building.roof = command.roof
  if (command.action === 'move') {
    if (command.position) building.position = command.position
    if (command.rotationDegrees !== undefined) building.rotationDegrees = command.rotationDegrees
  }
}

const applyFloor = (project: ProjectV1, command: Extract<ProjectCommand, { type: 'floor.update' }>) => {
  const building = getBuilding(project, command.buildingRef)
  if (command.action === 'add') {
    if (building.floors.some((item) => item.ref === command.floorRef)) throw new Error(`Reference already exists: ${command.floorRef}`)
    const highest = building.floors.reduce((best, floor) => floor.level > best.level ? floor : best, building.floors[0])
    const level = highest ? highest.level + 1 : 0
    const elevation = highest ? highest.elevationM + highest.defaultHeightM + 0.25 : 0.4
    const floor = defaultFloor(command.floorRef, command.name ?? `Floor ${level}`, level, elevation, command.heightM ?? 2.9)
    if (highest?.rooms.length) {
      floor.rooms.push(...highest.rooms.slice(0, 2).map((room, index) => ({
        ...clone(room), ref: `${command.floorRef}/room-${index + 1}`, name: index === 0 ? 'Upper lounge' : 'Bedroom', usage: index === 0 ? 'living' : 'sleeping',
        heightM: command.heightM ?? 2.9, locked: false, openings: [], mezzanines: [],
      })))
    }
    building.floors.push(floor)
    return
  }
  if (command.action === 'remove') {
    building.floors = building.floors.filter((item) => item.ref !== command.floorRef)
    return
  }
  const floor = getFloor(building, command.floorRef)
  if (command.heightM !== undefined) {
    floor.defaultHeightM = command.heightM
    floor.rooms.forEach((room) => { if (!room.locked) room.heightM = command.heightM! })
  }
}

const applyRoom = (project: ProjectV1, command: Extract<ProjectCommand, { type: 'room.update' }>) => {
  const floor = getFloor(getBuilding(project, command.buildingRef), command.floorRef)
  if (command.action === 'add') {
    if (floor.rooms.some((item) => item.ref === command.roomRef)) throw new Error(`Reference already exists: ${command.roomRef}`)
    floor.rooms.push(defaultRoom(command.roomRef, command.name ?? 'New room', command.usage ?? 'flex', command.position, command.widthM, command.depthM, command.heightM ?? floor.defaultHeightM))
    return
  }
  const room = getRoom(floor, command.roomRef)
  ensureEditable(room)
  if (command.action === 'remove') {
    floor.rooms = floor.rooms.filter((item) => item.ref !== command.roomRef)
    return
  }
  if (command.position) room.position = command.position
  if (command.widthM !== undefined) room.widthM = command.widthM
  if (command.depthM !== undefined) room.depthM = command.depthM
  if (command.heightM !== undefined) room.heightM = command.heightM
  if (command.rotationDegrees !== undefined) room.rotationDegrees = command.rotationDegrees
  if (command.ceilingType) room.ceilingType = command.ceilingType
}

const applyMezzanine = (project: ProjectV1, command: Extract<ProjectCommand, { type: 'mezzanine.update' }>) => {
  const room = getRoom(getFloor(getBuilding(project, command.buildingRef), command.floorRef), command.roomRef)
  ensureEditable(room)
  if (command.action === 'add') {
    room.mezzanines.push({
      ref: command.mezzanineRef, roomRef: room.ref, position: command.position ?? { x: 0, z: 0 },
      widthM: command.widthM ?? room.widthM * 0.45, depthM: command.depthM ?? room.depthM * 0.8,
      elevationM: command.elevationM ?? Math.max(2.2, room.heightM * 0.55), thicknessM: 0.2,
    })
    return
  }
  if (command.action === 'remove') {
    room.mezzanines = room.mezzanines.filter((item) => item.ref !== command.mezzanineRef)
    return
  }
  const mezzanine = room.mezzanines.find((item) => item.ref === command.mezzanineRef)
  if (!mezzanine) throw new Error(`Mezzanine not found: ${command.mezzanineRef}`)
  if (command.position) mezzanine.position = command.position
  if (command.widthM !== undefined) mezzanine.widthM = command.widthM
  if (command.depthM !== undefined) mezzanine.depthM = command.depthM
  if (command.elevationM !== undefined) mezzanine.elevationM = command.elevationM
}

const applyGarage = (project: ProjectV1, command: Extract<ProjectCommand, { type: 'garage.update' }>) => {
  const existing = project.buildings.find((item) => item.ref === command.garageRef)
  if (command.action === 'add') {
    if (existing) throw new Error(`Reference already exists: ${command.garageRef}`)
    const width = command.widthM ?? 6.2
    const depth = command.depthM ?? 6.8
    const height = command.heightM ?? 2.8
    const floor = defaultFloor(`${command.garageRef}/ground`, 'Garage floor', 0, 0.35, height)
    floor.rooms.push(defaultRoom(`${command.garageRef}/parking`, 'Two-car garage', 'garage', { x: 0, z: 0 }, width, depth, height))
    project.buildings.push({
      ref: command.garageRef, name: 'Garage', kind: 'garage', garageMode: command.mode ?? 'attached', position: command.position ?? { x: 9, z: -2 },
      rotationDegrees: 0, floors: [floor], roof: { type: 'flat', pitchDegrees: 0, overhangM: 0.35 },
    })
    return
  }
  if (command.action === 'remove') {
    project.buildings = project.buildings.filter((item) => item.ref !== command.garageRef)
    return
  }
  if (!existing) throw new Error(`Garage not found: ${command.garageRef}`)
  if (command.position) existing.position = command.position
  const room = existing.floors[0]?.rooms[0]
  if (room) {
    if (command.widthM !== undefined) room.widthM = command.widthM
    if (command.depthM !== undefined) room.depthM = command.depthM
    if (command.heightM !== undefined) room.heightM = command.heightM
  }
}

const upsertZone = (project: ProjectV1, zone: GardenZone) => {
  const index = project.garden.zones.findIndex((item) => item.ref === zone.ref)
  if (index >= 0) project.garden.zones[index] = zone
  else project.garden.zones.push(zone)
}

const upsertPlant = (project: ProjectV1, plant: PlantModel) => {
  const index = project.garden.plants.findIndex((item) => item.ref === plant.ref)
  if (index >= 0) project.garden.plants[index] = plant
  else project.garden.plants.push(plant)
}

const applyGardenPlan = (project: ProjectV1, command: Extract<ProjectCommand, { type: 'garden.plan' }>) => {
  const keep = new Set(command.preserveRefs)
  project.garden.zones = project.garden.zones.filter((zone) => zone.locked || keep.has(zone.ref) || zone.kind === 'terrace')
  project.garden.plants = project.garden.plants.filter((plant) => plant.locked || keep.has(plant.ref))
  upsertZone(project, { ref: 'zone/agent-lawn', name: 'Open play lawn', kind: 'lawn', position: { x: 5, z: 12 }, widthM: 12, depthM: 7, rotationDegrees: 0, locked: false })
  upsertZone(project, { ref: 'zone/agent-rain', name: 'Rain garden', kind: 'rain-garden', position: { x: -9.5, z: 12 }, widthM: 5.5, depthM: 3.8, rotationDegrees: 10, locked: false })
  upsertZone(project, { ref: 'zone/agent-bed', name: 'Four-season border', kind: 'bed', position: { x: 10, z: 3.8 }, widthM: 2.4, depthM: 8, rotationDegrees: 0, locked: false })
  if (command.goals.some((goal) => goal.toLowerCase().includes('vegetable'))) {
    upsertZone(project, { ref: 'zone/agent-vegetable', name: 'Kitchen garden', kind: 'vegetable', position: { x: -10, z: 5 }, widthM: 4.2, depthM: 4, rotationDegrees: 0, locked: false })
  }
  const waterFactor = command.waterPreference === 'low' ? 0.55 : command.waterPreference === 'lush' ? 1.2 : 0.8
  upsertPlant(project, { ref: 'plant/agent-birch', name: 'Canopy birch', species: 'Betula pendula', kind: 'tree', position: { x: 12, z: 16 }, matureHeightM: 9, canopyM: 5.5, sunNeed: 'sun', waterNeed: waterFactor, hardinessMinC: -28, leafMonths: [4,5,6,7,8,9,10], bloomMonths: [4,5], locked: false })
  upsertPlant(project, { ref: 'plant/agent-lavender', name: 'Lavender ribbon', species: 'Lavandula angustifolia', kind: 'perennial', position: { x: 9.5, z: 4 }, matureHeightM: 0.7, canopyM: 4.5, sunNeed: 'sun', waterNeed: 0.42, hardinessMinC: -20, leafMonths: [4,5,6,7,8,9,10], bloomMonths: [6,7,8], locked: false })
  upsertPlant(project, { ref: 'plant/agent-sedge', name: 'Rain garden sedges', species: 'Carex spp.', kind: 'wetland', position: { x: -9.5, z: 12 }, matureHeightM: 0.8, canopyM: 3.4, sunNeed: 'sun', waterNeed: 1.1, hardinessMinC: -25, leafMonths: [3,4,5,6,7,8,9,10,11], bloomMonths: [5,6], locked: false })
}

const applyGardenUpdate = (project: ProjectV1, command: Extract<ProjectCommand, { type: 'garden.update' }>) => {
  if (command.action === 'remove-zone') {
    const zone = project.garden.zones.find((item) => item.ref === command.subjectRef)
    if (zone?.locked) throw new Error(`${zone.ref} is locked and cannot be changed`)
    project.garden.zones = project.garden.zones.filter((item) => item.ref !== command.subjectRef)
    return
  }
  if (command.action === 'remove-plant') {
    const plant = project.garden.plants.find((item) => item.ref === command.subjectRef)
    if (plant?.locked) throw new Error(`${plant.ref} is locked and cannot be changed`)
    project.garden.plants = project.garden.plants.filter((item) => item.ref !== command.subjectRef)
    return
  }
  if (command.action === 'add-zone') {
    upsertZone(project, { ref: command.subjectRef, name: command.name ?? 'Garden zone', kind: (command.kind as GardenZone['kind']) ?? 'bed', position: command.position ?? { x: 0, z: 8 }, widthM: command.widthM ?? 4, depthM: command.depthM ?? 3, rotationDegrees: 0, locked: false })
    return
  }
  if (command.action === 'add-plant') {
    upsertPlant(project, { ref: command.subjectRef, name: command.name ?? 'Garden plant', species: command.species ?? 'Plant selection', kind: (command.kind as PlantModel['kind']) ?? 'shrub', position: command.position ?? { x: 0, z: 8 }, matureHeightM: 1.8, canopyM: command.widthM ?? 1.8, sunNeed: 'partial', waterNeed: 0.8, hardinessMinC: -22, leafMonths: [4,5,6,7,8,9,10], bloomMonths: [6,7,8], locked: false })
    return
  }
  const zone = project.garden.zones.find((item) => item.ref === command.subjectRef)
  const plant = project.garden.plants.find((item) => item.ref === command.subjectRef)
  if (zone) {
    if (zone.locked) throw new Error(`${zone.ref} is locked and cannot be changed`)
    if (command.position) zone.position = command.position
  } else if (plant) {
    if (plant.locked) throw new Error(`${plant.ref} is locked and cannot be changed`)
    if (command.position) plant.position = command.position
  } else throw new Error(`Garden subject not found: ${command.subjectRef}`)
}

export const applyCommand = (source: ProjectV1, command: ProjectCommand): ProjectV1 => {
  const project = clone(source)
  switch (command.type) {
    case 'plot.update':
      if (command.boundary) project.plot.boundary = command.boundary
      if (command.northDegrees !== undefined) project.plot.northDegrees = command.northDegrees
      if (command.elevationPoints) project.plot.elevationPoints = command.elevationPoints
      break
    case 'building.update': applyBuilding(project, command); break
    case 'floor.update': applyFloor(project, command); break
    case 'room.update': applyRoom(project, command); break
    case 'mezzanine.update': applyMezzanine(project, command); break
    case 'garage.update': applyGarage(project, command); break
    case 'garden.plan': applyGardenPlan(project, command); break
    case 'garden.update': applyGardenUpdate(project, command); break
    case 'climate.update': {
      const month = project.climateProfile.months.find((item) => item.month === command.month)
      if (!month) throw new Error(`Climate month not found: ${command.month}`)
      Object.assign(month, command.values)
      break
    }
  }
  project.updatedAt = new Date().toISOString()
  return project
}

export const applyCommands = (source: ProjectV1, commands: ProjectCommand[]) => commands.reduce(applyCommand, source)

const boxesOverlap = (a: RoomModel, b: RoomModel) => Math.abs(a.position.x - b.position.x) < (a.widthM + b.widthM) / 2 - 0.05
  && Math.abs(a.position.z - b.position.z) < (a.depthM + b.depthM) / 2 - 0.05

export const validateProject = (project: ProjectV1): ProjectIssue[] => {
  const issues: ProjectIssue[] = []
  if (project.plot.boundary.length < 3 || polygonArea(project.plot.boundary) < 20) issues.push({ severity: 'error', code: 'plot.invalid', message: 'Plot boundary must contain a usable polygon.', subjectRef: project.ref })
  if (project.buildings.some((building) => building.kind === 'house')) issues.push({
    severity: 'warning',
    code: 'site.geotechnical-review',
    message: `Zielonki ground review required: weak-bearing soils to about ${project.knowledgeBase.geotechnical.weakBearingToApproxM.toFixed(1)} m, groundwater at ${project.knowledgeBase.geotechnical.groundwaterRangeM[0].toFixed(1)}–${project.knowledgeBase.geotechnical.groundwaterRangeM[1].toFixed(1)} m, and an unverified micropile concept.`,
    subjectRef: 'house/main',
  })
  project.buildings.forEach((building) => {
    if (!building.floors.length) issues.push({ severity: 'warning', code: 'building.empty', message: `${building.name} has no floors.`, subjectRef: building.ref })
    building.floors.forEach((floor) => {
      floor.rooms.forEach((room, index) => {
        if (room.widthM <= 0 || room.depthM <= 0 || room.heightM <= 0) issues.push({ severity: 'error', code: 'room.dimensions', message: `${room.name} has invalid dimensions.`, subjectRef: room.ref })
        const world = { x: room.position.x + building.position.x, z: room.position.z + building.position.z }
        if (!pointInPolygon(world, project.plot.boundary)) issues.push({ severity: 'error', code: 'room.outside-plot', message: `${room.name} sits outside the plot.`, subjectRef: room.ref })
        floor.rooms.slice(index + 1).forEach((other) => {
          if (boxesOverlap(room, other)) issues.push({ severity: 'warning', code: 'room.overlap', message: `${room.name} overlaps ${other.name}.`, subjectRef: room.ref })
        })
        room.mezzanines.forEach((mezzanine) => {
          if (mezzanine.widthM > room.widthM || mezzanine.depthM > room.depthM) issues.push({ severity: 'error', code: 'mezzanine.bounds', message: `Mezzanine exceeds ${room.name}.`, subjectRef: mezzanine.ref })
          if (mezzanine.elevationM >= room.heightM - 0.5) issues.push({ severity: 'error', code: 'mezzanine.clearance', message: `Mezzanine has insufficient upper clearance.`, subjectRef: mezzanine.ref })
        })
      })
    })
  })
  project.garden.zones.forEach((zone) => {
    if (!pointInPolygon(zone.position, project.plot.boundary)) issues.push({ severity: 'warning', code: 'garden.outside-plot', message: `${zone.name} is outside the plot.`, subjectRef: zone.ref })
  })
  return issues
}

export const calculateMetrics = (project: ProjectV1): ProjectMetrics => {
  let homeAreaM2 = 0
  let garageAreaM2 = 0
  let roomCount = 0
  project.buildings.forEach((building) => building.floors.forEach((floor) => floor.rooms.forEach((room) => {
    const area = room.widthM * room.depthM
    if (building.kind === 'garage') garageAreaM2 += area
    else homeAreaM2 += area
    roomCount += 1
  })))
  const plotArea = polygonArea(project.plot.boundary)
  const hardscape = project.garden.zones.filter((zone) => ['terrace', 'path', 'driveway'].includes(zone.kind)).reduce((sum, zone) => sum + zone.widthM * zone.depthM, 0)
  const annualPrecip = project.climateProfile.months.reduce((sum, month) => sum + month.precipitationMm + project.climateProfile.irrigationMm, 0)
  const annualEt0 = project.climateProfile.months.reduce((sum, month) => sum + month.et0Mm, 0)
  return {
    homeAreaM2: Math.round(homeAreaM2 * 10) / 10,
    garageAreaM2: Math.round(garageAreaM2 * 10) / 10,
    gardenAreaM2: Math.max(0, Math.round((plotArea - homeAreaM2 - garageAreaM2) * 10) / 10),
    greenAreaM2: Math.max(0, Math.round((plotArea - homeAreaM2 - garageAreaM2 - hardscape) * 10) / 10),
    roomCount,
    plantCount: project.garden.plants.length,
    annualWaterBalanceMm: Math.round(annualPrecip - annualEt0),
  }
}
