import { zielonkiClimate, zielonkiKnowledgeBase, zielonkiPlot } from '../../knowledge-bank/zielonki/data'
import { rectangle } from './geometry'
import { ensureStarterGarden } from './gardenFixtures'
import type { BuildingModel, ProjectV2, WallModel } from './types'

const wall = (ref: string, start: { x: number; z: number }, end: { x: number; z: number }, openings: WallModel['openings'] = []): WallModel => ({
  ref, start, end, thicknessM: 0.24, baseElevationM: 0.45, heightM: 3, openings, finish: { material: 'light-render', colorHex: '#E8E1D2' }, locked: false,
})

const mainHouse: BuildingModel = {
  ref: 'house/main', name: 'Main house', kind: 'house', architecturalStyle: 'classic', position: { x: -1, z: -1 }, rotationDegrees: 0,
  storeys: [{
    ref: 'storey/ground', name: 'Ground storey', level: 0, elevationM: 0.45, clearHeightM: 3,
    baseSlabRef: 'slab/ground', topBoundaryRef: 'roof/main',
    wallRefs: ['wall/north-left', 'wall/north-right', 'wall/east', 'wall/south-right', 'wall/south-left', 'wall/west', 'wall/partition'],
    spaceRefs: ['space/living', 'space/kitchen-studio'], platformRefs: [], ceilingFinishRefs: [],
  }],
  slabs: [{ ref: 'slab/ground', footprint: rectangle({ x: 0, z: 0 }, 12, 9), topElevationM: 0.45, thicknessM: 0.3, locked: false }],
  walls: [
    wall('wall/north-left', { x: -6, z: -4.5 }, { x: 0, z: -4.5 }, [{ ref: 'opening/kitchen-window', kind: 'window', wallRef: 'wall/north-left', offsetM: 3, widthM: 1.8, heightM: 1.4, sillM: 0.9 }]),
    wall('wall/north-right', { x: 0, z: -4.5 }, { x: 6, z: -4.5 }, [{ ref: 'opening/living-window', kind: 'window', wallRef: 'wall/north-right', offsetM: 3, widthM: 3.2, heightM: 2.1, sillM: 0.55 }]),
    wall('wall/east', { x: 6, z: -4.5 }, { x: 6, z: 4.5 }, [{ ref: 'opening/living-door', kind: 'door', wallRef: 'wall/east', offsetM: 4.5, widthM: 1.8, heightM: 2.3, sillM: 0 }]),
    wall('wall/south-right', { x: 6, z: 4.5 }, { x: 0, z: 4.5 }),
    wall('wall/south-left', { x: 0, z: 4.5 }, { x: -6, z: 4.5 }, [{ ref: 'opening/studio-window', kind: 'window', wallRef: 'wall/south-left', offsetM: 3, widthM: 1.5, heightM: 1.5, sillM: 0.8 }]),
    wall('wall/west', { x: -6, z: 4.5 }, { x: -6, z: -4.5 }),
    wall('wall/partition', { x: 0, z: -4.5 }, { x: 0, z: 4.5 }, [{ ref: 'opening/internal-door', kind: 'door', wallRef: 'wall/partition', offsetM: 4.5, widthM: 0.9, heightM: 2.1, sillM: 0 }]),
  ],
  spaces: [
    { ref: 'space/kitchen-studio', name: 'Kitchen and studio', usage: 'work', boundary: [{ wallRef: 'wall/north-left', direction: 1 }, { wallRef: 'wall/partition', direction: 1 }, { wallRef: 'wall/south-left', direction: 1 }, { wallRef: 'wall/west', direction: 1 }], baseSlabRef: 'slab/ground', topBoundaryRef: 'roof/main', locked: false },
    { ref: 'space/living', name: 'Living room', usage: 'living', boundary: [{ wallRef: 'wall/north-right', direction: 1 }, { wallRef: 'wall/east', direction: 1 }, { wallRef: 'wall/south-right', direction: 1 }, { wallRef: 'wall/partition', direction: -1 }], baseSlabRef: 'slab/ground', topBoundaryRef: 'roof/main', locked: false },
  ],
  platforms: [], ceilingFinishes: [],
  roof: {
    ref: 'roof/main', type: 'gable', baseElevationM: 3.45, pitchDegrees: 28, overhangM: 0.45, finish: { material: 'standing-seam-metal', colorHex: '#3D4648' },
    segments: [{ ref: 'roof/main/segment-main', footprint: rectangle({ x: 0, z: 0 }, 12, 9), storeyRef: 'storey/ground', baseElevationM: 3.45, type: 'gable', pitchDegrees: 28, overhangM: 0.45, ridgeDirection: 'z', finish: { material: 'standing-seam-metal', colorHex: '#3D4648' }, adjacentSegmentRefs: [] }], junctions: [],
  },
}

export const sampleProject: ProjectV2 = {
  schemaVersion: 2,
  ref: 'project/zielonki-spatial-v2',
  name: 'Zielonki spatial editor',
  units: 'metric', revision: 1, updatedAt: '2026-09-02T00:00:00.000Z',
  site: {
    boundary: zielonkiPlot.boundary,
    northDegrees: zielonkiPlot.northDegrees,
    terrain: { boundary: zielonkiPlot.boundary, elevationPoints: zielonkiPlot.elevationPoints },
    parcels: zielonkiPlot.parcels,
    entrances: zielonkiPlot.entrances,
    knowledgeBase: zielonkiKnowledgeBase,
  },
  buildings: [mainHouse],
  landscape: {
    zones: [
      { ref: 'zone/terrace', name: 'South terrace', kind: 'terrace', footprint: rectangle({ x: 3, z: 6.1 }, 7.4, 3.4), locked: true },
      { ref: 'zone/lawn', name: 'Family lawn', kind: 'lawn', footprint: rectangle({ x: 5.2, z: 11.5 }, 13, 7), locked: false },
      { ref: 'zone/rain-garden', name: 'Rain garden', kind: 'rain-garden', footprint: rectangle({ x: -10, z: 12 }, 5.2, 3.4), locked: false },
      { ref: 'zone/driveway', name: 'Permeable drive', kind: 'driveway', footprint: rectangle({ x: -14.5, z: -4 }, 5, 18), locked: false },
      { ref: 'zone/path', name: 'Entry path', kind: 'path', footprint: rectangle({ x: -5, z: -5.5 }, 1.3, 10), locked: false },
    ],
    plants: [
      { ref: 'plant/apple', name: 'Old apple tree', species: 'Malus domestica', kind: 'tree', position: { x: 11, z: 11 }, matureHeightM: 5.5, canopyM: 5, sunNeed: 'sun', waterNeed: 0.8, hardinessMinC: -25, leafMonths: [4,5,6,7,8,9,10], bloomMonths: [4,5], locked: true, attachment: { hostRef: 'site/terrain', hostFace: 'terrain', localPosition: { x: 11, y: 0, z: 11 }, rotationDegrees: 0 } },
      { ref: 'plant/hornbeam-1', name: 'Hornbeam hedge', species: 'Carpinus betulus', kind: 'hedge', position: { x: -13.8, z: 2 }, matureHeightM: 2.2, canopyM: 7, sunNeed: 'partial', waterNeed: 0.65, hardinessMinC: -28, leafMonths: [4,5,6,7,8,9,10], bloomMonths: [], locked: false },
      { ref: 'plant/hydrangea', name: 'Hydrangea group', species: 'Hydrangea paniculata', kind: 'shrub', position: { x: -8.5, z: 8 }, matureHeightM: 1.8, canopyM: 2.4, sunNeed: 'partial', waterNeed: 1.15, hardinessMinC: -25, leafMonths: [4,5,6,7,8,9,10], bloomMonths: [7,8,9], locked: false },
      { ref: 'plant/sedge', name: 'Rain garden sedge', species: 'Carex spp.', kind: 'wetland', position: { x: -10, z: 12 }, matureHeightM: 0.7, canopyM: 2.4, sunNeed: 'sun', waterNeed: 1.2, hardinessMinC: -25, leafMonths: [3,4,5,6,7,8,9,10,11], bloomMonths: [5,6], locked: false },
    ], fixtures: [], fixtureCatalogVersion: 0,
  },
  climateProfile: zielonkiClimate,
}

const lBarnWall = (
  ref: string,
  start: { x: number; z: number },
  end: { x: number; z: number },
  openings: WallModel['openings'] = [],
  baseElevationM = 0.45,
  heightM = 3,
): WallModel => ({ ref, start, end, thicknessM: 0.24, baseElevationM, heightM, openings, finish: { material: 'charred-timber', colorHex: '#242927' }, locked: false })

const lBarnFootprint = [
  { x: -8, z: -5 }, { x: 8, z: -5 }, { x: 8, z: 1 },
  { x: -2, z: 1 }, { x: -2, z: 10 }, { x: -8, z: 10 },
]

const lShapedModernBarn: BuildingModel = {
  ref: 'house/main', name: 'L-shaped modern barn', kind: 'house', architecturalStyle: 'barn', position: { x: 0, z: -1 }, rotationDegrees: 0,
  storeys: [
    {
      ref: 'storey/ground', name: 'Ground storey', level: 0, elevationM: 0.45, clearHeightM: 3,
      baseSlabRef: 'slab/ground', topBoundaryRef: 'slab/upper',
      wallRefs: [
        'wall/back-left', 'wall/back-right', 'wall/east', 'wall/courtyard-right', 'wall/courtyard-left',
        'wall/courtyard-living', 'wall/front-glass', 'wall/west-living', 'wall/west-rear', 'wall/rear-partition', 'wall/wing-divider',
      ],
      spaceRefs: ['space/kitchen-studio', 'space/dining', 'space/living'], platformRefs: [], ceilingFinishRefs: [],
    },
    {
      ref: 'house/main/storey-upper', name: 'Upper storey', level: 1, elevationM: 3.45, clearHeightM: 3.1,
      baseSlabRef: 'slab/upper', topBoundaryRef: 'roof/main',
      wallRefs: ['wall/upper-north', 'wall/upper-east', 'wall/upper-front-glass', 'wall/upper-west'],
      spaceRefs: ['house/main/storey-upper/space-main'], platformRefs: [], ceilingFinishRefs: [],
    },
  ],
  slabs: [
    { ref: 'slab/ground', footprint: lBarnFootprint, topElevationM: 0.45, thicknessM: 0.3, locked: false },
    { ref: 'slab/upper', footprint: rectangle({ x: -5, z: 5.5 }, 6, 9), topElevationM: 3.45, thicknessM: 0.26, locked: false },
  ],
  walls: [
    lBarnWall('wall/back-left', { x: -8, z: -5 }, { x: 0, z: -5 }, [
      { ref: 'opening/kitchen-window', kind: 'window', wallRef: 'wall/back-left', offsetM: 4.5, widthM: 2.4, heightM: 1.55, sillM: 0.8 },
    ]),
    lBarnWall('wall/back-right', { x: 0, z: -5 }, { x: 8, z: -5 }, [
      { ref: 'opening/dining-window', kind: 'window', wallRef: 'wall/back-right', offsetM: 4, widthM: 3.8, heightM: 1.8, sillM: 0.65 },
    ]),
    lBarnWall('wall/east', { x: 8, z: -5 }, { x: 8, z: 1 }, [
      { ref: 'opening/east-door', kind: 'door', wallRef: 'wall/east', offsetM: 3, widthM: 1.2, heightM: 2.35, sillM: 0 },
    ]),
    lBarnWall('wall/courtyard-right', { x: 8, z: 1 }, { x: 0, z: 1 }, [
      { ref: 'opening/courtyard-window-east', kind: 'window', wallRef: 'wall/courtyard-right', offsetM: 1.65, widthM: 1.7, heightM: 1.55, sillM: 0.78 },
      { ref: 'opening/courtyard-balcony-door', kind: 'door', wallRef: 'wall/courtyard-right', offsetM: 4, widthM: 1.55, heightM: 2.35, sillM: 0.04 },
      { ref: 'opening/courtyard-window-west', kind: 'window', wallRef: 'wall/courtyard-right', offsetM: 6.35, widthM: 1.7, heightM: 1.55, sillM: 0.78 },
    ]),
    lBarnWall('wall/courtyard-left', { x: 0, z: 1 }, { x: -2, z: 1 }),
    lBarnWall('wall/courtyard-living', { x: -2, z: 1 }, { x: -2, z: 10 }, [
      { ref: 'opening/living-window-north', kind: 'window', wallRef: 'wall/courtyard-living', offsetM: 2.35, widthM: 1.8, heightM: 1.55, sillM: 0.78 },
      { ref: 'opening/living-balcony-door', kind: 'door', wallRef: 'wall/courtyard-living', offsetM: 6.4, widthM: 1.8, heightM: 2.35, sillM: 0.04 },
    ]),
    lBarnWall('wall/front-glass', { x: -2, z: 10 }, { x: -8, z: 10 }, [
      { ref: 'opening/front-ground-glass', kind: 'window', wallRef: 'wall/front-glass', offsetM: 3, widthM: 5.5, heightM: 2.8, sillM: 0.08 },
    ]),
    lBarnWall('wall/west-living', { x: -8, z: 10 }, { x: -8, z: 1 }),
    lBarnWall('wall/west-rear', { x: -8, z: 1 }, { x: -8, z: -5 }, [
      { ref: 'opening/service-window', kind: 'window', wallRef: 'wall/west-rear', offsetM: 3, widthM: 1.4, heightM: 1.4, sillM: 0.9 },
    ]),
    lBarnWall('wall/rear-partition', { x: 0, z: -5 }, { x: 0, z: 1 }, [
      { ref: 'opening/rear-internal', kind: 'door', wallRef: 'wall/rear-partition', offsetM: 3, widthM: 1.5, heightM: 2.35, sillM: 0 },
    ]),
    lBarnWall('wall/wing-divider', { x: -8, z: 1 }, { x: -2, z: 1 }, [
      { ref: 'opening/wing-internal', kind: 'door', wallRef: 'wall/wing-divider', offsetM: 3, widthM: 2.4, heightM: 2.5, sillM: 0 },
    ]),
    lBarnWall('wall/upper-north', { x: -8, z: 1 }, { x: -2, z: 1 }, [], 3.45, 3.1),
    lBarnWall('wall/upper-east', { x: -2, z: 1 }, { x: -2, z: 10 }, [
      { ref: 'opening/upper-east-north', kind: 'window', wallRef: 'wall/upper-east', offsetM: 2.35, widthM: 1.8, heightM: 1.55, sillM: 0.78 },
      { ref: 'opening/upper-east-south', kind: 'window', wallRef: 'wall/upper-east', offsetM: 6.65, widthM: 1.8, heightM: 1.55, sillM: 0.78 },
    ], 3.45, 3.1),
    lBarnWall('wall/upper-front-glass', { x: -2, z: 10 }, { x: -8, z: 10 }, [
      { ref: 'opening/front-upper-glass', kind: 'window', wallRef: 'wall/upper-front-glass', offsetM: 3, widthM: 5.5, heightM: 2.8, sillM: 0.12 },
    ], 3.45, 3.1),
    lBarnWall('wall/upper-west', { x: -8, z: 10 }, { x: -8, z: 1 }, [
      { ref: 'opening/upper-west-window', kind: 'window', wallRef: 'wall/upper-west', offsetM: 4.5, widthM: 1.4, heightM: 1.7, sillM: 0.75 },
    ], 3.45, 3.1),
  ],
  spaces: [
    {
      ref: 'space/kitchen-studio', name: 'Kitchen and studio', usage: 'work',
      boundary: [
        { wallRef: 'wall/back-left', direction: 1 }, { wallRef: 'wall/rear-partition', direction: 1 },
        { wallRef: 'wall/courtyard-left', direction: 1 }, { wallRef: 'wall/wing-divider', direction: -1 }, { wallRef: 'wall/west-rear', direction: 1 },
      ],
      baseSlabRef: 'slab/ground', topBoundaryRef: 'roof/main', locked: false,
    },
    {
      ref: 'space/dining', name: 'Dining and family room', usage: 'living',
      boundary: [
        { wallRef: 'wall/back-right', direction: 1 }, { wallRef: 'wall/east', direction: 1 },
        { wallRef: 'wall/courtyard-right', direction: 1 }, { wallRef: 'wall/rear-partition', direction: -1 },
      ],
      baseSlabRef: 'slab/ground', topBoundaryRef: 'roof/main', locked: false,
    },
    {
      ref: 'space/living', name: 'Double-height living room', usage: 'living',
      boundary: [
        { wallRef: 'wall/wing-divider', direction: 1 }, { wallRef: 'wall/courtyard-living', direction: 1 },
        { wallRef: 'wall/front-glass', direction: 1 }, { wallRef: 'wall/west-living', direction: 1 },
      ],
      baseSlabRef: 'slab/ground', topBoundaryRef: 'slab/upper', locked: false,
    },
    {
      ref: 'house/main/storey-upper/space-main', name: 'Upper gallery', usage: 'flex',
      boundary: [
        { wallRef: 'wall/upper-north', direction: 1 }, { wallRef: 'wall/upper-east', direction: 1 },
        { wallRef: 'wall/upper-front-glass', direction: 1 }, { wallRef: 'wall/upper-west', direction: 1 },
      ],
      baseSlabRef: 'slab/upper', topBoundaryRef: 'roof/main', locked: false,
    },
  ],
  platforms: [], ceilingFinishes: [],
  roof: {
    ref: 'roof/main', type: 'gable', baseElevationM: 6.55, pitchDegrees: 45, overhangM: 0.42, footprint: lBarnFootprint, finish: { material: 'standing-seam-metal', colorHex: '#2D3435' },
    segments: [
      {
        ref: 'roof/main/segment-upper-wing', footprint: [{ x: -8, z: 1 }, { x: -2, z: 1 }, { x: -2, z: 10 }, { x: -8, z: 10 }], storeyRef: 'house/main/storey-upper', spaceRef: 'house/main/storey-upper/space-main',
        baseElevationM: 6.55, type: 'gable', pitchDegrees: 45, overhangM: 0.42, ridgeDirection: 'z', finish: { material: 'standing-seam-metal', colorHex: '#2D3435' }, adjacentSegmentRefs: ['roof/main/segment-rear-wing'],
      },
      {
        ref: 'roof/main/segment-rear-wing', footprint: [{ x: -8, z: -5 }, { x: 8, z: -5 }, { x: 8, z: 1 }, { x: -8, z: 1 }], storeyRef: 'storey/ground',
        baseElevationM: 3.45, type: 'gable', pitchDegrees: 45, overhangM: 0.42, ridgeDirection: 'x', finish: { material: 'standing-seam-metal', colorHex: '#596164' }, adjacentSegmentRefs: ['roof/main/segment-upper-wing'],
      },
    ],
    junctions: [{ ref: 'roof/main/junction-upper-rear', type: 'valley', segmentRefs: ['roof/main/segment-upper-wing', 'roof/main/segment-rear-wing'] }],
  },
}

export const modernBarnProject: ProjectV2 = {
  ...ensureStarterGarden({
    ...structuredClone(sampleProject),
    name: 'Zielonki L-shaped barn study',
    buildings: [lShapedModernBarn],
    landscape: {
      ...structuredClone(sampleProject.landscape),
      zones: sampleProject.landscape.zones.map((zone) => zone.ref === 'zone/terrace'
        ? { ...zone, name: 'Sheltered L-courtyard terrace', footprint: rectangle({ x: 3, z: 2 }, 9, 4) }
        : zone.ref === 'zone/lawn'
          ? { ...zone, name: 'Open courtyard lawn', footprint: rectangle({ x: 4.5, z: 8 }, 12, 6) }
          : structuredClone(zone)),
      plants: sampleProject.landscape.plants.map((plant) => plant.ref === 'plant/apple'
        ? { ...structuredClone(plant), position: { x: -14, z: 12 }, attachment: plant.attachment ? { ...structuredClone(plant.attachment), localPosition: { x: -14, y: 0, z: 12 } } : undefined }
        : structuredClone(plant)),
    },
  }),
  revision: sampleProject.revision,
  updatedAt: sampleProject.updatedAt,
}
