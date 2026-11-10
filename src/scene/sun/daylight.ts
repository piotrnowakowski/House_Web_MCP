import { BufferAttribute, BufferGeometry, DoubleSide, Mesh, Ray, Vector3, type Group, type Object3D } from 'three'
import { MeshBVH } from 'three-mesh-bvh'
import { distanceToSegment, pointInPolygon, polygonBounds } from '../../domain/geometry'
import { collectOccluders, rayIsBlocked } from '../../domain/sunlight'
import type { BuildingModel, ProjectV2, StoreyModel, Vec2, Vec3 } from '../../domain/types'
import { observerWorldPosition } from './observer'

export const WORKPLANE_M = .8
// These bands belong to a relative daylight index, not measured illuminance thresholds.
export const LIGHT_LEVELS = [
  { name: 'Ciemno',           color: '#414f65', upper: .00035 },
  { name: 'Bardzo ciemno',    color: '#586c89', upper: .0025 },
  { name: 'Ciemnawo',         color: '#7795ad', upper: .0055 },
  { name: 'Słabe światło',    color: '#93b9cd', upper: .012 },
  { name: 'Przygaszone',      color: '#a1cfc9', upper: .022 },
  { name: 'Umiarkowane',      color: '#a5cfaa', upper: .035 },
  { name: 'Dość jasno',       color: '#c4d995', upper: .055 },
  { name: 'Jasno',            color: '#e1df8c', upper: .085 },
  { name: 'Bardzo jasno',     color: '#f5d179', upper: .14 },
  { name: 'Intensywnie',      color: '#f3b365', upper: .30 },
  { name: 'Najwięcej światła', color: '#e98b52', upper: Infinity },
] as const

export const DAYLIGHT_USES = [
  { name: 'Wypoczynek', adequate: 4 },
  { name: 'Czytanie', adequate: 6 },
  { name: 'Praca przy blacie', adequate: 7 },
] as const

export function daylightAdvice(level: number, adequate: number) {
  if (level >= adequate) return 'Sprzyjające'
  if (level >= adequate - 2) return 'Może przydać się lampa'
  return 'Warto doświetlić'
}

function radicalInverse(index: number, base: number) {
  let value = 0, factor = 1 / base
  while (index > 0) {
    value += (index % base) * factor
    index = Math.floor(index / base)
    factor /= base
  }
  return value
}

// Equal-solid-angle sky samples resolve narrow openings near the horizon. Projection
// onto the horizontal workplane gives each direction a weight proportional to height.
const SKY_RAYS = Array.from({ length: 512 }, (_, i) => {
  const y = (i + .5) / 512, radius = Math.sqrt(1 - y * y)
  const azimuth = i * Math.PI * (3 - Math.sqrt(5))
  const bounceRadius = Math.sqrt(radicalInverse(i + 1, 2))
  const angle = 2 * Math.PI * radicalInverse(i + 1, 3)
  return {
    direction: { x: radius * Math.cos(azimuth), y, z: radius * Math.sin(azimuth) },
    bounce: { x: bounceRadius * Math.cos(angle), y: Math.sqrt(1 - bounceRadius ** 2), z: bounceRadius * Math.sin(angle) },
  }
})

export type BlockedRay = (origin: Vec3, direction: Vec3) => boolean
export interface DaylightRays { blocked: BlockedRay; skyWeight: (origin: Vec3, direction: Vec3, bounce: Vec3) => number }

/** World-space triangles of the rendered architecture, including cutouts in walls, slabs and gables.
 * The workplane represents architectural daylight potential, independently of product model LOD. */
export function architecturalShadowMesh(root: Group, building: BuildingModel): MeshBVH | null {
  root.updateWorldMatrix(true, true)
  const furniture = new Set(building.furniture?.map(item => item.ref))
  const meshes: Mesh[] = []
  function collect(object: Object3D) {
    if (!object.visible || furniture.has(object.userData.semanticRef)) return
    if (object instanceof Mesh && !object.userData.clearGlazing) {
      const materials = Array.isArray(object.material) ? object.material : [object.material]
      if (object.geometry.getAttribute('position') && materials.some(m => m.visible && !m.wireframe && !(m.transparent && m.opacity < .85))) meshes.push(object)
    }
    object.children.forEach(collect)
  }
  collect(root)
  const count = (mesh: Mesh) => mesh.geometry.index?.count ?? mesh.geometry.getAttribute('position').count
  const positions = new Float32Array(meshes.reduce((sum, mesh) => sum + count(mesh), 0) * 3)
  if (!positions.length) return null
  const vertex = new Vector3()
  let offset = 0
  for (const mesh of meshes) {
    const attribute = mesh.geometry.getAttribute('position')
    const index = mesh.geometry.index
    for (let i = 0; i < count(mesh); i++) {
      vertex.fromBufferAttribute(attribute, index ? index.getX(i) : i).applyMatrix4(mesh.matrixWorld).toArray(positions, offset)
      offset += 3
    }
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(positions, 3))
  return new MeshBVH(geometry)
}

export function daylightObstacles(mesh: MeshBVH, project: ProjectV2, house: BuildingModel, trees: boolean, neighbors: boolean): DaylightRays {
  const outside = collectOccluders({
    ...project, buildings: project.buildings.filter(building => building.ref !== house.ref),
    landscape: { ...project.landscape, plants: project.landscape.plants.filter(plant => trees || plant.kind !== 'tree') },
  }, neighbors)
  const ray = new Ray()
  const hitHouse = (origin: Vec3, direction: Vec3) => {
    ray.origin.set(origin.x, origin.y, origin.z)
    ray.direction.set(direction.x, direction.y, direction.z)
    return mesh.raycastFirst(ray, DoubleSide, .001)
  }
  const blocked: BlockedRay = (origin, direction) => !!hitHouse(origin, direction) || rayIsBlocked(origin, direction, outside)
  const normal = new Vector3(), tangent = new Vector3(), bitangent = new Vector3(), outgoing = new Vector3()
  return { blocked, skyWeight(origin, direction, bounce) {
    const hit = hitHouse(origin, direction)
    if (!hit) return rayIsBlocked(origin, direction, outside) ? 0 : 1
    if (!hit.face) return 0
    normal.copy(hit.face.normal)
    if (normal.dot(ray.direction) > 0) normal.negate()
    tangent.set(0, Math.abs(normal.y) < .9 ? 1 : 0, Math.abs(normal.y) < .9 ? 0 : 1).cross(normal).normalize()
    bitangent.crossVectors(normal, tangent)
    outgoing.copy(normal).multiplyScalar(bounce.y).addScaledVector(tangent, bounce.x).addScaledVector(bitangent, bounce.z)
    // One diffuse reflection with a generic 40% reflectance for the architectural surfaces.
    if (outgoing.y <= 0) return 0
    return blocked(hit.point.addScaledVector(normal, .002), outgoing) ? 0 : .4
  } }
}

export function daylightSample(building: BuildingModel, floor: StoreyModel, point: Vec2, rays: DaylightRays) {
  const [x, y, z] = observerWorldPosition(building, floor, point, WORKPLANE_M)
  const origin = { x, y, z }
  const skyFraction = SKY_RAYS.reduce((sum, { direction, bounce }) =>
    sum + 2 * direction.y * rays.skyWeight(origin, direction, bounce), 0) / SKY_RAYS.length
  return { origin, skyFraction }
}
export type DaylightSample = ReturnType<typeof daylightSample>

export function assessDaylight(sample: DaylightSample, sun: Vec3, blocked: BlockedRay) {
  const direct = sun.y > 0 && !blocked(sample.origin, sun)
  // Relative clear-sky index, deliberately uncalibrated. Sky access, height of the sun
  // and the direct beam are separate; twilight fades to zero at civil dusk.
  const twilightLimit = Math.sin(-6 * Math.PI / 180)
  const skyStrength = sun.y >= 0 ? .08 + .92 * Math.sqrt(sun.y) : .08 * Math.max(0, 1 - sun.y / twilightLimit)
  const index = sample.skyFraction * skyStrength + (direct ? sun.y * .95 : 0)
  const level = LIGHT_LEVELS.findIndex(band => index < band.upper)
  return { level, direct }
}

export function daylightFloor(building: BuildingModel, floor: StoreyModel) {
  const slab = building.slabs.find(item => item.ref === floor.baseSlabRef)!
  const walls = building.walls.filter(wall => floor.wallRefs.includes(wall.ref) && wall.baseElevationM <= floor.elevationM + WORKPLANE_M && wall.baseElevationM + wall.heightM > floor.elevationM + WORKPLANE_M)
  const contains = (p: Vec2) => pointInPolygon(p, slab.footprint) && !slab.holes?.some(hole => pointInPolygon(p, hole))
    && !walls.some(wall => distanceToSegment(p, wall.start, wall.end) < wall.thicknessM / 2)
  const bounds = polygonBounds(slab.footprint)
  const width = bounds.maxX - bounds.minX, depth = bounds.maxZ - bounds.minZ
  const cell = Math.max(.45, Math.sqrt(width * depth / 1100))
  const cells: Vec2[] = []
  for (let row = 0; row < Math.ceil(depth / cell); row++) {
    for (let column = 0; column < Math.ceil(width / cell); column++) {
      const point = { x: bounds.minX + (column + .5) * cell, z: bounds.minZ + (row + .5) * cell }
      if (contains(point)) cells.push(point)
    }
  }
  return { cells, cell, contains, slab }
}
