export type Vec2 = { x: number; z: number }
export type Vec3 = { x: number; y: number; z: number }
export type ViewMode = 'technical' | 'realistic'
export type TransformMode = 'translate' | 'scale' | 'rotate'
export type RoofType = 'flat' | 'gable' | 'hip'
export type BuildingKind = 'house' | 'garage'
export type GardenZoneKind = 'lawn' | 'terrace' | 'path' | 'driveway' | 'bed' | 'rain-garden' | 'vegetable'
export type PlantKind = 'tree' | 'hedge' | 'shrub' | 'perennial' | 'grass' | 'crop' | 'wetland'

export interface ClimateMonth {
  month: number
  meanMinC: number
  meanMaxC: number
  precipitationMm: number
  sunshineHours: number
  et0Mm: number
  frostDays: number
  windKph: number
}

export interface ClimateProfile {
  ref: string
  name: string
  latitude: number
  longitude: number
  timezone: string
  provenance: string
  soil: { texture: 'sandy' | 'loam' | 'clay'; ph: number; drainage: 'fast' | 'balanced' | 'slow' }
  irrigationMm: number
  months: ClimateMonth[]
}

export interface PlotModel {
  boundary: Vec2[]
  northDegrees: number
  elevationPoints: Array<Vec2 & { elevation: number }>
}

export interface OpeningModel {
  ref: string
  kind: 'door' | 'window'
  wall: 'north' | 'east' | 'south' | 'west'
  offsetM: number
  widthM: number
  heightM: number
}

export interface MezzanineModel {
  ref: string
  roomRef: string
  position: Vec2
  widthM: number
  depthM: number
  elevationM: number
  thicknessM: number
}

export interface RoomModel {
  ref: string
  name: string
  usage: string
  position: Vec2
  widthM: number
  depthM: number
  heightM: number
  rotationDegrees: number
  ceilingType: 'flat' | 'lowered' | 'sloped'
  locked: boolean
  openings: OpeningModel[]
  mezzanines: MezzanineModel[]
}

export interface FloorModel {
  ref: string
  name: string
  level: number
  elevationM: number
  defaultHeightM: number
  rooms: RoomModel[]
}

export interface BuildingModel {
  ref: string
  name: string
  kind: BuildingKind
  garageMode?: 'integrated' | 'attached'
  position: Vec2
  rotationDegrees: number
  floors: FloorModel[]
  roof: { type: RoofType; pitchDegrees: number; overhangM: number }
}

export interface GardenZone {
  ref: string
  name: string
  kind: GardenZoneKind
  position: Vec2
  widthM: number
  depthM: number
  rotationDegrees: number
  locked: boolean
}

export interface PlantModel {
  ref: string
  name: string
  species: string
  kind: PlantKind
  position: Vec2
  matureHeightM: number
  canopyM: number
  sunNeed: 'shade' | 'partial' | 'sun'
  waterNeed: number
  hardinessMinC: number
  leafMonths: number[]
  bloomMonths: number[]
  locked: boolean
}

export interface GardenModel {
  zones: GardenZone[]
  plants: PlantModel[]
}

export interface ProjectV1 {
  schemaVersion: 1
  ref: string
  name: string
  units: 'metric'
  revision: number
  updatedAt: string
  plot: PlotModel
  buildings: BuildingModel[]
  garden: GardenModel
  climateProfile: ClimateProfile
}

export type IssueSeverity = 'error' | 'warning' | 'note'

export interface ProjectIssue {
  severity: IssueSeverity
  code: string
  message: string
  subjectRef?: string
}

export interface ProjectMetrics {
  homeAreaM2: number
  garageAreaM2: number
  gardenAreaM2: number
  greenAreaM2: number
  roomCount: number
  plantCount: number
  annualWaterBalanceMm: number
}

export interface VariantModel {
  ref: string
  label: string
  baseRevision: number
  createdAt: string
  commands: ProjectCommand[]
  project: ProjectV1
  issues: ProjectIssue[]
  metrics: ProjectMetrics
}

export type PlotUpdateCommand = {
  type: 'plot.update'
  boundary?: Vec2[]
  northDegrees?: number
  elevationPoints?: Array<Vec2 & { elevation: number }>
}

export type BuildingUpdateCommand = {
  type: 'building.update'
  action: 'add' | 'remove' | 'set-roof' | 'move'
  buildingRef: string
  name?: string
  kind?: BuildingKind
  position?: Vec2
  rotationDegrees?: number
  roof?: BuildingModel['roof']
}

export type FloorUpdateCommand = {
  type: 'floor.update'
  action: 'add' | 'remove' | 'set-height'
  buildingRef: string
  floorRef: string
  name?: string
  heightM?: number
}

export type RoomUpdateCommand = {
  type: 'room.update'
  action: 'add' | 'remove' | 'move' | 'resize' | 'set-ceiling'
  buildingRef: string
  floorRef: string
  roomRef: string
  name?: string
  usage?: string
  position?: Vec2
  widthM?: number
  depthM?: number
  heightM?: number
  rotationDegrees?: number
  ceilingType?: RoomModel['ceilingType']
  locked?: boolean
}

export type MezzanineUpdateCommand = {
  type: 'mezzanine.update'
  action: 'add' | 'remove' | 'resize'
  buildingRef: string
  floorRef: string
  roomRef: string
  mezzanineRef: string
  position?: Vec2
  widthM?: number
  depthM?: number
  elevationM?: number
}

export type GarageUpdateCommand = {
  type: 'garage.update'
  action: 'add' | 'remove' | 'resize' | 'move'
  garageRef: string
  mode?: 'integrated' | 'attached'
  position?: Vec2
  widthM?: number
  depthM?: number
  heightM?: number
}

export type GardenPlanCommand = {
  type: 'garden.plan'
  goals: string[]
  preserveRefs: string[]
  waterPreference: 'low' | 'balanced' | 'lush'
}

export type GardenUpdateCommand = {
  type: 'garden.update'
  action: 'add-zone' | 'remove-zone' | 'move-zone' | 'add-plant' | 'remove-plant' | 'move-plant'
  subjectRef: string
  name?: string
  kind?: GardenZoneKind | PlantKind
  position?: Vec2
  widthM?: number
  depthM?: number
  species?: string
}

export type ClimateUpdateCommand = {
  type: 'climate.update'
  month: number
  values: Partial<Omit<ClimateMonth, 'month'>>
}

export type ProjectCommand =
  | PlotUpdateCommand
  | BuildingUpdateCommand
  | FloorUpdateCommand
  | RoomUpdateCommand
  | MezzanineUpdateCommand
  | GarageUpdateCommand
  | GardenPlanCommand
  | GardenUpdateCommand
  | ClimateUpdateCommand

export interface SeasonalMonthAnalysis {
  month: number
  daylightHours: number
  representativeSunHours: number
  waterBalanceMm: number
  droughtRisk: 'low' | 'moderate' | 'high'
  frostRisk: 'low' | 'moderate' | 'high'
  activePlants: number
  bloomingPlants: number
  notes: string[]
}
