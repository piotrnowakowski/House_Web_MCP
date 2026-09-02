export type Vec2 = { x: number; z: number }
export type Vec3 = { x: number; y: number; z: number }
export type Polygon2 = Vec2[]
export type ViewMode = 'technical' | 'realistic'
export type TransformMode = 'translate' | 'scale' | 'rotate'
export type ViewerMode = 'edit' | 'measure-length' | 'measure-area' | 'section' | 'plan'
export type RoofType = 'flat' | 'gable' | 'hip'
export type BuildingKind = 'house' | 'garage'
export type ArchitecturalStyle = 'classic' | 'futuristic' | 'barn'
export type GardenZoneKind = 'lawn' | 'terrace' | 'path' | 'driveway' | 'bed' | 'rain-garden' | 'vegetable'
export type PlantKind = 'tree' | 'hedge' | 'shrub' | 'perennial' | 'grass' | 'crop' | 'wetland'
export type GardenFixtureCatalogId = 'raised-bed-2x1' | 'tomato-row' | 'potato-row' | 'cucumber-trellis'

export type ClimateDayPart = 'night' | 'morning' | 'day' | 'evening'
export type TemperatureByDayPartC = Record<ClimateDayPart, number>
export interface ClimateMonth { month: number; meanMinC: number; meanMaxC: number; temperatureByDayPartC: TemperatureByDayPartC; precipitationMm: number; sunshineHours: number; et0Mm: number; frostDays: number; windKph: number }
export interface ClimateProfile {
  ref: string; name: string; latitude: number; longitude: number; timezone: string; provenance: string
  soil: { texture: 'sandy' | 'loam' | 'clay'; ph: number | null; drainage: 'fast' | 'balanced' | 'slow' }
  irrigationMm: number; months: ClimateMonth[]
}

export type ParcelLandRole = 'construction' | 'agricultural'
export type GeometryConfidence = 'surveyed' | 'derived' | 'context-only'
export interface PlotParcelModel { ref: string; cadastralNumber: string; landRole: ParcelLandRole; officialAreaM2: number; boundary: Polygon2; geometryConfidence: GeometryConfidence }
export interface TerrainModel { boundary: Polygon2; elevationPoints: Array<Vec2 & { elevation: number }> }
/** Source-data shape used by the bundled Zielonki evidence module before it is nested into SiteModel. */
export interface PlotModel { boundary: Polygon2; northDegrees: number; elevationPoints: TerrainModel['elevationPoints']; parcels: PlotParcelModel[] }
export interface KnowledgeSource { ref: string; title: string; date: string; kind: 'survey-map' | 'subdivision-map' | 'working-measurement' | 'geotechnical-report' | 'specialist-email' | 'climate-dataset' | 'horticultural-guidance' | 'user-direction'; authority: 'official' | 'professional' | 'working' | 'user-provided'; summary: string }
export interface SiteMeasurement { ref: string; label: string; value: number; unit: 'm' | 'm2' | 'percent'; sourceRef: string; confidence: 'official' | 'professional' | 'derived' | 'conceptual' }
export interface SoilInterval { fromM: number; toM: number; material: string; condition: string }
export interface BoreholeKnowledge { ref: string; label: string; position: Vec2; positionConfidence: 'map-derived' | 'surveyed'; depthM: number; groundwaterDepthM: number; intervals: SoilInterval[] }
export type PlantingGuideCategory = 'structure' | 'ornamental' | 'vegetable' | 'fruit-tree'
export interface PlantRecommendation { ref: string; commonName: string; botanicalName: string; kind: PlantKind; category: PlantingGuideCategory; priority: 'best-fit' | 'conditional'; preferredMoisture: 'wet' | 'moist' | 'balanced' | 'dry'; sunNeed: 'shade' | 'partial' | 'sun'; minHardinessC: number; placement: string; siteFit: string; caution: string; plantingWindow?: string; harvestWindow?: string; sourceRefs: string[] }
export interface SoilAnalysisFinding { ref: string; label: string; observed: string; plantingImplication: string; confidence: 'documented' | 'inferred' | 'unknown'; sourceRefs: string[] }
export interface PlantingSoilAnalysis { summary: string; findings: SoilAnalysisFinding[]; testsNeeded: Array<{ test: string; reason: string }>; preparation: string[] }
export interface SiteKnowledgeBase {
  datasetVersion: string; locality: string; addressContext: string; cadastralDistrict: string; coordinateSystem: string; heightSystem: string
  sourceCadOrigin: { easting: number; northing: number }; sources: KnowledgeSource[]; measurements: SiteMeasurement[]
  terrain: { datumElevationM: number; observedRangeM: [number, number]; fallDirection: string; conceptualGradientPercent: number }
  geotechnical: { investigationDate: string; boreholes: BoreholeKnowledge[]; weakBearingToApproxM: number; groundwaterRangeM: [number, number]; foundationConcept: string; documentationNeed: string; reportClassification: string; constraints: string[] }
  planting: { strategy: string[]; soilAnalysis: PlantingSoilAnalysis; recommendations: PlantRecommendation[]; exclusions: string[] }
  designRules: Array<{ rule: string; basis: string; sourceRef: string }>; caveats: string[]
}
export interface SiteModel { boundary: Polygon2; northDegrees: number; terrain: TerrainModel; parcels: PlotParcelModel[]; knowledgeBase: SiteKnowledgeBase }

export interface OpeningModel { ref: string; kind: 'door' | 'window'; wallRef: string; offsetM: number; widthM: number; heightM: number; sillM: number }
export interface WallModel { ref: string; start: Vec2; end: Vec2; thicknessM: number; baseElevationM: number; heightM: number; openings: OpeningModel[]; locked: boolean }
export interface SpaceBoundaryUse { wallRef: string; direction: 1 | -1 }
export interface SpaceModel { ref: string; name: string; usage: string; boundary: SpaceBoundaryUse[]; baseSlabRef: string; topBoundaryRef: string; locked: boolean }
export interface SlabModel { ref: string; footprint: Polygon2; topElevationM: number; thicknessM: number; locked: boolean }
export interface CeilingFinishModel { ref: string; spaceRef: string; hostBoundaryRef: string; elevationM: number; thicknessM: number }
export interface PlatformModel { ref: string; spaceRef: string; footprint: Polygon2; elevationM: number; thicknessM: number }
export interface StoreyModel { ref: string; name: string; level: number; elevationM: number; clearHeightM: number; baseSlabRef: string; topBoundaryRef: string; wallRefs: string[]; spaceRefs: string[]; platformRefs: string[]; ceilingFinishRefs: string[] }
export interface RoofModel { ref: string; type: RoofType; baseElevationM: number; pitchDegrees: number; overhangM: number }
export interface BuildingModel {
  ref: string; name: string; kind: BuildingKind; architecturalStyle: ArchitecturalStyle; garageMode?: 'integrated' | 'attached'
  position: Vec2; rotationDegrees: number; storeys: StoreyModel[]; slabs: SlabModel[]; walls: WallModel[]; spaces: SpaceModel[]
  platforms: PlatformModel[]; ceilingFinishes: CeilingFinishModel[]; roof: RoofModel
}

export interface LandscapeZone { ref: string; name: string; kind: GardenZoneKind; footprint: Polygon2; locked: boolean }
export interface SurfaceAttachment { hostRef: string; hostFace: 'top' | 'bottom' | 'inside' | 'outside' | 'terrain'; localPosition: Vec3; rotationDegrees: number }
export interface PlantModel { ref: string; name: string; species: string; kind: PlantKind; position: Vec2; matureHeightM: number; canopyM: number; sunNeed: 'shade' | 'partial' | 'sun'; waterNeed: number; hardinessMinC: number; leafMonths: number[]; bloomMonths: number[]; locked: boolean; attachment?: SurfaceAttachment }
export interface GardenFixtureModel { ref: string; catalogId: GardenFixtureCatalogId; name: string; position: Vec2; rotationDegrees: number; locked: boolean }
export interface LandscapeModel { zones: LandscapeZone[]; plants: PlantModel[]; fixtures: GardenFixtureModel[]; fixtureCatalogVersion: number }

export interface ProjectV2 { schemaVersion: 2; ref: string; name: string; units: 'metric'; revision: number; updatedAt: string; site: SiteModel; buildings: BuildingModel[]; landscape: LandscapeModel; climateProfile: ClimateProfile }
export type IssueSeverity = 'error' | 'warning' | 'note'
export interface ProjectIssue { severity: IssueSeverity; code: string; message: string; subjectRef?: string }
export interface ProjectMetrics { homeAreaM2: number; garageAreaM2: number; landscapeAreaM2: number; greenAreaM2: number; spaceCount: number; plantCount: number; fixtureCount: number; annualWaterBalanceMm: number }

export type SiteUpdateCommand = { type: 'site.update'; boundary?: Polygon2; northDegrees?: number }
export type TerrainUpdateCommand = { type: 'terrain.update'; elevationPoints: TerrainModel['elevationPoints'] }
export type BuildingUpdateCommand = { type: 'building.update'; action: 'add' | 'remove' | 'move' | 'set-style'; buildingRef: string; name?: string; kind?: BuildingKind; architecturalStyle?: ArchitecturalStyle; position?: Vec2; rotationDegrees?: number }
export type StoreyUpdateCommand = { type: 'storey.update'; action: 'add' | 'remove' | 'set-height'; buildingRef: string; storeyRef: string; name?: string; clearHeightM?: number; footprint?: Polygon2 }
export type SlabUpdateCommand = { type: 'slab.update'; action: 'set-footprint' | 'set-thickness' | 'set-elevation'; buildingRef: string; slabRef: string; footprint?: Polygon2; thicknessM?: number; topElevationM?: number }
export type SpaceUpdateCommand = { type: 'space.update'; action: 'add' | 'remove' | 'set-footprint' | 'set-usage' | 'set-lowered-ceiling'; buildingRef: string; storeyRef: string; spaceRef: string; name?: string; usage?: string; footprint?: Polygon2; ceilingElevationM?: number }
export type WallUpdateCommand = { type: 'wall.update'; action: 'move' | 'set-thickness' | 'set-height'; buildingRef: string; wallRef: string; start?: Vec2; end?: Vec2; thicknessM?: number; heightM?: number }
export type OpeningUpdateCommand = { type: 'opening.update'; action: 'add' | 'remove' | 'resize' | 'move'; buildingRef: string; wallRef: string; openingRef: string; kind?: OpeningModel['kind']; offsetM?: number; widthM?: number; heightM?: number; sillM?: number }
export type RoofUpdateCommand = { type: 'roof.update'; buildingRef: string; roofType?: RoofType; pitchDegrees?: number; overhangM?: number }
export type PlatformUpdateCommand = { type: 'platform.update'; action: 'add' | 'remove' | 'resize'; buildingRef: string; storeyRef: string; spaceRef: string; platformRef: string; footprint?: Polygon2; elevationM?: number; thicknessM?: number }
export type LandscapeUpdateCommand = { type: 'landscape.update'; action: 'add' | 'remove' | 'set-footprint' | 'move'; zoneRef: string; name?: string; kind?: GardenZoneKind; footprint?: Polygon2; delta?: Vec2 }
export type PlantUpdateCommand = { type: 'plant.update'; action: 'add' | 'remove' | 'move'; plantRef: string; name?: string; species?: string; kind?: PlantKind; position?: Vec2 }
export type GardenFixtureUpdateCommand = { type: 'garden-fixture.update'; action: 'add' | 'remove' | 'move' | 'rotate'; fixtureRef: string; catalogId?: GardenFixtureCatalogId; name?: string; position?: Vec2; rotationDegrees?: number }
export type ClimateUpdateCommand = { type: 'climate.update'; month: number; values: Partial<Omit<ClimateMonth, 'month'>> }
export type ProjectCommand = SiteUpdateCommand | TerrainUpdateCommand | BuildingUpdateCommand | StoreyUpdateCommand | SlabUpdateCommand | SpaceUpdateCommand | WallUpdateCommand | OpeningUpdateCommand | RoofUpdateCommand | PlatformUpdateCommand | LandscapeUpdateCommand | PlantUpdateCommand | GardenFixtureUpdateCommand | ClimateUpdateCommand

export interface VariantModel { ref: string; label: string; baseRevision: number; createdAt: string; commands: ProjectCommand[]; project: ProjectV2; issues: ProjectIssue[]; metrics: ProjectMetrics }
export interface SeasonalMonthAnalysis { month: number; temperatureByDayPartC: TemperatureByDayPartC; daylightHours: number; representativeSunHours: number; waterBalanceMm: number; droughtRisk: 'low' | 'moderate' | 'high'; frostRisk: 'low' | 'moderate' | 'high'; activePlants: number; bloomingPlants: number; notes: string[] }

export type StructureViewRequest = { type: 'site-plan' } | { type: 'axonometric' } | { type: 'north-elevation' | 'south-elevation' | 'east-elevation' | 'west-elevation' } | { type: 'storey-plan'; storeyRef: string } | { type: 'section'; axis: 'longitudinal' | 'transverse'; offsetM?: number }
export interface StructureViewDescriptor { type: StructureViewRequest['type']; title: string; buildingRefs: string[]; storeyRef?: string; presentation: 'visible-in-page'; imageUrl: string }
export interface StructureReport {
  ref: string; createdAt: string; projectRevision: number; views: StructureViewDescriptor[]
  buildings: Array<{ ref: string; name: string; positionM: Vec2; rotationDegrees: number; widthM: number; depthM: number; heightM: number; baseElevationM: number }>
}
