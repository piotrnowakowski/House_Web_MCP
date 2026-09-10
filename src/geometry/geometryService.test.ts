import { afterEach, expect, it, vi } from 'vitest'
import { GeometryService } from './geometryService'
import type { GeneratedSolid, GeometryWorkerRequest, GeometryWorkerResponse, SolidInput } from './types'

class TestWorker {
  static latest: TestWorker
  requests: GeometryWorkerRequest[] = []
  onmessage: ((event: { data: GeometryWorkerResponse }) => void) | null = null
  constructor() { TestWorker.latest = this }
  postMessage(request: GeometryWorkerRequest) { this.requests.push(request) }
  terminate() {}
  finish(index: number) {
    const request = this.requests[index]
    const solids: GeneratedSolid[] = request.elements.map(e => ({ ref: e.ref, positions: new Float32Array([e.kind === 'slab' ? e.topElevationM : e.heightM]),
      uvs: new Float32Array(), indices: new Uint32Array(), collider: { ref: e.ref, center: [0, 0, 0], halfExtents: [1, 1, 1], rotationY: 0 } }))
    this.onmessage?.({ data: { requestId: request.requestId, revision: request.revision, solids } })
  }
}
const slab = (height: number): SolidInput => ({ kind: 'slab', ref: 'slab/shared-ref', footprint: [{ x: 0, z: 0 }, { x: 1, z: 0 }, { x: 1, z: 1 }], topElevationM: height, thicknessM: .2 })
afterEach(() => vi.unstubAllGlobals())

it('generates geometry when switching from r46 to r1 and when undo lowers a revision', async () => {
  vi.stubGlobal('Worker', TestWorker)
  const service = new GeometryService()
  for (const [revision, height] of [[46, 3], [1, 2], [0, 1]]) {
    const pending = service.generate(revision, [slab(height)])
    TestWorker.latest.finish(TestWorker.latest.requests.length - 1)
    expect((await pending)[0].positions[0]).toBe(height)
  }
  service.dispose()
})

it('keeps each caller’s requested geometry when responses with the same entity ref arrive out of order', async () => {
  vi.stubGlobal('Worker', TestWorker)
  const service = new GeometryService()
  const first = service.generate(46, [slab(3)])
  const second = service.generate(1, [slab(2)])
  TestWorker.latest.finish(1)
  TestWorker.latest.finish(0)
  expect((await first)[0].positions[0]).toBe(3)
  expect((await second)[0].positions[0]).toBe(2)
  const fresh = service.generate(1, [slab(2)])
  TestWorker.latest.finish(2)
  expect((await fresh)[0].positions[0]).toBe(2)
  service.dispose()
})
