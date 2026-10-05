import { useLayoutEffect, useMemo, useRef } from 'react'
import { BufferGeometry, CylinderGeometry, DoubleSide, Euler, Float32BufferAttribute, InstancedMesh, Matrix4, Quaternion, SphereGeometry, Vector3 } from 'three'
import type { GardenVisualProps } from './gardenDetails'

type Item = { p: [number, number, number]; s: [number, number, number]; r?: [number, number, number] }
export const gardenRandom = (seed: number) => () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }

// Curved, tapering leaves with a raised midrib and undulating edges, rather than foliage balls.
const leaf = (() => {
  const g = new BufferGeometry(), positions: number[] = [], uv: number[] = [], indices: number[] = []
  const rows = 12, columns = 6
  for (let row = 0; row <= rows; row++) for (let col = 0; col <= columns; col++) {
    const t = row / rows, side = col / columns * 2 - 1
    const width = Math.pow(Math.sin(Math.PI * t), 0.7) * (1 + 0.06 * Math.cos(t * 50))
    positions.push(side * width * 0.5, Math.sin(t * Math.PI) * 0.22 + (1 - Math.abs(side)) * 0.07 + Math.abs(side) * Math.sin(t * 42) * 0.025, t)
    uv.push(col / columns, t)
    if (row < rows && col < columns) { const n = row * (columns + 1) + col; indices.push(n, n + 1, n + columns + 1, n + 1, n + columns + 2, n + columns + 1) }
  }
  g.setAttribute('position', new Float32BufferAttribute(positions, 3)); g.setAttribute('uv', new Float32BufferAttribute(uv, 2)); g.setIndex(indices); g.computeVertexNormals()
  return g
})()
const petal = new SphereGeometry(1, 8, 5)
const stem = new CylinderGeometry(1, 1, 1, 5)

export function GardenInstances({ geometry, items, color, selected, ghost, roughness = 0.83 }: GardenVisualProps & { geometry: BufferGeometry; items: Item[]; color: string; roughness?: number }) {
  const ref = useRef<InstancedMesh>(null)
  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const m = new Matrix4(), q = new Quaternion(), e = new Euler(), p = new Vector3(), s = new Vector3()
    items.forEach((v, i) => { const r = v.r ?? [0, 0, 0]; mesh.setMatrixAt(i, m.compose(p.fromArray(v.p), q.setFromEuler(e.set(...r)), s.fromArray(v.s))) })
    mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingSphere()
  }, [items])
  return <instancedMesh ref={ref} args={[geometry, undefined, items.length]} castShadow={!ghost} receiveShadow>
    <meshStandardMaterial color={selected ? '#bddb86' : color} roughness={roughness} side={DoubleSide} transparent={ghost} opacity={ghost ? 0.35 : 1} depthWrite={!ghost} />
  </instancedMesh>
}

export function RealisticGreens({ length, ...props }: GardenVisualProps & { length: number }) {
  const groups = useMemo(() => {
    const rand = gardenRandom(59), groups: Item[][] = [[], [], []]
    const count = Math.floor(length / 0.43)
    for (let i = 0; i < count; i++) for (let row = 0; row < 3; row++) {
      const x = -length / 2 + 0.23 + i * 0.43 + (row % 2) * 0.04, z = (row - 1) * 0.29
      for (let k = 0; k < 15; k++) {
        const ring = Math.floor(k / 5), angle = k * 2.39996 + rand() * 0.1, size = 0.20 - ring * 0.038
        groups[(row + i) % 3].push({ p: [x, 0.025 + ring * 0.025, z], s: [size * 0.92, size, size], r: [-0.05 - ring * 0.42, angle, (rand() - 0.5) * 0.2] })
      }
    }
    return groups
  }, [length])
  return <group>{groups.map((items, i) => <GardenInstances key={i} geometry={leaf} items={items} color={['#738b3f', '#9ba96a', '#57735c'][i]} {...props} />)}</group>
}

export function RealisticFlowers({ length, width = 0.9, seed = 1, ...props }: GardenVisualProps & { length: number; width?: number; seed?: number }) {
  const data = useMemo(() => {
    const rand = gardenRandom(seed * 719 + Math.round(length * 99)), leaves: Item[] = [], stems: Item[] = [], petals: Item[][] = [[], [], []], centres: Item[] = []
    const count = Math.ceil(length * width * 26)
    for (let i = 0; i < count; i++) {
      const x = (rand() - 0.5) * (length - 0.08), z = (rand() - 0.5) * (width - 0.08), height = 0.28 + rand() * 0.42
      stems.push({ p: [x, height / 2, z], s: [0.003, height, 0.003] })
      for (let j = 0; j < 5; j++) leaves.push({ p: [x, height * (0.15 + j * 0.13), z], s: [0.035 + rand() * 0.04, 0.1, 0.1 + rand() * 0.06], r: [-0.25, j * 2.4 + i, 0] })
      const colour = i % 3
      if (colour === 2) {
        // Salvia racemes: individual tiny florets distributed round the stem.
        for (let j = 0; j < 18; j++) { const a = j * 2.4, t = j / 18; petals[2].push({ p: [x + Math.cos(a) * 0.018 * (1 - t), height + t * 0.12, z + Math.sin(a) * 0.018 * (1 - t)], s: [0.009, 0.014, 0.01] }) }
      } else {
        const size = 0.025 + rand() * 0.014
        for (let j = 0; j < 7; j++) { const a = j / 7 * Math.PI * 2; petals[colour].push({ p: [x + Math.cos(a) * size * 0.75, height, z + Math.sin(a) * size * 0.75], s: [size * 0.75, 0.009, size * 0.43], r: [0.12, -a, 0.2] }) }
        centres.push({ p: [x, height + 0.005, z], s: [0.009, 0.01, 0.009] })
      }
    }
    return { leaves, stems, petals, centres }
  }, [length, width, seed])
  return <group>
    <GardenInstances geometry={leaf} items={data.leaves} color="#577345" {...props} />
    <GardenInstances geometry={stem} items={data.stems} color="#65734b" {...props} />
    {data.petals.map((items, i) => <GardenInstances key={i} geometry={petal} items={items} color={['#c0778d', '#efe4cc', '#766083'][i]} {...props} />)}
    <GardenInstances geometry={petal} items={data.centres} color="#aa8438" {...props} />
  </group>
}

export function RealisticHydrangea(props: GardenVisualProps) {
  const data = useMemo(() => {
    const rand = gardenRandom(471), leaves: Item[] = [], stems: Item[] = [], florets: Item[] = [], cream: Item[] = []
    for (let i = 0; i < 22; i++) {
      const angle = i * 2.39996, radius = 0.12 + rand() * 0.36, x = Math.cos(angle) * radius, z = Math.sin(angle) * radius, h = 0.64 + rand() * 0.3
      stems.push({ p: [x, h / 2, z], s: [0.008, h, 0.008] })
      for (let j = 0; j < 7; j++) leaves.push({ p: [x, 0.18 + j * 0.09, z], s: [0.11, 0.12, 0.2], r: [-0.15, j * 2.4 + i, 0] })
      for (let f = 0; f < 65; f++) {
        const t = rand(), a = rand() * 6.28, r = Math.sqrt(rand()) * 0.11 * (1 - t * 0.84)
        ;(f % 3 ? florets : cream).push({ p: [x + Math.cos(a) * r, h + t * 0.27, z + Math.sin(a) * r], s: [0.018, 0.012, 0.018], r: [rand(), a, rand()] })
      }
    }
    return { leaves, stems, florets, cream }
  }, [])
  return <group>
    <GardenInstances geometry={leaf} items={data.leaves} color="#4e6942" {...props} />
    <GardenInstances geometry={stem} items={data.stems} color="#786745" {...props} />
    <GardenInstances geometry={petal} items={data.florets} color="#e9e5d0" {...props} />
    <GardenInstances geometry={petal} items={data.cream} color="#bcc09d" {...props} />
  </group>
}
