import { BufferGeometry, Color, Float32BufferAttribute, Vector3 } from 'three'

export const plantVisualSeed = (ref: string) => [...ref].reduce((n, c) => Math.imul(n, 31) + c.charCodeAt(0) | 0, 7) >>> 0

// Four shared tufts vary the border without allocating geometry for every planted clump.
export function vegetationGeometry(seed: number, detailed: boolean) {
  const positions: number[] = [], colors: number[] = []
  let state = seed + 1
  const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296 }
  const green = new Color(), side = new Vector3(), direction = new Vector3()
  const ribbon = (a: Vector3, b: Vector3, width: number, color: Color, normal: Vector3) => {
    direction.subVectors(b, a); side.crossVectors(direction, normal).normalize().multiplyScalar(width)
    const middle = a.clone().lerp(b, .56)
    const left = middle.clone().add(side), right = middle.clone().sub(side)
    positions.push(...a.toArray(), ...left.toArray(), ...b.toArray(), ...a.toArray(), ...b.toArray(), ...right.toArray())
    for (let n = 0; n < 6; n++) colors.push(color.r, color.g, color.b)
  }
  const count = detailed ? 168 : 84
  for (let blade = 0; blade < count; blade++) {
    const angle = random() * Math.PI * 2, height = .32 + random() * .44, reach = .19 + random() * .20
    const rootRadius = random() * .085, normal = new Vector3(Math.cos(angle), 0, Math.sin(angle))
    green.set(blade % 7 === 0 ? '#9a965e' : '#637843').multiplyScalar(.75 + random() * .5)
    for (let step = 0; step < 5; step++) {
      const point = (t: number) => new Vector3(Math.cos(angle) * (rootRadius + reach * t * t), height * Math.sin(t * 1.7), Math.sin(angle) * (rootRadius + reach * t * t))
      ribbon(point(step / 5), point((step + 1) / 5), .005 * (1 - step / 5) + .001, green, normal)
    }
  }
  for (let stem = 0; stem < (detailed ? 30 : 16); stem++) {
    const angle = random() * Math.PI * 2, radius = random() * .18, height = .77 + random() * .23
    const x = Math.cos(angle) * radius, z = Math.sin(angle) * radius, normal = new Vector3(Math.cos(angle), 0, Math.sin(angle))
    green.set('#a29362').multiplyScalar(.8 + random() * .3)
    ribbon(new Vector3(x * .3, 0, z * .3), new Vector3(x, height, z), .0018, green, normal)
    for (let floret = 0; floret < 9; floret++) {
      const y = height - .13 + floret * .014, a = floret * 2.399963
      ribbon(new Vector3(x, y, z), new Vector3(x + Math.cos(a) * .018, y + .027, z + Math.sin(a) * .018), .0035, green, normal)
    }
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3))
  geometry.computeVertexNormals(); geometry.computeBoundingBox()
  geometry.scale(1, 1 / geometry.boundingBox!.max.y, 1)
  geometry.computeBoundingBox(); geometry.computeBoundingSphere()
  return geometry
}

const cache = new Map<string, BufferGeometry>()
export function sharedVegetationGeometry(seed: number, detailed: boolean) {
  const key = `${seed % 4}/${detailed}`
  if (!cache.has(key)) cache.set(key, vegetationGeometry(seed % 4, detailed))
  return cache.get(key)!
}
