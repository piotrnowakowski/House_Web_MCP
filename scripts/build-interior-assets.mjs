/**
 * Brief: Build independently authored, metre-scaled furniture GLBs and mobile LODs.
 * Inputs: --output <directory> (default public/models/interior); --help.
 * Reads src/domain/ikea-products.json and original textile maps from scripts/textiles.
 * Outputs: GLBs plus manifest.json, containing bounds, triangle counts and provenance.
 * Usage: node scripts/build-interior-assets.mjs
 * No network, credentials or downloaded furniture geometry is used.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { resolve, dirname } from 'node:path'
import { parseArgs } from 'node:util'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function furniture(product, mobile) {
  const group = new THREE.Group()
  const [w, d, h] = product.size
  const materials = new Map()
  const material = (color, kind = 'paint') => {
    const key = `${kind}:${color}`
    if (!materials.has(key))
      materials.set(
        key,
        new THREE.MeshStandardMaterial({
          name: key,
          color,
          roughness: kind === 'metal' ? 0.35 : kind === 'paint' ? 0.48 : 0.88,
          metalness: kind === 'metal' ? 0.75 : 0,
        }),
      )
    return materials.get(key)
  }
  const main = material(
    product.color,
    ['kivik-sofa', 'kivik-chaise', 'poang', 'strandmon', 'markus'].includes(product.id)
      ? 'linen'
      : product.id === 'lohals'
        ? 'jute'
        : product.id.startsWith('lisabo')
          ? 'oak'
          : 'paint',
  )
  const oak = material('#c5a779', 'oak')
  if (product.finish.toLowerCase().includes('high-gloss')) main.roughness = 0.18
  const dark = material('#383b37')
  const fabric = material('#ded7c8', 'linen')
  const metal = material('#727a77', 'metal')
  const brass = material('#ae8850', 'metal')
  const add = (geometry, position, mat = main, rotation = [0, 0, 0]) => {
    const mesh = new THREE.Mesh(geometry, mat)
    mesh.position.set(...position)
    mesh.rotation.set(...rotation)
    group.add(mesh)
    return mesh
  }
  const box = (size, position, mat = main, radius = 0.004, rotation) =>
    add(
      new RoundedBoxGeometry(...size, mobile ? 1 : 2, Math.min(radius, ...size.map((n) => n / 3))),
      position,
      mat,
      rotation,
    )
  const cylinder = (r, length, position, mat = main, top = r, rotation) =>
    add(new THREE.CylinderGeometry(top, r, length, mobile ? 10 : 24), position, mat, rotation)
  const beam = (a, b, width, mat = oak, round = true) => {
    const av = new THREE.Vector3(...a)
    const bv = new THREE.Vector3(...b)
    const delta = bv.clone().sub(av)
    const mesh = add(
      round
        ? new THREE.CylinderGeometry(width * 0.8, width, delta.length(), mobile ? 8 : 16)
        : new THREE.BoxGeometry(width, delta.length(), width),
      av.clone().add(bv).multiplyScalar(0.5).toArray(),
      mat,
    )
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize())
    return mesh
  }
  const legs = (height, inset = 0.055, mat = oak, width = 0.028) => {
    for (const x of [-1, 1])
      for (const z of [-1, 1])
        beam(
          [x * (w / 2 - inset), 0, z * (d / 2 - inset)],
          [x * (w / 2 - inset - 0.025), height, z * (d / 2 - inset - 0.025)],
          width,
          mat,
        )
  }
  const cabinet = (shelves, doors = 0, drawers = 0, width = w, depth = d, height = h, x = 0, y = 0) => {
    const t = 0.018
    box([width, t, depth], [x, y + t / 2, 0])
    box([width, t, depth], [x, y + height - t / 2, 0])
    for (const side of [-1, 1]) box([t, height - 2 * t, depth], [x + (side * (width - t)) / 2, y + height / 2, 0])
    box([width - 2 * t, height - 2 * t, 0.006], [x, y + height / 2, -depth / 2 + 0.006])
    for (let i = 1; i <= shelves; i++) box([width - 2 * t, t, depth - 0.025], [x, y + (i * height) / (shelves + 1), 0])
    for (let i = 0; i < doors; i++) {
      box(
        [width / doors - 0.005, height - 0.008, 0.018],
        [x - width / 2 + ((i + 0.5) * width) / doors, y + height / 2, depth / 2 - 0.009],
      )
      if (product.id === 'pax')
        box([0.012, 0.17, 0.018], [x + (i === 0 ? -0.025 : 0.025), y + height * 0.48, depth / 2], metal)
    }
    for (let i = 0; i < drawers; i++) {
      const dh = (height - 0.065) / drawers
      box([width - 0.009, dh - 0.007, 0.023], [x, y + 0.04 + (i + 0.5) * dh, depth / 2 - 0.012])
      if (product.id === 'alex')
        box([width * 0.38, 0.012, 0.005], [x, y + 0.04 + (i + 1) * dh - 0.015, depth / 2], dark)
    }
  }
  switch (product.id) {
    case 'kivik-sofa':
    case 'kivik-chaise': {
      const chaise = product.id === 'kivik-chaise'
      const regularDepth = 0.95
      box([w - 0.08, 0.23, regularDepth - 0.05], [0, 0.2, -d / 2 + regularDepth / 2], main, 0.04)
      box([w - 0.35, 0.54, 0.17], [0, 0.54, -d / 2 + 0.1], main, 0.045)
      for (const side of [-1, 1])
        box([0.2, 0.49, regularDepth], [side * (w / 2 - 0.1), 0.31, -d / 2 + regularDepth / 2], main, 0.045)
      const seats = chaise ? 3 : 2
      const seatWidth = (w - 0.42) / seats
      for (let i = 0; i < seats; i++) {
        const x = -w / 2 + 0.21 + (i + 0.5) * seatWidth
        const sd = chaise && i === seats - 1 ? d - 0.22 : regularDepth - 0.22
        if (chaise && i === seats - 1) box([seatWidth, 0.25, sd], [x, 0.2, -d / 2 + 0.2 + sd / 2], main, 0.03)
        box([seatWidth - 0.016, 0.16, sd], [x, 0.41, -d / 2 + 0.2 + sd / 2], main, 0.065)
        box([seatWidth - 0.02, 0.36, 0.18], [x, 0.64, -d / 2 + 0.24], main, 0.075, [-0.12, 0, 0])
      }
      for (const x of [-1, 1])
        for (const z of [-d / 2 + 0.16, -d / 2 + regularDepth - 0.16])
          cylinder(0.027, 0.1, [x * (w / 2 - 0.16), 0.05, z], dark)
      if (chaise) cylinder(0.027, 0.1, [w / 2 - 0.35, 0.05, d / 2 - 0.08], dark)
      break
    }
    case 'poang': {
      for (const side of [-1, 1]) {
        const x = side * 0.3
        const points = [
          [x, 0.03, 0.35],
          [x, 0.025, -0.28],
          [x, 0.1, -0.32],
          [x, 0.42, 0.22],
          [x, 0.58, 0.25],
          [x, 0.61, -0.25],
        ]
        const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)))
        const samples = curve.getPoints(mobile ? 14 : 28)
        for (let i = 1; i < samples.length; i++) beam(samples[i - 1].toArray(), samples[i].toArray(), 0.025, oak, false)
        beam([x, 0.35, 0.2], [x, 0.94, -0.3], 0.02, oak, false)
      }
      box([0.53, 0.085, 0.52], [0, 0.4, 0.1], main, 0.035, [-0.12, 0, 0])
      box([0.53, 0.52, 0.07], [0, 0.68, -0.16], main, 0.028, [-0.31, 0, 0])
      box([0.48, 0.18, 0.12], [0, 0.91, -0.25], main, 0.04, [-0.3, 0, 0])
      break
    }
    case 'strandmon': {
      legs(0.22, 0.11, oak, 0.026)
      box([0.67, 0.24, 0.7], [0, 0.31, 0.02], main, 0.09)
      box([0.57, 0.15, 0.59], [0, 0.48, 0.1], main, 0.065)
      box([0.57, 0.63, 0.15], [0, 0.68, -0.32], main, 0.06, [-0.12, 0, 0])
      for (const side of [-1, 1]) {
        box([0.16, 0.34, 0.72], [side * 0.32, 0.49, 0.0], main, 0.07)
        box([0.12, 0.36, 0.25], [side * 0.27, 0.82, -0.24], main, 0.055, [0, side * 0.2, 0])
      }
      if (!mobile)
        for (const x of [-0.14, 0.14])
          for (const y of [0.71, 0.84]) cylinder(0.009, 0.009, [x, y, -0.227], main, 0.009, [Math.PI / 2, 0, 0])
      break
    }
    case 'lack': {
      box([w, 0.05, d], [0, h - 0.025, 0])
      box([w - 0.08, 0.025, d - 0.08], [0, 0.1, 0])
      for (const x of [-1, 1])
        for (const z of [-1, 1])
          box([0.045, h - 0.05, 0.045], [x * (w / 2 - 0.025), (h - 0.05) / 2, z * (d / 2 - 0.025)])
      break
    }
    case 'besta':
      cabinet(0, 3)
      break
    case 'pax':
      cabinet(1, 2)
      break
    case 'billy':
      cabinet(5)
      break
    case 'malm-chest':
      cabinet(0, 0, 4)
      break
    case 'malm-bedside':
      cabinet(0, 0, 2)
      break
    case 'alex':
      cabinet(0, 0, 5)
      break
    case 'kallax':
      cabinet(1)
      box([0.035, h - 0.036, d], [0, h / 2, 0])
      break
    case 'malm-bed': {
      box([w, h, 0.045], [0, h / 2, -d / 2 + 0.0225])
      box([w, 0.38, 0.04], [0, 0.19, d / 2 - 0.02])
      for (const side of [-1, 1]) box([0.07, 0.17, d - 0.08], [side * (w / 2 - 0.035), 0.295, 0])
      box([1.6, 0.18, 2.0], [0, 0.42, 0.01], fabric, 0.04)
      box([1.61, 0.035, 1.4], [0, 0.528, 0.31], material('#a6b0a2', 'linen'), 0.015)
      for (const side of [-1, 1]) box([0.65, 0.12, 0.42], [side * 0.4, 0.55, -0.7], fabric, 0.055, [0, side * 0.07, 0])
      break
    }
    case 'lisabo-table':
      box([w, 0.027, d], [0, h - 0.0135, 0], main, 0.01)
      legs(h - 0.026, 0.065, oak, 0.025)
      break
    case 'lisabo-chair': {
      legs(0.45, 0.04, oak, 0.018)
      box([w, 0.03, 0.42], [0, 0.45, 0.045], main, 0.01)
      for (const side of [-1, 1]) beam([side * 0.18, 0.44, -0.17], [side * 0.19, h - 0.05, -0.23], 0.018, oak)
      box([w, 0.18, 0.025], [0, h - 0.09, -0.225], main, 0.01, [-0.13, 0, 0])
      break
    }
    case 'ingolf': {
      legs(0.63, 0.025, main, 0.02)
      box([w, 0.027, 0.39], [0, 0.63, 0.025])
      for (const side of [-1, 1]) {
        beam([side * 0.17, 0.61, -0.18], [side * 0.17, h, -0.2], 0.025, main, false)
        beam([side * 0.16, 0.25, -0.18], [side * 0.16, 0.25, 0.18], 0.02, main, false)
      }
      box([0.36, 0.045, 0.03], [0, h - 0.025, -0.2])
      beam([-0.15, 0.68, -0.19], [0.15, 0.865, -0.2], 0.025, main, false)
      beam([0.15, 0.68, -0.19], [-0.15, 0.865, -0.2], 0.025, main, false)
      beam([-0.17, 0.25, 0.18], [0.17, 0.25, 0.18], 0.02, main, false)
      break
    }
    case 'micke': {
      box([w, 0.035, d], [0, h - 0.0175, 0])
      cabinet(1, 1, 0, 0.32, d, h - 0.04, -(w - 0.32) / 2)
      box([w - 0.35, 0.09, d - 0.02], [0.16, h - 0.09, 0])
      for (const z of [-1, 1])
        box([0.025, h - 0.035, 0.025], [w / 2 - 0.025, (h - 0.035) / 2, z * (d / 2 - 0.025)], metal)
      box([0.025, 0.025, d - 0.025], [w / 2 - 0.025, 0.02, 0], metal)
      cylinder(0.025, 0.003, [w * 0.25, h + 0.001, -d * 0.32], dark)
      break
    }
    case 'markus': {
      cylinder(0.032, 0.44, [0, 0.28, 0], metal)
      for (let i = 0; i < 5; i++) {
        const a = (i * Math.PI * 2) / 5
        const x = Math.cos(a) * 0.27
        const z = Math.sin(a) * 0.27
        beam([0, 0.15, 0], [x, 0.08, z], 0.025, metal)
        cylinder(0.033, 0.04, [x, 0.04, z], dark, 0.033, [Math.PI / 2, 0, a])
      }
      box([0.53, 0.1, 0.47], [0, 0.57, 0.03], main, 0.04)
      box([0.045, 0.64, 0.045], [0, 0.88, -0.23], dark)
      box([0.44, 0.56, 0.035], [0, 0.96, -0.24], material('#777f7b', 'mesh'), 0.045, [-0.06, 0, 0])
      box([0.38, 0.18, 0.08], [0, 1.31, -0.255], main, 0.04)
      for (const side of [-1, 1]) {
        beam([side * 0.255, 0.52, 0], [side * 0.29, 0.74, 0], 0.018, dark)
        box([0.06, 0.045, 0.27], [side * 0.28, 0.755, 0.005], dark, 0.015)
      }
      break
    }
    case 'metod-base':
    case 'metod-wall':
      cabinet(product.id === 'metod-wall' ? 1 : 0)
      break
    case 'enhet': {
      for (const x of [-1, 1])
        for (const z of [-1, 1]) box([0.022, h, 0.022], [x * (w / 2 - 0.011), h / 2, z * (d / 2 - 0.011)])
      for (const y of [0.05, h - 0.02]) {
        box([w, 0.02, 0.025], [0, y, -d / 2 + 0.012])
        box([w, 0.02, 0.025], [0, y, d / 2 - 0.012])
      }
      box([w - 0.03, 0.012, d - 0.03], [0, 0.06, 0])
      break
    }
    case 'nissafors': {
      for (const x of [-1, 1])
        for (const z of [-1, 1]) {
          box([0.015, h - 0.05, 0.015], [x * (w / 2 - 0.02), (h + 0.05) / 2, z * (d / 2 - 0.02)])
          cylinder(0.025, 0.025, [x * (w / 2 - 0.025), 0.025, z * (d / 2 - 0.025)], dark, 0.025, [Math.PI / 2, 0, 0])
        }
      for (const y of [0.1, 0.43, 0.77]) {
        box([w - 0.02, 0.012, d - 0.02], [0, y, 0])
        for (const x of [-1, 1]) box([0.009, 0.055, d - 0.02], [x * (w / 2 - 0.015), y + 0.025, 0])
        for (const z of [-1, 1]) box([w - 0.02, 0.055, 0.009], [0, y + 0.025, z * (d / 2 - 0.015)])
      }
      break
    }
    case 'ranarp': {
      cylinder(0.14, 0.028, [-0.24, 0.014, 0])
      beam([-0.24, 0.03, 0], [-0.24, 1.15, 0], 0.012, main)
      beam([-0.24, 1.15, 0], [0.25, 1.42, 0], 0.013, main)
      for (const p of [
        [-0.24, 1.15, 0],
        [0.25, 1.42, 0],
      ])
        cylinder(0.029, 0.028, p, brass, 0.029, [Math.PI / 2, 0, 0])
      cylinder(0.12, 0.2, [0.25, 1.32, 0], main, 0.045, [0, 0, -0.28])
      cylinder(0.105, 0.004, [0.275, 1.224, 0], material('#fff0c8'), 0.105, [0, 0, -0.28])
      break
    }
    case 'lohals':
      box([w, h, d], [0, h / 2, 0], main, 0.003)
      break
    default:
      throw new Error(`Missing authored model for ${product.id}`)
  }
  // Normalize finished mesh bounds to the verified assembled envelope, with the origin at floor centre.
  group.updateMatrixWorld(true)
  const bounds = new THREE.Box3().setFromObject(group, true)
  const size = bounds.getSize(new THREE.Vector3())
  const centre = bounds.getCenter(new THREE.Vector3())
  for (const mesh of group.children) {
    mesh.position.sub(new THREE.Vector3(centre.x, bounds.min.y, centre.z))
  }
  group.scale.set(w / size.x, h / size.y, d / size.z)
  group.updateMatrixWorld(true)
  const merged = new THREE.Group()
  merged.name = `${product.family} ${product.name}`
  const byMaterial = new Map()
  for (const mesh of group.children) {
    const geometry = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld)
    const compatible = geometry.index ? geometry.toNonIndexed() : geometry
    const key = mesh.material.name
    if (!byMaterial.has(key)) byMaterial.set(key, { material: mesh.material, geometries: [] })
    byMaterial.get(key).geometries.push(compatible)
  }
  for (const { material, geometries } of byMaterial.values())
    merged.add(new THREE.Mesh(mergeGeometries(geometries), material))
  return merged
}

async function texturedGlb(buffer, textures) {
  const source = Buffer.from(buffer)
  const jsonLength = source.readUInt32LE(12)
  const json = JSON.parse(source.subarray(20, 20 + jsonLength).toString())
  const binaryOffset = 20 + jsonLength + 8
  const parts = [source.subarray(binaryOffset)]
  let length = parts[0].length
  json.images = []
  json.textures = []
  json.samplers = [{ magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 10497 }]
  const indices = new Map()
  for (const material of json.materials) {
    const kind = material.name.split(':')[0]
    if (!textures[kind]) continue
    if (!indices.has(kind)) {
      const data = textures[kind]
      const padding = Buffer.alloc((4 - (data.length % 4)) % 4)
      const view = json.bufferViews.length
      json.bufferViews.push({ buffer: 0, byteOffset: length, byteLength: data.length })
      parts.push(data, padding)
      length += data.length + padding.length
      const index = json.images.length
      json.images.push({ bufferView: view, mimeType: 'image/png' })
      json.textures.push({ sampler: 0, source: index })
      indices.set(kind, index)
    }
    material.pbrMetallicRoughness.baseColorTexture = { index: indices.get(kind) }
  }
  json.buffers[0].byteLength = length
  const raw = Buffer.from(JSON.stringify(json))
  const encoded = Buffer.concat([raw, Buffer.alloc((4 - (raw.length % 4)) % 4, 32)])
  const header = Buffer.alloc(20)
  header.writeUInt32LE(0x46546c67)
  header.writeUInt32LE(2, 4)
  header.writeUInt32LE(28 + encoded.length + length, 8)
  header.writeUInt32LE(encoded.length, 12)
  header.writeUInt32LE(0x4e4f534a, 16)
  const binHeader = Buffer.alloc(8)
  binHeader.writeUInt32LE(length)
  binHeader.writeUInt32LE(0x004e4942, 4)
  return Buffer.concat([header, encoded, binHeader, ...parts])
}

async function main() {
  const { values } = parseArgs({
    options: {
      output: { type: 'string', default: 'public/models/interior' },
      help: { type: 'boolean', default: false },
    },
  })
  if (values.help) {
    console.log('Usage: node scripts/build-interior-assets.mjs [--output public/models/interior]')
    return
  }
  const output = resolve(root, values.output)
  await mkdir(output, { recursive: true })
  // Three's exporter expects this browser API when serializing binary buffers.
  globalThis.FileReader = class {
    readAsArrayBuffer(blob) {
      blob.arrayBuffer().then((result) => {
        this.result = result
        this.onloadend?.()
      })
    }
    readAsDataURL(blob) {
      blob.arrayBuffer().then((result) => {
        this.result = `data:${blob.type};base64,${Buffer.from(result).toString('base64')}`
        this.onloadend?.()
      })
    }
  }
  const products = JSON.parse(await readFile(resolve(root, 'src/domain/ikea-products.json'), 'utf8'))
  const textures = Object.fromEntries(
    await Promise.all(
      ['linen', 'jute', 'oak', 'mesh', 'paint'].map(async (name) => [
        name,
        await readFile(resolve(root, `scripts/textiles/${name}.png`)),
      ]),
    ),
  )
  const manifest = []
  for (const product of products) {
    const assets = []
    for (const mobile of [false, true]) {
      const scene = furniture(product, mobile)
      const raw = await new GLTFExporter().parseAsync(scene, { binary: true })
      const glb = await texturedGlb(raw, textures)
      const filename = `${product.id}${mobile ? '-mobile' : ''}.glb`
      await writeFile(resolve(output, filename), glb)
      const bounds = new THREE.Box3().setFromObject(scene)
      assets.push({
        filename,
        bytes: glb.length,
        triangles: scene.children.reduce((sum, mesh) => sum + mesh.geometry.attributes.position.count / 3, 0),
        bounds: { min: bounds.min.toArray(), max: bounds.max.toArray() },
      })
    }
    manifest.push({
      ...product,
      assets,
      footprintM: [
        [-product.size[0] / 2, -product.size[1] / 2],
        [product.size[0] / 2, -product.size[1] / 2],
        [product.size[0] / 2, product.size[1] / 2],
        [-product.size[0] / 2, product.size[1] / 2],
      ],
      footprintType: 'conservative assembled envelope',
      origin: 'floor-centre',
      axes: 'Y up; front +Z; metres',
      visualFidelity: 'Independently authored product study; not an official manufacturer mesh.',
    })
    console.log(`Built ${product.family} ${product.name}`)
  }
  await writeFile(
    resolve(output, 'manifest.json'),
    JSON.stringify(
      { version: 1, generatedAt: new Date().toISOString(), license: 'CC0-1.0', products: manifest },
      null,
      2,
    ) + '\n',
  )
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main().catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
