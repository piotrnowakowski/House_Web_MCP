import { zielonkiClimate, zielonkiKnowledgeBase, zielonkiPlot } from '../../knowledge-bank/zielonki/data'
import { rectangle } from './geometry'
import { ensureStarterGarden } from './gardenFixtures'
import { applyModernBarnPreset } from './presets'
import type { BuildingModel, ProjectV2, WallModel } from './types'

const wall = (ref: string, start: { x: number; z: number }, end: { x: number; z: number }, openings: WallModel['openings'] = []): WallModel => ({
  ref, start, end, thicknessM: 0.24, baseElevationM: 0.45, heightM: 3, openings, locked: false,
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
  roof: { ref: 'roof/main', type: 'gable', baseElevationM: 3.45, pitchDegrees: 28, overhangM: 0.45 },
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

export const modernBarnProject: ProjectV2 = {
  ...ensureStarterGarden(applyModernBarnPreset(sampleProject)),
  revision: sampleProject.revision,
  updatedAt: sampleProject.updatedAt,
}
