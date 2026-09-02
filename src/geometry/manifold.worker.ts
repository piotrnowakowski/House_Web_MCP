/// <reference lib="webworker" />
import { getManifoldModule, setWasmUrl } from 'manifold-3d/lib/wasm'
import wasmUrl from 'manifold-3d/manifold.wasm?url'
import type { Manifold, ManifoldToplevel } from 'manifold-3d'
import type { GeneratedSolid, GeometryWorkerRequest, GeometryWorkerResponse, SolidInput } from './types'

const copyMesh = (ref: string, solid: Manifold, collider: GeneratedSolid['collider']): GeneratedSolid => {
  const mesh = solid.getMesh()
  const positions = new Float32Array(mesh.numVert * 3)
  for (let vertex = 0; vertex < mesh.numVert; vertex += 1) {
    const source = vertex * mesh.numProp
    positions[vertex * 3] = mesh.vertProperties[source]
    positions[vertex * 3 + 1] = mesh.vertProperties[source + 1]
    positions[vertex * 3 + 2] = mesh.vertProperties[source + 2]
  }
  return { ref, positions, indices: new Uint32Array(mesh.triVerts), collider }
}

setWasmUrl(wasmUrl)
const manifoldModule = getManifoldModule()

const buildSolid = (element: SolidInput, module: ManifoldToplevel): GeneratedSolid => {
  const { Manifold } = module
  const owned: Manifold[] = []
  try {
    if (element.kind === 'slab') {
      const polygon = element.footprint.map((point) => [point.x, -point.z] as [number, number])
      const extruded = Manifold.extrude([polygon], element.thicknessM)
      owned.push(extruded)
      const rotated = extruded.rotate([-90, 0, 0])
      owned.push(rotated)
      const translated = rotated.translate([0, element.topElevationM - element.thicknessM, 0])
      owned.push(translated)
      const xs = element.footprint.map((point) => point.x)
      const zs = element.footprint.map((point) => point.z)
      const minX = Math.min(...xs); const maxX = Math.max(...xs); const minZ = Math.min(...zs); const maxZ = Math.max(...zs)
      return copyMesh(element.ref, translated, {
        ref: element.ref,
        center: [(minX + maxX) / 2, element.topElevationM - element.thicknessM / 2, (minZ + maxZ) / 2],
        halfExtents: [(maxX - minX) / 2, element.thicknessM / 2, (maxZ - minZ) / 2], rotationY: 0,
      })
    }

    const dx = element.end.x - element.start.x; const dz = element.end.z - element.start.z
    const length = Math.hypot(dx, dz)
    let current = Manifold.cube([length, element.heightM, element.thicknessM], true)
    owned.push(current)
    for (const opening of element.openings) {
      const cut = Manifold.cube([opening.widthM + 0.02, opening.heightM + 0.02, element.thicknessM * 2.2], true)
        .translate([opening.offsetM - length / 2, opening.sillM + opening.heightM / 2 - element.heightM / 2, 0])
      owned.push(cut)
      const next = current.subtract(cut)
      owned.push(next)
      current = next
    }
    const rotationDegrees = -Math.atan2(dz, dx) * 180 / Math.PI
    const rotated = current.rotate([0, rotationDegrees, 0]); owned.push(rotated)
    const translated = rotated.translate([(element.start.x + element.end.x) / 2, element.baseElevationM + element.heightM / 2, (element.start.z + element.end.z) / 2]); owned.push(translated)
    return copyMesh(element.ref, translated, {
      ref: element.ref,
      center: [(element.start.x + element.end.x) / 2, element.baseElevationM + element.heightM / 2, (element.start.z + element.end.z) / 2],
      halfExtents: [length / 2, element.heightM / 2, element.thicknessM / 2], rotationY: -Math.atan2(dz, dx),
    })
  } finally {
    const unique = [...new Set(owned)]
    for (const solid of unique.reverse()) solid.delete()
  }
}

self.onmessage = async (event: MessageEvent<GeometryWorkerRequest>) => {
  const { requestId, revision, elements } = event.data
  try {
    const module = await manifoldModule
    const solids = elements.map((element) => buildSolid(element, module))
    const response: GeometryWorkerResponse = { requestId, revision, solids }
    self.postMessage(response, solids.flatMap((solid) => [solid.positions.buffer, solid.indices.buffer]))
  } catch (error) {
    const response: GeometryWorkerResponse = { requestId, revision, solids: [], error: error instanceof Error ? error.message : 'Manifold geometry failed.' }
    self.postMessage(response)
  }
}

export {}
