import { z } from 'zod'
import { pointInPolygon, pointOnSegment, spaceFootprint, wallLength } from './geometry'
import type { BuildingModel, InteriorCatalogId, InteriorCommand, InteriorItem, Polygon2, StoreyModel, Vec2 } from './types'
import { ikeaProduct } from './ikeaCatalog'
import { InteriorFinishSchema } from './interiorFinishes'
import { mergeRooms, moveConnectedWall, splitRoom } from './interiorLayout'
import { resizeInteriorRoom } from './interiorResize'

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
  widthM: z.number().min(0.001).max(20), depthM: z.number().min(0.001).max(20), heightM: z.number().min(0.001).max(5),
  rotationDegrees: z.number().finite(), color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  productId: z.string().optional(), variantId: z.string().optional(), elevationM: z.number().min(0).max(8).optional(),
  groupRef: z.string().min(1).optional(), locked: z.boolean().optional(),
})

/** Catalogue dimensions remain the reference even when a placed object is enlarged. */
export function interiorOriginalSize(item: Pick<InteriorItem, 'productId' | 'catalogId'>): [number, number, number] {
  return ikeaProduct(item.productId)?.size ?? interiorCatalog.find((entry) => entry.id === item.catalogId)!.size
}
export const interiorCorners = (item: Pick<InteriorItem, 'position' | 'rotationDegrees' | 'widthM' | 'depthM'>): Polygon2 => {
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

export function availableInteriorHeight(item: InteriorItem, building: BuildingModel, storey: StoreyModel) {
  let height = storey.clearHeightM
  const corners = interiorCorners(item)
  for (const ceiling of building.ceilingFinishes) {
    const room = building.spaces.find((room) => room.ref === ceiling.spaceRef && storey.spaceRefs.includes(room.ref))
    if (!room) continue
    const polygon = spaceFootprint(building, room)
    if (corners.some((point) => inside(point, polygon)) || polygon.some((point) => inside(point, corners))) height = Math.min(height, ceiling.elevationM - storey.elevationM - ceiling.thicknessM)
  }
  return height
}

export function applyInterior(building: BuildingModel, command: InteriorCommand) {
  const storey = building.storeys.find((item) => item.ref === command.storeyRef)
  if (!storey) throw new Error('This floor no longer exists.')
  const slab = building.slabs.find((item) => item.ref === storey.baseSlabRef)!
  if (command.action === 'split') { splitRoom(building, storey, command); return }
  if (command.action === 'merge') { mergeRooms(building, storey, command.wallRef); return }
  if (command.action === 'wall') { moveConnectedWall(building, storey, command); return }
  if (command.action === 'lock') {
    const items = command.itemRefs.map((ref) => building.furniture?.find((item) => item.ref === ref && item.storeyRef === storey.ref))
    if (!items.length || items.some((item) => !item)) throw new Error('Select furniture on this floor.')
    items.forEach((item) => { item!.locked = command.locked }); return
  }
  if (command.action === 'finish') {
    const finish = InteriorFinishSchema.parse(command.finish)
    if (command.surface === 'floor' || command.surface === 'ceiling') {
      const room = building.spaces.find((item) => item.ref === command.targetRef && storey.spaceRefs.includes(item.ref))
      if (!room || room.locked) throw new Error('Select an unlocked room.')
      if (command.surface === 'floor') room.floorFinish = finish
      else room.ceilingFinish = finish
    } else {
      const wall = building.walls.find((item) => item.ref === command.targetRef && storey.wallRefs.includes(item.ref))
      if (!wall || wall.locked) throw new Error('Select an unlocked wall.')
      wall.faceFinishes = { ...wall.faceFinishes, [command.surface]: finish }
    }
    return
  }
  if (command.action === 'opening' || command.action === 'opening-remove') {
    const wall = building.walls.find((item) => item.ref === command.wallRef && storey.wallRefs.includes(item.ref))
    if (!wall || wall.locked) throw new Error('Select an unlocked wall.')
    if (command.action === 'opening-remove') {
      if (!wall.openings.some((item) => item.ref === command.openingRef)) throw new Error('Opening not found.')
      wall.openings = wall.openings.filter((item) => item.ref !== command.openingRef)
    } else {
      const opening = command.opening
      if (opening.wallRef !== wall.ref || !opening.ref || !['door', 'window'].includes(opening.kind) || ![opening.offsetM, opening.widthM, opening.heightM, opening.sillM].every(Number.isFinite) || opening.widthM < 0.2 || opening.heightM < 0.2 || opening.sillM < 0) throw new Error('Enter valid opening dimensions.')
      if (opening.offsetM - opening.widthM / 2 < 0 || opening.offsetM + opening.widthM / 2 > wallLength(wall) || opening.sillM + opening.heightM > wall.heightM) throw new Error('The opening must fit inside its wall.')
      if (building.walls.some((host) => host.ref !== wall.ref && host.openings.some((item) => item.ref === opening.ref))) throw new Error('The opening belongs to another wall.')
      if (wall.openings.some((item) => item.ref !== opening.ref && Math.abs(item.offsetM - opening.offsetM) < (item.widthM + opening.widthM) / 2 + 0.02)) throw new Error('Leave space between openings.')
      wall.openings = [...wall.openings.filter((item) => item.ref !== opening.ref), structuredClone(opening)]
    }
    return
  }
  if (command.action === 'put') {
    const item = InteriorItemSchema.parse(command.item)
    const existing = building.furniture?.find((entry) => entry.ref === item.ref)
    if (item.storeyRef !== storey.ref) throw new Error('Furniture must belong to the selected floor.')
    if (item.heightM + (item.elevationM ?? 0) > availableInteriorHeight(item, building, storey)) throw new Error('This item is taller than the room at its chosen elevation.')
    if (item.productId) {
      const product = ikeaProduct(item.productId)
      if (!product || product.articleNumber !== item.variantId || product.catalogId !== item.catalogId) throw new Error('Choose a supported IKEA product and variant.')
      if ((!existing || existing.productId !== item.productId) && product.minimumCeilingM && Math.max(item.heightM, product.minimumCeilingM) + (item.elevationM ?? 0) > availableInteriorHeight(item, building, storey))
        throw new Error(`This IKEA configuration needs at least ${product.minimumCeilingM * 100} cm of clear height for upright assembly.`)
      if (item.color.toLowerCase() !== product.color.toLowerCase()) throw new Error('IKEA products keep their supported finish. Choose another product to change finish.')
    }
    // Keep existing custom-sized projects movable. New or resized objects may not shrink below their catalogue size.
    const sizeChanged = !existing || existing.catalogId !== item.catalogId || existing.productId !== item.productId ||
      existing.widthM !== item.widthM || existing.depthM !== item.depthM || existing.heightM !== item.heightM
    const originalSize = interiorOriginalSize(item)
    if (sizeChanged && [item.widthM, item.depthM, item.heightM].some((value, index) => value < originalSize[index] - 1e-6))
      throw new Error('Dimensions cannot be smaller than the original catalogue size.')
    if (!itemFitsFloor(item, slab.footprint, slab.holes)) throw new Error('Keep the whole item inside this floor and clear of stair openings. Try a smaller item or another position.')
    if (existing?.locked) throw new Error('Unlock this object before editing it.')
    if (existing && existing.storeyRef !== storey.ref) throw new Error('This item belongs to another floor.')
    building.furniture = [...(building.furniture ?? []).filter((entry) => entry.ref !== item.ref), item]
  } else if (command.action === 'remove') {
    if (building.furniture?.find((item) => item.ref === command.itemRef)?.locked) throw new Error('Unlock this object before deleting it.')
    if (!building.furniture?.some((item) => item.ref === command.itemRef && item.storeyRef === storey.ref)) throw new Error('Furniture not found on this floor.')
    building.furniture = building.furniture.filter((item) => item.ref !== command.itemRef)
  } else {
    const room = building.spaces.find((item) => item.ref === command.spaceRef && storey.spaceRefs.includes(item.ref))
    if (!room || room.locked) throw new Error('This room cannot be edited.')
    if (!command.name.trim()) throw new Error('Enter a room name.')
    room.name = command.name.trim().slice(0, 100)
    if (command.usage !== undefined) room.usage = command.usage.trim() || 'flex'
    if (command.widthM === undefined && command.depthM === undefined) return
    resizeInteriorRoom(building, storey, room, command.widthM, command.depthM)
  }
}
