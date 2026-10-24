import { buildingBaseElevation, buildingFootprintsWorld, offsetPolygon, polygonArea, polygonBounds, polygonCentroid, polygonPerimeter } from './geometry'
import { gardenFixtureById } from './gardenFixtures'
import { interiorCorners } from './interior'
import { transformedPoint } from './precisionEdits'
import { highestRoofElevation } from './roofs'
import { isExteriorWall } from './zielonkiInterior'
import type { Polygon2, ProjectV2, Vec2 } from './types'

export const sitePlanCategories = ['Działka', 'Budynki', 'Dachy', 'Nawierzchnie', 'Wyposażenie', 'Ogrodzenie', 'Bramy i furtki', 'Rośliny', 'Okna i drzwi'] as const
export type SitePlanCategory = typeof sitePlanCategories[number]
export interface SitePlanElement {
  ref: string; name: string; category: SitePlanCategory; points: Polygon2
  summary: string; note?: string; heightM?: number; diameterM?: number
  color: string; priority: number; developed: boolean
}
export const planNumber = (value: number) => value.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
export const planMetres = (value: number) => `${planNumber(value)} m`
const size = (width: number, depth: number) => `${planNumber(width)} × ${planNumber(depth)} m`
const areaSummary = (points: Polygon2) => `${planNumber(polygonArea(points))} m² · obw. ${planMetres(polygonPerimeter(points))}`
const zoneColors = { lawn: '#e1ebd8', terrace: '#ddc9ad', path: '#e4ddcd', driveway: '#c9cecb', bed: '#c4b29d', 'rain-garden': '#b8d7d2', vegetable: '#c6d9b0' }

/** Read-only projections of the same semantic objects used by the 3D scene. */
export function sitePlanElements(project: ProjectV2): SitePlanElement[] {
  const elements: SitePlanElement[] = [{ ref: 'site', name: 'Granica całej działki', category: 'Działka', points: project.site.boundary, summary: areaSummary(project.site.boundary), color: '#f3f4e9', priority: 1, developed: false }]
  for (const parcel of project.site.parcels) elements.push({ ref: parcel.ref, name: `Działka ewidencyjna ${parcel.cadastralNumber}`, category: 'Działka', points: parcel.boundary, summary: areaSummary(parcel.boundary), note: 'Powierzchnia obrysu w modelu.', color: 'none', priority: 0, developed: false })
  for (const zone of project.landscape.zones) elements.push({ ref: zone.ref, name: zone.name, category: 'Nawierzchnie', points: zone.footprint, summary: areaSummary(zone.footprint), color: zoneColors[zone.kind], priority: zone.kind === 'lawn' ? 0 : 3, developed: zone.kind !== 'lawn' })
  for (const building of project.buildings) {
    const transform = (p: Vec2) => transformedPoint(p, { x: 0, z: 0 }, building.position, building.rotationDegrees)
    const lowest = Math.min(...building.slabs.map(s => s.topElevationM))
    const footprints = buildingFootprintsWorld(building)
    building.slabs.forEach((slab, index) => {
      if (slab.topElevationM !== lowest) return
      const bounds = polygonBounds(slab.footprint)
      elements.push({ ref: slab.ref, name: building.name, category: 'Budynki', points: footprints[index], summary: size(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ), heightM: highestRoofElevation(building) - buildingBaseElevation(building), note: 'Obrys płyty parteru; wysokość od spodu najniższej płyty do szczytu dachu w modelu.', color: '#b9c4c9', priority: 10, developed: true })
    })
    for (const [index, roof] of building.roof.segments.entries()) {
      const outline = offsetPolygon(roof.footprint, -roof.overhangM), bounds = polygonBounds(outline)
      elements.push({ ref: roof.ref, name: `Dach ${index + 1} · ${building.name}`, category: 'Dachy', points: outline.map(transform), summary: size(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ), note: `Rzut poziomy z okapem ${planMetres(roof.overhangM)}; nachylenie ${planNumber(roof.pitchDegrees)}°.`, color: '#dee1e5', priority: 2, developed: true })
    }
    if (!building.walls.length) for (const item of building.furniture ?? []) {
      elements.push({ ref: item.ref, name: item.name, category: 'Wyposażenie', points: interiorCorners(item).map(transform), summary: size(item.widthM, item.depthM), heightM: item.heightM, note: 'Wyposażenie otwartej wiaty.', color: '#d5d4c5', priority: 2, developed: true })
    }
    for (const wall of building.walls.filter(w => w.openings.length && isExteriorWall(building, w))) {
      const length = Math.hypot(wall.end.x - wall.start.x, wall.end.z - wall.start.z)
      if (!length) continue
      for (const opening of wall.openings) {
        const points = [-1, 1].map(side => {
          const t = (opening.offsetM + side * opening.widthM / 2) / length
          return transform({ x: wall.start.x + (wall.end.x - wall.start.x) * t, z: wall.start.z + (wall.end.z - wall.start.z) * t })
        })
        const floor = building.storeys.find(s => s.wallRefs.includes(wall.ref))
        elements.push({ ref: opening.ref, name: `${opening.kind === 'window' ? 'Okno' : 'Drzwi'} · ${floor?.name ?? ''} · ${building.name}`, category: 'Okna i drzwi', points, summary: `${planMetres(opening.widthM)} szer.`, heightM: opening.heightM, note: `Parapet / próg: ${planMetres(opening.sillM)} nad podstawą ściany.`, color: '#368695', priority: 1, developed: true })
      }
    }
  }
  for (const fixture of project.landscape.fixtures) {
    const definition = gardenFixtureById(fixture.catalogId)
    const undergroundStudy = fixture.catalogId.endsWith('-study')
    // The study's 3D height is only its visible cover, not the underground tank depth.
    elements.push({ ref: fixture.ref, name: fixture.name, category: 'Wyposażenie', points: interiorCorners({ ...fixture, ...definition, rotationDegrees: -fixture.rotationDegrees }), summary: size(definition.widthM, definition.depthM), heightM: undergroundStudy ? undefined : definition.heightM, note: undergroundStudy ? `${definition.description} Głębokość zabudowy nie została określona.` : 'Gabaryt katalogowy w rzucie poziomym.', color: fixture.catalogId === 'solar-table-20' ? '#8eaec6' : undergroundStudy ? '#abd1d0' : '#cfb99b', priority: 8, developed: true })
  }
  for (const fence of project.site.fences ?? []) elements.push({ ref: fence.ref, name: fence.name, category: 'Ogrodzenie', points: [fence.start, fence.end], summary: planMetres(Math.hypot(fence.end.x - fence.start.x, fence.end.z - fence.start.z)), heightM: fence.heightM, color: '#4c5d55', priority: 4, developed: false })
  for (const entrance of project.site.entrances) elements.push({ ref: entrance.ref, name: entrance.name, category: 'Bramy i furtki', points: [entrance.start, entrance.end], summary: planMetres(Math.hypot(entrance.end.x - entrance.start.x, entrance.end.z - entrance.start.z)), heightM: entrance.gate?.heightM, color: '#b67430', priority: 9, developed: false })
  for (const plant of project.landscape.plants) {
    const r = plant.canopyM / 2
    elements.push({ ref: plant.ref, name: plant.name, category: 'Rośliny', points: [{ x: plant.position.x - r, z: plant.position.z }, { x: plant.position.x + r, z: plant.position.z }], diameterM: plant.canopyM, summary: `Ø ${planMetres(plant.canopyM)}`, heightM: plant.matureHeightM, note: `${plant.species} · korona i wysokość z modelu, nie pomiar terenowy.`, color: plant.kind === 'tree' ? '#95b58c' : '#b8cba5', priority: plant.kind === 'tree' ? 5 : 0, developed: plant.placementRole !== 'context' })
  }
  return elements
}

export function sitePlanEdges(element: SitePlanElement): [Vec2, Vec2][] {
  const p = element.points
  return p.length === 2 ? [[p[0], p[1]]] : p.map((point, index) => [point, p[(index + 1) % p.length]])
}

export function sitePlanBounds(elements: SitePlanElement[]) {
  return polygonBounds(elements.flatMap(e => {
    if (!e.diameterM) return e.points
    const c = polygonCentroid(e.points), r = e.diameterM / 2
    return [{ x: c.x - r, z: c.z - r }, { x: c.x + r, z: c.z + r }]
  }))
}
