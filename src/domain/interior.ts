import { z } from 'zod'
import { pointInPolygon, pointOnSegment, polygonBounds, polygonSelfIntersects, spaceFootprint, wallLength } from './geometry'
import type { BuildingModel, InteriorCatalogId, InteriorCommand, InteriorItem, Polygon2, Vec2 } from './types'

export const interiorCatalog: { id: InteriorCatalogId; name: string; category: string; size: [number, number, number]; color: string }[] = [
  { id: 'corner-sofa', name: 'Corner sofa', category: 'Living', size: [3.45, 2.52, 0.85], color: '#20798a' },
  { id: 'tv-unit', name: 'TV & media unit', category: 'Living', size: [3.2, 0.45, 1.2], color: '#374248' },
  { id: 'bar-stool', name: 'Bar stool', category: 'Kitchen', size: [0.45, 0.45, 0.75], color: '#b18c60' },
  { id: 'sofa', name: 'Linen sofa', category: 'Living', size: [2.4, 0.95, 0.85], color: '#64827e' },
  { id: 'armchair', name: 'Lounge chair', category: 'Living', size: [0.85, 0.85, 0.85], color: '#c0a184' },
  { id: 'coffee-table', name: 'Coffee table', category: 'Living', size: [1.2, 0.65, 0.4], color: '#ac8054' },
  { id: 'dining-table', name: 'Dining table & chairs', category: 'Living', size: [2.1, 2.2, 0.8], color: '#c39d72' },
  { id: 'bed', name: 'Double bed', category: 'Bedroom', size: [1.8, 2.1, 1], color: '#d5c6b9' },
  { id: 'wardrobe', name: 'Wardrobe', category: 'Bedroom', size: [1.8, 0.6, 2.2], color: '#cfb38e' },
  { id: 'desk', name: 'Writing desk', category: 'Bedroom', size: [1.4, 0.65, 0.75], color: '#c39d72' },
  { id: 'kitchen-counter', name: 'Kitchen cabinet', category: 'Kitchen', size: [1.2, 0.65, 0.9], color: '#d5d2c6' },
  { id: 'kitchen-island', name: 'Kitchen island', category: 'Kitchen', size: [2.2, 0.95, 0.92], color: '#c39d72' },
  { id: 'fridge', name: 'Refrigerator', category: 'Kitchen', size: [0.75, 0.7, 1.9], color: '#abb5b7' },
  { id: 'cooker', name: 'Cooker & oven', category: 'Kitchen', size: [0.6, 0.65, 0.9], color: '#879291' },
  { id: 'sink', name: 'Kitchen sink', category: 'Kitchen', size: [0.9, 0.65, 0.9], color: '#d5d2c6' },
  { id: 'bathtub', name: 'Freestanding bath', category: 'Bathroom', size: [0.85, 1.75, 0.6], color: '#eeeae2' },
  { id: 'shower', name: 'Walk-in shower', category: 'Bathroom', size: [1, 1, 2.1], color: '#e0ecea' },
  { id: 'toilet', name: 'Toilet', category: 'Bathroom', size: [0.42, 0.72, 0.8], color: '#f3f1ea' },
  { id: 'vanity', name: 'Bathroom vanity', category: 'Bathroom', size: [1, 0.5, 0.85], color: '#c39d72' },
  { id: 'washer', name: 'Washing machine', category: 'Bathroom', size: [0.6, 0.65, 0.85], color: '#eeeae2' },
  { id: 'car', name: 'Family car', category: 'Garage', size: [1.85, 4.5, 1.45], color: '#82949b' },
]

export const InteriorItemSchema = z.object({
  ref: z.string().min(1), catalogId: z.enum(interiorCatalog.map((item) => item.id) as [InteriorCatalogId, ...InteriorCatalogId[]]),
  storeyRef: z.string().min(1), name: z.string().trim().min(1).max(100),
  position: z.object({ x: z.number().finite(), z: z.number().finite() }),
  widthM: z.number().min(0.1).max(20), depthM: z.number().min(0.1).max(20), heightM: z.number().min(0.1).max(5),
  rotationDegrees: z.number().finite(), color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
})
export const interiorCorners = (item: InteriorItem): Polygon2 => {
  const angle = item.rotationDegrees * Math.PI / 180
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, z]) => ({
    x: item.position.x + x * item.widthM / 2 * Math.cos(angle) + z * item.depthM / 2 * Math.sin(angle),
    z: item.position.z - x * item.widthM / 2 * Math.sin(angle) + z * item.depthM / 2 * Math.cos(angle),
  }))
}
const inside = (p: Vec2, polygon: Polygon2) => pointInPolygon(p, polygon) || polygon.some((a, i) => pointOnSegment(p, a, polygon[(i + 1) % polygon.length]))
export const itemFitsFloor = (item: InteriorItem, footprint: Polygon2, holes: Polygon2[] = []) => {
  const corners = interiorCorners(item)
  if (!corners.every((point) => inside(point, footprint))) return false
  if (holes.some((hole) => corners.some((p) => inside(p, hole)) || hole.some((p) => inside(p, corners)) || corners.some((a, i) => hole.some((c, j) => {
    const b = corners[(i + 1) % corners.length]; const d = hole[(j + 1) % hole.length]
    const cross = (p: Vec2, q: Vec2, r: Vec2) => (q.x - p.x) * (r.z - p.z) - (q.z - p.z) * (r.x - p.x)
    return cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0
  })))) return false
  // Split each item edge at every floor-boundary intersection. Checking each interval
  // catches arbitrarily narrow courtyards that corner-only or sampled tests miss.
  const cross = (a: Vec2, b: Vec2) => a.x * b.z - a.z * b.x
  return corners.every((a, i) => {
    const b = corners[(i + 1) % corners.length]; const edge = { x: b.x - a.x, z: b.z - a.z }; const cuts = [0, 1]
    footprint.forEach((c, j) => {
      const d = footprint[(j + 1) % footprint.length]; const boundary = { x: d.x - c.x, z: d.z - c.z }
      const denominator = cross(edge, boundary); if (Math.abs(denominator) < 1e-9) return
      const offset = { x: c.x - a.x, z: c.z - a.z }; const t = cross(offset, boundary) / denominator; const u = cross(offset, edge) / denominator
      if (t > 0 && t < 1 && u >= 0 && u <= 1) cuts.push(t)
    })
    cuts.sort((a, b) => a - b)
    return cuts.slice(1).every((end, j) => { const t = (cuts[j] + end) / 2; return inside({ x: a.x + edge.x * t, z: a.z + edge.z * t }, footprint) })
  })
}

export function applyInterior(building: BuildingModel, command: InteriorCommand) {
  const storey = building.storeys.find((item) => item.ref === command.storeyRef)
  if (!storey) throw new Error('This floor no longer exists.')
  const slab = building.slabs.find((item) => item.ref === storey.baseSlabRef)!
  if (command.action === 'put') {
    const item = InteriorItemSchema.parse(command.item)
    if (item.storeyRef !== storey.ref) throw new Error('Furniture must belong to the selected floor.')
    if (item.heightM > storey.clearHeightM) throw new Error('This item is taller than the room.')
    if (!itemFitsFloor(item, slab.footprint, slab.holes)) throw new Error('Keep the whole item inside this floor and clear of stair openings. Try a smaller item or another position.')
    const existing = building.furniture?.find((entry) => entry.ref === item.ref)
    if (existing && existing.storeyRef !== storey.ref) throw new Error('This item belongs to another floor.')
    building.furniture = [...(building.furniture ?? []).filter((entry) => entry.ref !== item.ref), item]
  } else if (command.action === 'remove') {
    if (!building.furniture?.some((item) => item.ref === command.itemRef && item.storeyRef === storey.ref)) throw new Error('Furniture not found on this floor.')
    building.furniture = building.furniture.filter((item) => item.ref !== command.itemRef)
  } else {
    const room = building.spaces.find((item) => item.ref === command.spaceRef && storey.spaceRefs.includes(item.ref))
    if (!room || room.locked) throw new Error('This room cannot be edited.')
    if (!command.name.trim()) throw new Error('Enter a room name.')
    room.name = command.name.trim().slice(0, 100)
    if (command.widthM === undefined && command.depthM === undefined) return
    const points = spaceFootprint(building, room); const bounds = polygonBounds(points)
    const width = command.widthM ?? bounds.maxX - bounds.minX; const depth = command.depthM ?? bounds.maxZ - bounds.minZ
    if (!Number.isFinite(width) || !Number.isFinite(depth) || width < 1 || depth < 1 || width > 50 || depth > 50) throw new Error('Room dimensions must be between 1 and 50 m.')
    const sx = width / (bounds.maxX - bounds.minX); const sz = depth / (bounds.maxZ - bounds.minZ)
    const centre = { x: (bounds.minX + bounds.maxX) / 2, z: (bounds.minZ + bounds.maxZ) / 2 }
    const transform = (p: Vec2) => ({ x: centre.x + (p.x - centre.x) * sx, z: centre.z + (p.z - centre.z) * sz })
    const mapped = points.map(transform)
    if (mapped.some((p) => !inside(p, slab.footprint))) throw new Error('The room must stay within this floor. Change the building footprint in the plot editor to extend it.')
    const move = (p: Vec2) => points.some((v) => Math.hypot(v.x - p.x, v.z - p.z) < 0.001) ? transform(p) : p
    building.walls.filter((wall) => storey.wallRefs.includes(wall.ref)).forEach((wall) => {
      const start = move(wall.start); const end = move(wall.end)
      if (start === wall.start && end === wall.end) return
      if (wall.locked) throw new Error('A connected wall is locked.')
      const oldLength = wallLength(wall); wall.start = start; wall.end = end
      const length = wallLength(wall)
      if (length < 0.2) throw new Error('This change would collapse a connected wall.')
      wall.openings.forEach((opening) => {
        opening.offsetM *= length / oldLength
        if (opening.offsetM - opening.widthM / 2 < 0 || opening.offsetM + opening.widthM / 2 > length) throw new Error('An opening would no longer fit its wall.')
      })
    })
    if (building.spaces.filter((s) => storey.spaceRefs.includes(s.ref)).some((s) => polygonSelfIntersects(spaceFootprint(building, s)))) throw new Error('This change would cross a neighbouring room wall.')
  }
}
