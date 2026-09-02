import type { ClimateMonth, ProjectV1 } from './types'

const climateRows: Array<Omit<ClimateMonth, 'month'>> = [
  { meanMinC: -4.2, meanMaxC: 2.1, precipitationMm: 38, sunshineHours: 49, et0Mm: 8, frostDays: 20, windKph: 12 },
  { meanMinC: -3.1, meanMaxC: 4.1, precipitationMm: 34, sunshineHours: 72, et0Mm: 14, frostDays: 17, windKph: 12 },
  { meanMinC: 0.5, meanMaxC: 9.4, precipitationMm: 41, sunshineHours: 113, et0Mm: 35, frostDays: 9, windKph: 13 },
  { meanMinC: 4.8, meanMaxC: 15.2, precipitationMm: 49, sunshineHours: 154, et0Mm: 65, frostDays: 2, windKph: 11 },
  { meanMinC: 9.1, meanMaxC: 19.7, precipitationMm: 77, sunshineHours: 191, et0Mm: 91, frostDays: 0, windKph: 10 },
  { meanMinC: 12.8, meanMaxC: 23.0, precipitationMm: 86, sunshineHours: 207, et0Mm: 105, frostDays: 0, windKph: 9 },
  { meanMinC: 14.4, meanMaxC: 24.8, precipitationMm: 92, sunshineHours: 217, et0Mm: 116, frostDays: 0, windKph: 9 },
  { meanMinC: 13.7, meanMaxC: 24.0, precipitationMm: 72, sunshineHours: 203, et0Mm: 102, frostDays: 0, windKph: 8 },
  { meanMinC: 9.6, meanMaxC: 18.8, precipitationMm: 58, sunshineHours: 145, et0Mm: 62, frostDays: 0, windKph: 9 },
  { meanMinC: 5.3, meanMaxC: 13.1, precipitationMm: 48, sunshineHours: 99, et0Mm: 33, frostDays: 2, windKph: 10 },
  { meanMinC: 1.1, meanMaxC: 7.0, precipitationMm: 43, sunshineHours: 51, et0Mm: 15, frostDays: 10, windKph: 11 },
  { meanMinC: -2.6, meanMaxC: 2.9, precipitationMm: 41, sunshineHours: 39, et0Mm: 8, frostDays: 18, windKph: 12 },
]

export const zielonkiClimate = {
  ref: 'climate/zielonki-demo',
  name: 'Zielonki, Krakow — editable climate normal',
  latitude: 50.12,
  longitude: 19.92,
  timezone: 'Europe/Warsaw',
  provenance: 'Illustrative monthly normal prepared from ERA5/ERA5-Land variables exposed by Open-Meteo (CC BY 4.0). Edit before professional use.',
  soil: { texture: 'clay' as const, ph: null, drainage: 'slow' as const },
  irrigationMm: 18,
  months: climateRows.map((row, index) => ({ month: index + 1, ...row })),
}

export const sampleProject: ProjectV1 = {
  schemaVersion: 1,
  ref: 'project/zielonki-54-55-58',
  name: 'Zielonki 54/3 · 55/3 · 58/3',
  units: 'metric',
  revision: 1,
  updatedAt: '2026-09-02T00:00:00.000Z',
  plot: {
    boundary: [
      { x: 8.77, z: -15.63 }, { x: 18.21, z: -15.861 }, { x: 18.591, z: -6.318 },
      { x: 19.477, z: 15.883 }, { x: 0.8, z: 15.882 }, { x: -9.246, z: 15.882 },
      { x: -18.404, z: 15.882 }, { x: -18.403, z: 10.53 }, { x: -19.778, z: -15.1 },
      { x: -10.621, z: -15.591 }, { x: -0.838, z: -16.116 }, { x: 8.7, z: -16.628 },
    ],
    northDegrees: -56.7,
    elevationPoints: [
      { x: -19.2, z: -15.1, elevation: 0.51 },
      { x: 18.2, z: -15.9, elevation: 0.28 },
      { x: -13.33, z: -14.72, elevation: 0.58 },
      { x: -2.55, z: -9.99, elevation: 0.33 },
      { x: -5.96, z: 9.8, elevation: -0.08 },
      { x: -16.88, z: 14.01, elevation: 0 },
      { x: 19.3, z: 15.8, elevation: -0.42 },
    ],
    parcels: [
      {
        ref: 'parcel/54-3', cadastralNumber: '54/3', landRole: 'construction', officialAreaM2: 282, geometryConfidence: 'surveyed',
        boundary: [
          { x: -18.403, z: 10.53 }, { x: -19.778, z: -15.1 }, { x: -10.621, z: -15.591 },
          { x: -9.678, z: 7.33 }, { x: -9.246, z: 15.882 }, { x: -18.404, z: 15.882 },
        ],
      },
      {
        ref: 'parcel/55-3', cadastralNumber: '55/3', landRole: 'construction', officialAreaM2: 315, geometryConfidence: 'surveyed',
        boundary: [
          { x: -9.246, z: 15.882 }, { x: -9.678, z: 7.33 }, { x: -10.621, z: -15.591 },
          { x: -0.838, z: -16.116 }, { x: -0.397, z: -6.83 }, { x: 0.13, z: 3.156 }, { x: 0.8, z: 15.882 },
        ],
      },
      {
        ref: 'parcel/58-3', cadastralNumber: '58/3', landRole: 'construction', officialAreaM2: 603, geometryConfidence: 'surveyed',
        boundary: [
          { x: 8.7, z: -16.628 }, { x: 8.77, z: -15.63 }, { x: 18.21, z: -15.861 },
          { x: 18.591, z: -6.318 }, { x: 19.477, z: 15.883 }, { x: 0.8, z: 15.882 },
          { x: 0.13, z: 3.156 }, { x: -0.397, z: -6.83 }, { x: -0.838, z: -16.116 },
        ],
      },
      {
        ref: 'parcel/54-4', cadastralNumber: '54/4', landRole: 'agricultural', officialAreaM2: 1558, geometryConfidence: 'context-only',
        boundary: [{ x: -18.403, z: 15.882 }, { x: -9.246, z: 15.882 }, { x: -9.246, z: 186.012 }, { x: -18.403, z: 186.012 }],
      },
      {
        ref: 'parcel/55-4', cadastralNumber: '55/4', landRole: 'agricultural', officialAreaM2: 1458, geometryConfidence: 'context-only',
        boundary: [{ x: -9.246, z: 15.882 }, { x: 0.8, z: 15.882 }, { x: 0.8, z: 161.017 }, { x: -9.246, z: 161.017 }],
      },
      {
        ref: 'parcel/58-4', cadastralNumber: '58/4', landRole: 'agricultural', officialAreaM2: 993, geometryConfidence: 'context-only',
        boundary: [{ x: 0.8, z: 15.882 }, { x: 19.477, z: 15.882 }, { x: 19.477, z: 69.051 }, { x: 0.8, z: 69.05 }],
      },
    ],
  },
  knowledgeBase: {
    datasetVersion: 'zielonki-survey-2026-09-02',
    locality: 'Zielonki, Małopolskie, Poland',
    addressContext: 'Krakowskie Przedmieście, third line of development',
    cadastralDistrict: '120617_2.0018 Zielonki',
    coordinateSystem: 'PL-2000 zone 7',
    heightSystem: 'PL-EVRF2007-NH',
    sourceCadOrigin: { easting: 7421523.183, northing: 5556062.474 },
    sources: [
      {
        ref: 'source/project-map-v2', title: 'Zielonki_dz54_55_58-akt-v2 — map for design purposes', date: '2026-07-01',
        kind: 'survey-map', authority: 'official',
        summary: 'Scale 1:500 survey map prepared on 12 March 2026 and positively verified on 1 July 2026; source for parcel geometry, utilities and spot heights.',
      },
      {
        ref: 'source/subdivision-map', title: '06 Mapa z projektem podziału', date: '2026-03-31',
        kind: 'subdivision-map', authority: 'official',
        summary: 'Scale 1:1000 subdivision map; source for the official post-division parcel areas.',
      },
      {
        ref: 'source/working-measurements', title: 'Working DWG measurement overlay for suffix /3', date: '2026-08-25',
        kind: 'working-measurement', authority: 'working',
        summary: 'Three cross-site widths and one centreline depth calculated from the DWG; explicitly not covered by the surveyor signature.',
      },
      {
        ref: 'source/geotechnical-opinion', title: 'Geotechnical opinion for parcels 54, 55 and 58', date: '2026-01-01',
        kind: 'geotechnical-report', authority: 'professional',
        summary: 'Nine-page opinion based on two 3.5 m boreholes, including groundwater observations, profiles, parameters, conclusions and recommendations.',
      },
      {
        ref: 'source/geoanaliz-email', title: 'Geoanaliz specialist follow-up', date: '2026-07-24',
        kind: 'specialist-email', authority: 'professional',
        summary: 'Follow-up interpretation reporting weak-bearing soils to roughly 4.0 m and a current micropile concept reaching gravel at at least 5.5 m.',
      },
      {
        ref: 'source/user-land-role', title: 'Owner design brief', date: '2026-09-02',
        kind: 'user-direction', authority: 'user-provided',
        summary: 'Treat suffix /3 parcels as the house construction site and suffix /4 parcels as agricultural land.',
      },
    ],
    measurements: [
      { ref: 'measurement/54-3-area', label: 'Parcel 54/3 official area', value: 282, unit: 'm2', sourceRef: 'source/subdivision-map', confidence: 'official' },
      { ref: 'measurement/55-3-area', label: 'Parcel 55/3 official area', value: 315, unit: 'm2', sourceRef: 'source/subdivision-map', confidence: 'official' },
      { ref: 'measurement/58-3-area', label: 'Parcel 58/3 official area', value: 603, unit: 'm2', sourceRef: 'source/subdivision-map', confidence: 'official' },
      { ref: 'measurement/54-4-area', label: 'Parcel 54/4 official area', value: 1558, unit: 'm2', sourceRef: 'source/subdivision-map', confidence: 'official' },
      { ref: 'measurement/55-4-area', label: 'Parcel 55/4 official area', value: 1458, unit: 'm2', sourceRef: 'source/subdivision-map', confidence: 'official' },
      { ref: 'measurement/58-4-area', label: 'Parcel 58/4 official area', value: 993, unit: 'm2', sourceRef: 'source/subdivision-map', confidence: 'official' },
      { ref: 'measurement/build-width-1', label: 'Combined /3 width — road-side section', value: 28.5, unit: 'm', sourceRef: 'source/working-measurements', confidence: 'derived' },
      { ref: 'measurement/build-width-2', label: 'Combined /3 width — middle section', value: 33.2, unit: 'm', sourceRef: 'source/working-measurements', confidence: 'derived' },
      { ref: 'measurement/build-width-3', label: 'Combined /3 width — agricultural boundary', value: 37.9, unit: 'm', sourceRef: 'source/working-measurements', confidence: 'derived' },
      { ref: 'measurement/build-depth-axis', label: 'Combined /3 centreline depth', value: 32.3, unit: 'm', sourceRef: 'source/working-measurements', confidence: 'derived' },
    ],
    terrain: {
      datumElevationM: 246.5, observedRangeM: [246.2, 247.1], fallDirection: 'north-east to south-west', conceptualGradientPercent: 1.8,
    },
    geotechnical: {
      investigationDate: '2026-01', weakBearingToApproxM: 4, groundwaterRangeM: [1.6, 2.3],
      foundationConcept: 'Current specialist concept: indirect founding on micropiles bearing in gravel at a minimum depth of about 5.5 m; structural and geotechnical design must verify it.',
      documentationNeed: 'The specialist follow-up indicates that geological-engineering documentation will probably be required for the indirect-foundation solution.',
      reportClassification: 'The January opinion records a single-family house as geotechnical category I in complex ground conditions.',
      boreholes: [
        {
          ref: 'borehole/1', label: 'BH-1', position: { x: -8, z: -5 }, positionConfidence: 'map-derived', depthM: 3.5, groundwaterDepthM: 1.6,
          intervals: [
            { fromM: 0, toM: 0.4, material: 'Humus', condition: 'topsoil' },
            { fromM: 0.4, toM: 1.6, material: 'Silty clay', condition: 'moist, plastic; locally grey' },
            { fromM: 1.6, toM: 2.1, material: 'Peat', condition: 'black, wet organic layer' },
            { fromM: 2.1, toM: 3.5, material: 'Organic mud with silt inclusions', condition: 'moist, soft-plastic; base not reached' },
          ],
        },
        {
          ref: 'borehole/2', label: 'BH-2', position: { x: 8, z: 2 }, positionConfidence: 'map-derived', depthM: 3.5, groundwaterDepthM: 2.3,
          intervals: [
            { fromM: 0, toM: 0.4, material: 'Humus', condition: 'topsoil' },
            { fromM: 0.4, toM: 1.9, material: 'Silty clay', condition: 'moist, plastic, light brown' },
            { fromM: 1.9, toM: 2.3, material: 'Peat', condition: 'black, wet organic layer' },
            { fromM: 2.3, toM: 3.5, material: 'Organic mud', condition: 'moist, soft-plastic; base not reached' },
          ],
        },
      ],
      constraints: [
        'Groundwater was encountered at 1.6–2.3 m below ground and may fluctuate seasonally.',
        'Near-surface silty clays are sensitive to moisture change, disturbance and dynamic loading.',
        'Peat and organic mud are weak-bearing compressible layers; the boreholes did not penetrate their base by 3.5 m.',
        'No adverse mass-movement or other geodynamic phenomena were observed in the investigated area.',
      ],
    },
    designRules: [
      { rule: 'Keep the house and permanent building mass within parcels 54/3, 55/3 and 58/3.', basis: 'Owner brief; planning status still requires professional verification.', sourceRef: 'source/user-land-role' },
      { rule: 'Treat parcels 54/4, 55/4 and 58/4 as agricultural context, not as the house footprint.', basis: 'Owner brief.', sourceRef: 'source/user-land-role' },
      { rule: 'Flag every foundation proposal for geotechnical and structural review before it can be treated as feasible.', basis: 'Weak-bearing organic soils, shallow groundwater and specialist micropile recommendation.', sourceRef: 'source/geoanaliz-email' },
      { rule: 'Do not place conceptual infiltration or retention features beside foundations without a groundwater and drainage review.', basis: 'Groundwater range and moisture-sensitive clay.', sourceRef: 'source/geotechnical-opinion' },
    ],
    caveats: [
      'This knowledge bank is a concise planning extract, not a replacement for the signed source documents.',
      'The /3 parcel polygons were transformed from the v2 DWG into a local 3D coordinate system. The /4 display polygons preserve official areas but are context-only strips because the map-for-design-purpose drawing does not close their remote extents.',
      'The three widths and centreline depth are working measurements derived from DWG geometry and are not surveyor-signed dimensions.',
      'Borehole marker positions are digitised from the report map and should not be used for setting out.',
      'No soil pH test was found in the reviewed material; the climate profile therefore stores pH as unknown.',
      'The app provides conceptual design guidance only and does not establish zoning, building-law, foundation or drainage compliance.',
    ],
  },
  buildings: [{
    ref: 'house/main',
    name: 'Main house',
    kind: 'house',
    position: { x: -1, z: -1 },
    rotationDegrees: 0,
    roof: { type: 'gable', pitchDegrees: 28, overhangM: 0.45 },
    floors: [{
      ref: 'floor/ground',
      name: 'Ground floor',
      level: 0,
      elevationM: 0.45,
      defaultHeightM: 3,
      rooms: [
        {
          ref: 'room/living-room', name: 'Living room', usage: 'living', position: { x: 2.8, z: 0 }, widthM: 6.2, depthM: 5.4,
          heightM: 3.4, rotationDegrees: 0, ceilingType: 'flat', locked: false,
          openings: [
            { ref: 'opening/living-south', kind: 'window', wall: 'south', offsetM: 0, widthM: 3.2, heightM: 2.2 },
            { ref: 'opening/living-east', kind: 'door', wall: 'east', offsetM: 0, widthM: 1.8, heightM: 2.3 },
          ],
          mezzanines: [],
        },
        {
          ref: 'room/kitchen', name: 'Kitchen', usage: 'kitchen', position: { x: -2.5, z: 0.5 }, widthM: 4.4, depthM: 4.4,
          heightM: 3, rotationDegrees: 0, ceilingType: 'flat', locked: true,
          openings: [{ ref: 'opening/kitchen-north', kind: 'window', wall: 'north', offsetM: 0, widthM: 1.8, heightM: 1.4 }], mezzanines: [],
        },
        {
          ref: 'room/studio', name: 'Studio', usage: 'work', position: { x: -2.6, z: -3.6 }, widthM: 4.2, depthM: 2.8,
          heightM: 3, rotationDegrees: 0, ceilingType: 'flat', locked: false,
          openings: [{ ref: 'opening/studio-west', kind: 'window', wall: 'west', offsetM: 0, widthM: 1.5, heightM: 1.5 }], mezzanines: [],
        },
        {
          ref: 'room/utility', name: 'Utility', usage: 'utility', position: { x: 1.8, z: -4.1 }, widthM: 3.2, depthM: 2.1,
          heightM: 2.7, rotationDegrees: 0, ceilingType: 'lowered', locked: false, openings: [], mezzanines: [],
        },
      ],
    }],
  }],
  garden: {
    zones: [
      { ref: 'zone/terrace', name: 'South terrace', kind: 'terrace', position: { x: 3, z: 6.1 }, widthM: 7.4, depthM: 3.4, rotationDegrees: 0, locked: true },
      { ref: 'zone/lawn', name: 'Family lawn', kind: 'lawn', position: { x: 5.2, z: 12 }, widthM: 13, depthM: 8, rotationDegrees: -4, locked: false },
      { ref: 'zone/rain-garden', name: 'Rain garden', kind: 'rain-garden', position: { x: -10, z: 12 }, widthM: 5.2, depthM: 3.4, rotationDegrees: 12, locked: false },
      { ref: 'zone/driveway', name: 'Permeable drive', kind: 'driveway', position: { x: -10.2, z: -13 }, widthM: 5.6, depthM: 15, rotationDegrees: -6, locked: false },
      { ref: 'zone/path', name: 'Entry path', kind: 'path', position: { x: -5, z: -5.5 }, widthM: 1.3, depthM: 10, rotationDegrees: -42, locked: false },
    ],
    plants: [
      { ref: 'plant/apple', name: 'Old apple tree', species: 'Malus domestica', kind: 'tree', position: { x: 11, z: 11 }, matureHeightM: 5.5, canopyM: 5, sunNeed: 'sun', waterNeed: 0.8, hardinessMinC: -25, leafMonths: [4,5,6,7,8,9,10], bloomMonths: [4,5], locked: true },
      { ref: 'plant/hornbeam-1', name: 'Hornbeam hedge', species: 'Carpinus betulus', kind: 'hedge', position: { x: -13.8, z: 2 }, matureHeightM: 2.2, canopyM: 7, sunNeed: 'partial', waterNeed: 0.65, hardinessMinC: -28, leafMonths: [4,5,6,7,8,9,10], bloomMonths: [], locked: false },
      { ref: 'plant/hydrangea', name: 'Hydrangea group', species: 'Hydrangea paniculata', kind: 'shrub', position: { x: -8.5, z: 8 }, matureHeightM: 1.8, canopyM: 2.4, sunNeed: 'partial', waterNeed: 1.15, hardinessMinC: -25, leafMonths: [4,5,6,7,8,9,10], bloomMonths: [7,8,9], locked: false },
      { ref: 'plant/sedge', name: 'Rain garden sedge', species: 'Carex spp.', kind: 'wetland', position: { x: -10, z: 12 }, matureHeightM: 0.7, canopyM: 2.4, sunNeed: 'sun', waterNeed: 1.2, hardinessMinC: -25, leafMonths: [3,4,5,6,7,8,9,10,11], bloomMonths: [5,6], locked: false },
    ],
  },
  climateProfile: zielonkiClimate,
}
