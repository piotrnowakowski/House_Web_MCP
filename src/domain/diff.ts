import { calculateMetrics } from './commands'
import type { ProjectMetrics, ProjectV2 } from './types'

export type ChangeKind = 'site' | 'building' | 'storey' | 'slab' | 'wall' | 'opening' | 'space' | 'roof' | 'roof-segment' | 'platform' | 'ceiling-finish' | 'zone' | 'plant' | 'fixture' | 'parcel' | 'entrance' | 'climate'
export interface ProjectChange { kind: ChangeKind; ref: string; change: 'added' | 'removed' | 'modified'; fields?: string[] }
export interface MetricDelta { before: number; after: number; delta: number }
export interface ProjectDiff { counts: { added: number; removed: number; modified: number }; changes: ProjectChange[]; omittedChanges: number; metricDeltas: Partial<Record<keyof ProjectMetrics, MetricDelta>> }

type Entry = { ref: string; fields: Record<string, unknown> }
const pick = (value: Record<string, unknown>, keys: string[]) => Object.fromEntries(keys.map((key) => [key, value[key]]))
const round = (value: number) => Math.round(value * 1000) / 1000

/** Flattens a project into comparable entries per kind; child collections are compared as their own kinds, not as parent fields. */
const entries = (project: ProjectV2): Array<[ChangeKind, Entry[]]> => {
  const buildings = project.buildings
  return [
    ['site', [{ ref: 'site', fields: { boundary: project.site.boundary, northDegrees: project.site.northDegrees, terrain: project.site.terrain } }]],
    ['parcel', project.site.parcels.map((parcel) => ({ ref: parcel.ref, fields: pick(parcel as unknown as Record<string, unknown>, ['cadastralNumber', 'landRole', 'officialAreaM2', 'boundary']) }))],
    ['entrance', project.site.entrances.map((entrance) => ({ ref: entrance.ref, fields: pick(entrance as unknown as Record<string, unknown>, ['name', 'start', 'end']) }))],
    ['building', buildings.map((building) => ({ ref: building.ref, fields: pick(building as unknown as Record<string, unknown>, ['name', 'kind', 'architecturalStyle', 'garageMode', 'position', 'rotationDegrees']) }))],
    ['storey', buildings.flatMap((building) => building.storeys.map((storey) => ({ ref: storey.ref, fields: pick(storey as unknown as Record<string, unknown>, ['name', 'level', 'elevationM', 'clearHeightM', 'baseSlabRef', 'topBoundaryRef', 'wallRefs', 'spaceRefs', 'platformRefs', 'ceilingFinishRefs']) })))],
    ['slab', buildings.flatMap((building) => building.slabs.map((slab) => ({ ref: slab.ref, fields: pick(slab as unknown as Record<string, unknown>, ['footprint', 'topElevationM', 'thicknessM', 'locked']) })))],
    ['wall', buildings.flatMap((building) => building.walls.map((wall) => ({ ref: wall.ref, fields: pick(wall as unknown as Record<string, unknown>, ['start', 'end', 'thicknessM', 'baseElevationM', 'heightM', 'finish', 'locked']) })))],
    ['opening', buildings.flatMap((building) => building.walls.flatMap((wall) => wall.openings.map((opening) => ({ ref: opening.ref, fields: pick(opening as unknown as Record<string, unknown>, ['kind', 'wallRef', 'offsetM', 'widthM', 'heightM', 'sillM']) }))))],
    ['space', buildings.flatMap((building) => building.spaces.map((space) => ({ ref: space.ref, fields: pick(space as unknown as Record<string, unknown>, ['name', 'usage', 'boundary', 'baseSlabRef', 'topBoundaryRef', 'locked']) })))],
    ['roof', buildings.map((building) => ({ ref: building.roof.ref, fields: pick(building.roof as unknown as Record<string, unknown>, ['type', 'baseElevationM', 'pitchDegrees', 'overhangM', 'footprint', 'finish']) }))],
    ['roof-segment', buildings.flatMap((building) => building.roof.segments.map((segment) => ({ ref: segment.ref, fields: pick(segment as unknown as Record<string, unknown>, ['footprint', 'storeyRef', 'spaceRef', 'baseElevationM', 'type', 'pitchDegrees', 'overhangM', 'ridgeDirection', 'finish']) })))],
    ['platform', buildings.flatMap((building) => building.platforms.map((platform) => ({ ref: platform.ref, fields: pick(platform as unknown as Record<string, unknown>, ['spaceRef', 'footprint', 'elevationM', 'thicknessM']) })))],
    ['ceiling-finish', buildings.flatMap((building) => building.ceilingFinishes.map((finish) => ({ ref: finish.ref, fields: pick(finish as unknown as Record<string, unknown>, ['spaceRef', 'hostBoundaryRef', 'elevationM', 'thicknessM']) })))],
    ['zone', project.landscape.zones.map((zone) => ({ ref: zone.ref, fields: pick(zone as unknown as Record<string, unknown>, ['name', 'kind', 'footprint', 'locked']) }))],
    ['plant', project.landscape.plants.map((plant) => ({ ref: plant.ref, fields: pick(plant as unknown as Record<string, unknown>, ['name', 'species', 'kind', 'position', 'matureHeightM', 'canopyM', 'locked']) }))],
    ['fixture', project.landscape.fixtures.map((fixture) => ({ ref: fixture.ref, fields: pick(fixture as unknown as Record<string, unknown>, ['catalogId', 'name', 'position', 'rotationDegrees', 'locked']) }))],
    ['climate', project.climateProfile.months.map((month) => ({ ref: `climate/month-${month.month}`, fields: pick(month as unknown as Record<string, unknown>, ['meanMinC', 'meanMaxC', 'temperatureByDayPartC', 'precipitationMm', 'sunshineHours', 'et0Mm', 'frostDays', 'windKph']) }))],
  ]
}

/** Object-level differences between two projects plus metric deltas; the change list is capped so tool output stays compact. */
export const diffProjects = (before: ProjectV2, after: ProjectV2, options: { maxChanges?: number } = {}): ProjectDiff => {
  const maxChanges = options.maxChanges ?? 40
  const changes: ProjectChange[] = []
  const beforeEntries = new Map(entries(before)); const afterEntries = new Map(entries(after))
  for (const [kind, previous] of beforeEntries) {
    const next = afterEntries.get(kind) ?? []
    const previousByRef = new Map(previous.map((entry) => [entry.ref, entry])); const nextByRef = new Map(next.map((entry) => [entry.ref, entry]))
    for (const entry of previous) {
      const counterpart = nextByRef.get(entry.ref)
      if (!counterpart) { changes.push({ kind, ref: entry.ref, change: 'removed' }); continue }
      const fields = Object.keys(entry.fields).filter((field) => JSON.stringify(entry.fields[field]) !== JSON.stringify(counterpart.fields[field]))
      if (fields.length) changes.push({ kind, ref: entry.ref, change: 'modified', fields })
    }
    for (const entry of next) if (!previousByRef.has(entry.ref)) changes.push({ kind, ref: entry.ref, change: 'added' })
  }
  const counts = { added: changes.filter((change) => change.change === 'added').length, removed: changes.filter((change) => change.change === 'removed').length, modified: changes.filter((change) => change.change === 'modified').length }
  const metricsBefore = calculateMetrics(before); const metricsAfter = calculateMetrics(after)
  const metricDeltas: ProjectDiff['metricDeltas'] = {}
  for (const key of Object.keys(metricsBefore) as Array<keyof ProjectMetrics>) {
    if (round(metricsBefore[key]) !== round(metricsAfter[key])) metricDeltas[key] = { before: round(metricsBefore[key]), after: round(metricsAfter[key]), delta: round(metricsAfter[key] - metricsBefore[key]) }
  }
  return { counts, changes: changes.slice(0, maxChanges), omittedChanges: Math.max(0, changes.length - maxChanges), metricDeltas }
}
