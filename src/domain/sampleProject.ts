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
  soil: { texture: 'loam' as const, ph: 6.6, drainage: 'balanced' as const },
  irrigationMm: 18,
  months: climateRows.map((row, index) => ({ month: index + 1, ...row })),
}

export const sampleProject: ProjectV1 = {
  schemaVersion: 1,
  ref: 'project/zielonki-courtyard',
  name: 'Zielonki Courtyard House',
  units: 'metric',
  revision: 1,
  updatedAt: '2026-09-02T00:00:00.000Z',
  plot: {
    boundary: [
      { x: -18, z: -23 }, { x: 15, z: -24 }, { x: 19, z: 18 }, { x: 7, z: 24 }, { x: -17, z: 21 },
    ],
    northDegrees: 8,
    elevationPoints: [
      { x: -18, z: -23, elevation: 0.1 },
      { x: 15, z: -24, elevation: -0.2 },
      { x: 19, z: 18, elevation: 0.8 },
      { x: -17, z: 21, elevation: 1.25 },
      { x: 0, z: 0, elevation: 0.35 },
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
