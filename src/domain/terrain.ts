import { z } from 'zod'
import { zielonkiClimate } from '../../knowledge-bank/zielonki/data'
import { GARDEN_FIXTURE_CATALOG_VERSION } from './gardenFixtures'
import { STARTER_ORCHARD_VERSION } from './orchard'
import { rectangle } from './geometry'
import { slugify } from './refs'
import type { ProjectV2, SiteKnowledgeBase } from './types'

/** Ref of the bundled Zielonki study; only this project receives the demo seeding (barn preset, starter garden, knowledge refresh). */
export const ZIELONKI_PROJECT_REF = 'project/zielonki-spatial-v2'
export const isZielonkiProject = (project: Pick<ProjectV2, 'ref'>) => project.ref === ZIELONKI_PROJECT_REF

const supportedTimezones = (() => { try { return new Set((Intl as unknown as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf?.('timeZone') ?? []) } catch { return new Set<string>() } })()
const isTimezone = (value: string) => {
  if (supportedTimezones.size) return supportedTimezones.has(value) || value === 'UTC'
  try { new Intl.DateTimeFormat('en', { timeZone: value }); return true } catch { return false }
}

/** What the start screen asks for: a rectangular plot centred on the model origin and where on Earth it stands. */
export const TerrainInputSchema = z.object({
  name: z.string().trim().min(1, 'Give the plot a name.').max(60, 'Keep the name under 60 characters.'),
  widthM: z.number().min(5, 'Width must be at least 5 m.').max(500, 'Width must be at most 500 m.'),
  depthM: z.number().min(5, 'Depth must be at least 5 m.').max(500, 'Depth must be at most 500 m.'),
  northDegrees: z.number().min(-180).max(180),
  latitude: z.number().min(-90, 'Latitude runs from -90 to 90.').max(90, 'Latitude runs from -90 to 90.'),
  longitude: z.number().min(-180, 'Longitude runs from -180 to 180.').max(180, 'Longitude runs from -180 to 180.'),
  timezone: z.string().min(1, 'Choose a timezone.').refine(isTimezone, 'Choose a known timezone such as Europe/Warsaw.'),
})
export type TerrainInput = z.infer<typeof TerrainInputSchema>

/** The defaults the form opens with: the Zielonki coordinates, a 30 by 40 m plot facing north. */
export const defaultTerrainInput: TerrainInput = { name: 'My plot', widthM: 30, depthM: 40, northDegrees: 0, latitude: zielonkiClimate.latitude, longitude: zielonkiClimate.longitude, timezone: zielonkiClimate.timezone }

/** A knowledge base that says plainly that nothing is known yet, so every knowledge tool and panel keeps working. */
export const blankKnowledgeBase = (name: string): SiteKnowledgeBase => ({
  datasetVersion: 'user-terrain-v1', locality: name, addressContext: 'Address not recorded', cadastralDistrict: 'Not recorded', coordinateSystem: 'Local model metres, origin at the plot centre', heightSystem: 'Local datum, 0 m at the plot centre',
  sourceCadOrigin: { easting: 0, northing: 0 }, sources: [], measurements: [],
  terrain: { datumElevationM: 0, observedRangeM: [0, 0], fallDirection: 'not surveyed', conceptualGradientPercent: 0 },
  geotechnical: { investigationDate: 'none', boreholes: [], weakBearingToApproxM: 0, groundwaterRangeM: [0, 0], foundationConcept: 'No ground investigation recorded; commission one before designing foundations.', documentationNeed: 'Geotechnical report required before construction design.', reportClassification: 'none', constraints: ['No ground investigation recorded for this plot.'] },
  planting: {
    strategy: ['Record soil tests and site observations before choosing plants.'],
    soilAnalysis: {
      summary: 'No soil analysis has been recorded for this plot. Test texture, drainage, pH and fertility before productive planting.',
      findings: [],
      testsNeeded: [
        { test: 'Composite topsoil laboratory test', reason: 'Measure pH, organic matter and available nutrients before amending the soil.' },
        { test: 'Percolation test', reason: 'Confirm drainage before placing beds, lawns and rain gardens.' },
      ],
      preparation: ['Keep imported topsoil separate from native soil until tests are back.', 'Use raised beds for food crops until drainage is confirmed.'],
    },
    recommendations: [], exclusions: [],
  },
  designRules: [], caveats: ['Site evidence is empty; every number here is a planning placeholder until surveys are added.'],
})

/** Builds an empty, schema-valid ProjectV2 for a rectangular plot at the given coordinates; climate months copy the bundled Zielonki normal. */
export const createTerrainProject = (input: TerrainInput, now = new Date()): ProjectV2 => {
  const values = TerrainInputSchema.parse(input)
  const name = values.name; const slug = slugify(name) || 'plot'
  const boundary = rectangle({ x: 0, z: 0 }, values.widthM, values.depthM)
  return {
    schemaVersion: 2, ref: `project/terrain-${slug}-${now.getTime().toString(36)}`, name, units: 'metric', revision: 1, updatedAt: now.toISOString(),
    site: {
      boundary, northDegrees: values.northDegrees,
      terrain: { boundary: structuredClone(boundary), elevationPoints: boundary.map((point) => ({ ...point, elevation: 0 })) },
      parcels: [{ ref: 'parcel/plot', cadastralNumber: 'unregistered', landRole: 'construction', officialAreaM2: Math.round(values.widthM * values.depthM), boundary: structuredClone(boundary), geometryConfidence: 'derived' }],
      entrances: [], knowledgeBase: blankKnowledgeBase(name),
    },
    buildings: [],
    landscape: { zones: [], plants: [], fixtures: [], fixtureCatalogVersion: GARDEN_FIXTURE_CATALOG_VERSION, orchardCatalogVersion: STARTER_ORCHARD_VERSION },
    climateProfile: {
      ...structuredClone(zielonkiClimate), ref: `climate/terrain-${slug}`, name: `${name} · Zielonki climate normal (edit before use)`,
      latitude: values.latitude, longitude: values.longitude, timezone: values.timezone,
      provenance: 'Monthly values copied from the bundled Zielonki normal (Open-Meteo, CC BY 4.0); coordinates and timezone entered by the person. Replace with local data before professional use.',
    },
  }
}
