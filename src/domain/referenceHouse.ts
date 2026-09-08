import { offsetPolygon, pointOnSegment, splitPolygonEdges, wallLength } from './geometry'
import { createTerrainProject, defaultTerrainInput } from './terrain'
import type { BuildingModel, InteriorCatalogId, Polygon2, ProjectV2, SpaceBoundaryUse, StoreyModel, Vec2 } from './types'

export const REFERENCE_HOUSE_REF = 'project/reference-house-september-2026'
const polygon = (pairs: number[][]): Polygon2 => pairs.map(([x, z]) => ({ x, z }))
const rect = (x1: number, z1: number, x2: number, z2: number) => polygon([[x1, z1], [x2, z1], [x2, z2], [x1, z2]])
const near = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.z - b.z) < 0.00001

/** The source screenshots use inside-face dimensions. These coordinates explicitly include wall thickness. */
export function createReferenceHouse(): ProjectV2 {
  const project = createTerrainProject({ ...defaultTerrainInput, name: 'Dom z planów · September 2026', widthM: 30, depthM: 40 })
  project.ref = REFERENCE_HOUSE_REF
  const groundOutline = polygon([[-0.1, -0.1], [10.89, -0.1], [10.89, 7.45], [7.38, 7.45], [7.38, 18.01], [-0.1, 18.01]])
  const upperOutline = polygon([[-0.1, -0.1], [10.98, -0.1], [10.98, 7.45], [7.48, 7.45], [7.48, 14.84], [-0.1, 14.84]])
  const finish = { material: 'membrane' as const, colorHex: '#626966' }
  const building: BuildingModel = {
    ref: 'building/reference-house', name: 'Dom z planów', kind: 'house', garageMode: 'integrated', architecturalStyle: 'classic',
    position: { x: -5.4, z: -9 }, rotationDegrees: 0, storeys: [], walls: [], spaces: [], furniture: [], platforms: [], ceilingFinishes: [],
    slabs: [
      { ref: 'slab/reference-ground', footprint: offsetPolygon(groundOutline, -0.1), topElevationM: 0, thicknessM: 0.2, locked: false },
      { ref: 'slab/reference-upper', footprint: offsetPolygon(upperOutline, -0.1), holes: [rect(0.01, 4.71, 3.16, 5.55)], topElevationM: 3, thicknessM: 0.2, locked: false },
    ],
    roof: { ref: 'roof/reference', type: 'flat', baseElevationM: 5.8, pitchDegrees: 0, overhangM: 0, footprint: upperOutline, finish,
      segments: [{ ref: 'roof/reference/provisional-cap', footprint: upperOutline, storeyRef: 'storey/reference-upper', baseElevationM: 5.8, type: 'flat', pitchDegrees: 0, overhangM: 0, ridgeDirection: 'z', finish, adjacentSegmentRefs: [] }], junctions: [] },
    stairs: [{ ref: 'stairs/reference-main', fromStoreyRef: 'storey/reference-ground', toStoreyRef: 'storey/reference-upper', start: { x: 0, z: 4.61 }, runM: 3.16, widthM: 0.94, steps: 16 }],
  }
  type Room = { id: string; name: string; usage: string; outline: Polygon2 }
  const floor = (id: string, name: string, level: number, rooms: Room[]) => {
    const storey: StoreyModel = { ref: `storey/reference-${id}`, name, level, elevationM: level * 3, clearHeightM: 2.8,
      baseSlabRef: `slab/reference-${id}`, topBoundaryRef: level ? building.roof.ref : 'slab/reference-upper', wallRefs: [], spaceRefs: [], platformRefs: [], ceilingFinishRefs: [] }
    building.storeys.push(storey)
    rooms.forEach((room) => {
      const points = rooms.reduce((points, other) => splitPolygonEdges(points, other.outline), room.outline)
      const boundary: SpaceBoundaryUse[] = points.map((start, i) => {
        const end = points[(i + 1) % points.length]
        const existing = building.walls.find((wall) => storey.wallRefs.includes(wall.ref) && ((near(start, wall.start) && near(end, wall.end)) || (near(end, wall.start) && near(start, wall.end))))
        if (existing) return { wallRef: existing.ref, direction: near(start, existing.start) ? 1 : -1 }
        const ref = `wall/reference-${id}/${storey.wallRefs.length + 1}`
        const thick = level === 1 && Math.abs(start.x - 3.68) < 0.001 && Math.abs(end.x - 3.68) < 0.001 ? 0.32 : 0.2
        building.walls.push({ ref, start, end, thicknessM: thick, baseElevationM: storey.elevationM, heightM: storey.clearHeightM, openings: [], locked: false, finish: { material: 'light-render', colorHex: '#E5E9E8', textureId: 'none' } })
        storey.wallRefs.push(ref); return { wallRef: ref, direction: 1 }
      })
      const ref = `space/reference-${room.id}`; storey.spaceRefs.push(ref)
      building.spaces.push({ ref, name: room.name, usage: room.usage, boundary, baseSlabRef: storey.baseSlabRef, topBoundaryRef: storey.topBoundaryRef, locked: false })
    })
    return storey
  }
  const ground = floor('ground', 'Parter', 0, [
    { id: 'living', name: 'Salon, kuchnia i hol', usage: 'living', outline: polygon([[-0.1, -0.1], [10.89, -0.1], [10.89, 7.45], [4.4, 7.45], [4.4, 9.24], [-0.1, 9.24]]) },
    { id: 'pantry', name: 'Pom. gospodarcze', usage: 'utility', outline: rect(-0.1, 9.24, 1.94, 11.61) },
    { id: 'wc', name: 'Łazienka parter', usage: 'bathroom', outline: rect(1.94, 9.24, 4.4, 11.61) },
    { id: 'office', name: 'Gabinet', usage: 'office', outline: rect(4.4, 7.45, 7.38, 11.61) },
    { id: 'garage', name: 'Garaż', usage: 'garage', outline: rect(-0.1, 11.61, 7.38, 18.01) },
  ])
  building.walls.push({ ref: 'wall/reference-stair-partition', start: { x: -0.1, z: 5.66 }, end: { x: 3.16, z: 5.66 }, thicknessM: 0.2, baseElevationM: 0, heightM: 2.8, locked: false, openings: [] })
  ground.wallRefs.push('wall/reference-stair-partition')
  const upper = floor('upper', 'Piętro', 1, [
    { id: 'parents', name: 'Sypialnia rodziców', usage: 'bedroom', outline: rect(-0.1, -0.1, 5.25, 4.6) },
    { id: 'mezzanine', name: 'Antresola nad salonem', usage: 'mezzanine', outline: rect(5.25, -0.1, 10.98, 7.45) },
    { id: 'landing', name: 'Hol i schody', usage: 'hall', outline: polygon([[-0.1, 4.6], [5.25, 4.6], [5.25, 10.57], [2.2, 10.57], [2.18, 7.02], [-0.1, 7.02]]) },
    { id: 'laundry', name: 'Pralnia / garderoba', usage: 'utility', outline: polygon([[-0.1, 7.02], [2.18, 7.02], [2.2, 10.57], [-0.1, 10.57]]) },
    { id: 'bathroom', name: 'Łazienka piętro', usage: 'bathroom', outline: rect(5.25, 7.45, 7.48, 10.57) },
    { id: 'child-one', name: 'Pokój dzieci 1', usage: 'bedroom', outline: rect(-0.1, 10.57, 3.68, 14.84) },
    { id: 'child-two', name: 'Pokój dzieci 2', usage: 'bedroom', outline: rect(3.68, 10.57, 7.48, 14.84) },
  ])
  const opening = (storey: StoreyModel, id: string, kind: 'door' | 'window', x: number, z: number, widthM: number, sillM = 0, heightM = kind === 'door' ? 2.1 : 2.35) => {
    const wall = building.walls.find((wall) => storey.wallRefs.includes(wall.ref) && pointOnSegment({ x, z }, wall.start, wall.end))
    if (!wall) throw new Error(`Missing reference wall for ${id}`)
    const offsetM = Math.hypot(x - wall.start.x, z - wall.start.z)
    if (offsetM - widthM / 2 < 0 || offsetM + widthM / 2 > wallLength(wall)) throw new Error(`Opening crosses a wall join: ${id}`)
    wall.openings.push({ ref: `opening/reference-${id}`, kind, wallRef: wall.ref, offsetM, widthM, sillM, heightM })
  }
  opening(ground, 'terrace-north', 'window', 4.25, -0.1, 4.5)
  opening(ground, 'terrace-east', 'window', 10.89, 3.55, 5.3)
  opening(ground, 'kitchen', 'window', -0.1, 2.5, 3.4, 1.05, 1.2)
  opening(ground, 'entrance', 'door', -0.1, 7.92, 1.1)
  opening(ground, 'pantry', 'door', 1.22, 9.24, 0.9)
  opening(ground, 'wc', 'door', 2.78, 9.24, 0.9)
  opening(ground, 'office', 'door', 4.4, 8.57, 0.9)
  opening(ground, 'office-window', 'window', 7.38, 9.35, 1.4, 0.8, 1.5)
  opening(ground, 'garage-access', 'door', 1.2, 11.61, 0.9)
  opening(ground, 'garage-gate', 'door', 3.64, 18.01, 6.36, 0, 2.4)
  opening(upper, 'parents', 'door', 4.48, 4.6, 0.9)
  opening(upper, 'laundry', 'door', 2.185, 7.9075, 0.8)
  opening(upper, 'bathroom', 'door', 5.25, 8.55, 0.9)
  opening(upper, 'child-one', 'door', 2.95, 10.57, 0.9)
  opening(upper, 'child-two', 'door', 4.5, 10.57, 0.9)
  opening(upper, 'children-west-window', 'window', 2.48, 14.84, 2.0, 0.8, 1.5)
  opening(upper, 'children-east-window', 'window', 4.77, 14.84, 1.95, 0.8, 1.5)
  // A pass-through is necessary to reach the mezzanine; its position is inferred (not visible on the plan).
  opening(upper, 'mezzanine-access', 'door', 5.25, 6.15, 1.1)
  const item = (id: string, catalogId: InteriorCatalogId, name: string, x: number, z: number, widthM: number, depthM: number, heightM: number, rotationDegrees = 0, color = '#bda17a', storeyRef = ground.ref) => {
    building.furniture!.push({ ref: `interior/reference-${id}`, catalogId, storeyRef, name, position: { x, z }, widthM, depthM, heightM, rotationDegrees, color })
  }
  item('sofa', 'corner-sofa', 'Narożnik turkusowy', 7.95, 2.24, 3.45, 2.52, 0.88, 0, '#207b8a')
  item('media', 'tv-unit', 'Szafka RTV i telewizor', 8.8, 0.34, 3.35, 0.5, 1.15, 0, '#364149')
  item('dining', 'dining-table', 'Stół i sześć krzeseł', 7.85, 5.04, 2, 1.62, 0.85)
  item('island', 'kitchen-island', 'Wyspa 1.28 × 2.92 m', 2.51, 2.35, 1.28, 2.92, 0.92)
  item('stool-one', 'bar-stool', 'Hoker 1', 3.58, 1.5, 0.46, 0.46, 0.75)
  item('stool-two', 'bar-stool', 'Hoker 2', 3.58, 2.74, 0.46, 0.46, 0.75)
  item('cabinet-one', 'kitchen-counter', 'Szafka kuchenna', 0.325, 0.48, 0.95, 0.65, 0.9, 90)
  item('sink', 'sink', 'Zlew kuchenny', 0.325, 1.43, 0.95, 0.65, 0.9, 90)
  item('counter', 'kitchen-counter', 'Blat kuchenny', 0.325, 2.84, 1.84, 0.65, 0.9, 90)
  item('fridge', 'fridge', 'Lodówka', 0.325, 4.18, 0.84, 0.65, 1.9, 90)
  item('understairs', 'wardrobe', 'Zabudowa pod schodami', 1.58, 6.07, 3.16, 0.62, 1.65)
  item('office-sofa', 'sofa', 'Sofa w gabinecie', 6.34, 8.03, 1.72, 0.92, 0.82, 0, '#796d7f')
  item('office-storage', 'wardrobe', 'Szafa w gabinecie', 4.78, 10.34, 2.27, 0.54, 2.2, 90)
  item('desk', 'desk', 'Biurko w gabinecie', 6.16, 11.16, 2.1, 0.65, 0.75, 0, '#353d42')
  item('office-chair', 'bar-stool', 'Krzesło biurowe', 6.16, 10.4, 0.5, 0.5, 0.48)
  item('utility-storage', 'wardrobe', 'Czerwona zabudowa gospodarcza', 0.36, 10.4, 1.95, 0.65, 1.85, 90, '#c9353d')
  item('wc-sink', 'vanity', 'Umywalka parter', 4.08, 9.74, 0.56, 0.42, 0.84, -90)
  item('toilet', 'toilet', 'WC parter', 3.95, 10.24, 0.44, 0.7, 0.8, -90, '#eeefeb')
  item('shower', 'shower', 'Prysznic parter', 3.77, 10.98, 1.05, 1.05, 2.1, 180)
  item('car', 'car', 'Samochód w garażu', 2, 14.55, 1.85, 4.5, 1.45, 0, '#b5bec4')
  item('garage-storage', 'wardrobe', 'Regały garażowe', 6.98, 14.81, 6.15, 0.55, 2.1, -90)
  item('parents-bed', 'bed', 'Łóżko rodziców', 1.15, 2.04, 1.8, 2.1, 1, 90, '#287a89', upper.ref)
  project.buildings = [building]
  const zone = (id: string, name: string, kind: 'terrace' | 'driveway', footprint: Polygon2) => ({ ref: `zone/reference-${id}`, name, kind, footprint: footprint.map((p) => ({ x: p.x + building.position.x, z: p.z + building.position.z })), locked: false, textureId: 'coated-pine' })
  project.landscape.zones = [zone('terrace', 'Taras przy salonie', 'terrace', polygon([[-0.2, -4.2], [14.7, -4.2], [14.7, 7.55], [10.99, 7.55], [10.99, -0.2], [-0.2, -0.2]])), zone('driveway', 'Podjazd 6.36 × 5.08 m', 'driveway', rect(0.46, 18.11, 6.82, 23.19))]
  // Keep the contextual site large enough for the front approach; it is not a surveyed plot.
  project.buildings[0].position.z = -11
  project.landscape.zones.forEach((zone) => zone.footprint.forEach((p) => { p.z -= 2 }))
  const kb = project.site.knowledgeBase
  kb.datasetVersion = 'reference-house-v1'
  kb.sources = [{ ref: 'source/user-floorplans', title: '18 user supplied floor plans and interior views', date: '2026-09-08', kind: 'user-direction', authority: 'user-provided', summary: 'Printed metre dimensions take precedence over scaled screenshot estimates. See docs/reference-house-dimensions.md for the reconstruction ledger.' }]
  kb.measurements = [
    ['Living main width', 10.79, 'm'], ['Living main depth', 7.35, 'm'], ['Living net area', 86.37, 'm2'],
    ['Garage width', 7.28, 'm'], ['Garage depth', 6.2, 'm'], ['Garage net area', 45.14, 'm2'],
    ['Office width', 2.78, 'm'], ['Office depth', 3.96, 'm'], ['Pantry width', 1.84, 'm'], ['Bathroom width', 2.26, 'm'], ['Service rooms depth', 2.17, 'm'],
    ['Island width', 1.28, 'm'], ['Island length', 2.92, 'm'], ['Kitchen aisle', 1.22, 'm'], ['Stair run', 3.16, 'm'], ['Stair width', 0.94, 'm'],
    ['Parents bedroom width', 5.15, 'm'], ['Mezzanine width', 5.53, 'm'], ['Mezzanine depth', 7.35, 'm'], ['Upstairs bathroom width', 2.03, 'm'], ['Upstairs bathroom depth', 2.92, 'm'],
    ['Child bedroom 1 width', 3.52, 'm'], ['Child bedroom 2 width', 3.54, 'm'], ['Child bedrooms depth', 4.07, 'm'],
  ].map(([label, value, unit], i) => ({ ref: `measurement/reference-${i}`, label: label as string, value: value as number, unit: unit as 'm' | 'm2', sourceRef: 'source/user-floorplans', confidence: 'derived' }))
  kb.caveats = [
    'Reconstructed from screenshots in metres. Printed dimensions are reproduced; unlabelled positions are estimated. This is not a surveyed or construction model.',
    'Ceilings: provisional 2.80 m on each floor, with a 0.20 m floor slab. Roof shape, site size (30 × 40 m), orientation and location are placeholders.',
    'Ground-floor clear sizes: garage 7.28 × 6.20 m; office 2.78 × 3.96 m; utility 1.84 × 2.17 m; bathroom 2.26 × 2.17 m. Living area 86.37 m² includes the hall and excludes the stair partition.',
    'Upstairs: bedroom 5.15 × 4.50 m; mezzanine 5.53 × 7.35 m; bathroom 2.03 × 2.92 m. Laundry tapers from 2.08 to 2.10 m over 3.35 m.',
    'Upper plan discrepancies: first child room computes to 14.33 m² from 3.52 × 4.07 m, versus the printed 14.37 m². Upper footprint is 9–10 cm wider than the ground floor to preserve printed room widths; the child-room partition is inferred at 32 cm.',
    'Stair position follows the 3.16 × 0.94 m ground plan. The upper opening is narrowed by 10 cm at the bedroom wall. Riser count (16), landing geometry and the mezzanine access door are inferred; the source shows no access opening to the mezzanine.',
    'Windows, door widths, furniture heights, finishes, car dimensions and terrace edges are estimated from the views. Island 1.28 × 2.92 m and the 1.22 m kitchen aisle follow the dimension close-ups. Furniture upstairs follows the sparse reference: one parents’ bed.',
  ]
  return project
}
