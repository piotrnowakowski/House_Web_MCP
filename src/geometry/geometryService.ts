import type { BuildingModel } from '../domain/types'
import type { GeneratedSolid, GeometryWorkerRequest, GeometryWorkerResponse, SolidInput } from './types'

type Pending = { revision: number; resolve: (solids: GeneratedSolid[]) => void; reject: (reason: unknown) => void }

export const solidInputsForBuilding = (building: BuildingModel): SolidInput[] => [
  ...building.slabs.map((slab) => ({ kind: 'slab' as const, ref: slab.ref, footprint: slab.footprint, topElevationM: slab.topElevationM, thicknessM: slab.thicknessM })),
  ...building.walls.map((wall) => ({ kind: 'wall' as const, ref: wall.ref, start: wall.start, end: wall.end, baseElevationM: wall.baseElevationM, heightM: wall.heightM, thicknessM: wall.thicknessM, openings: wall.openings.map(({ offsetM, widthM, heightM, sillM }) => ({ offsetM, widthM, heightM, sillM })) })),
]

class GeometryService {
  private worker: Worker | null = null
  private sequence = 0
  private latestRevision = -1
  private pending = new Map<number, Pending>()
  private cache = new Map<string, { signature: string; solid: GeneratedSolid }>()

  private ensureWorker() {
    if (this.worker) return this.worker
    const worker = new Worker(new URL('./manifold.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (event: MessageEvent<GeometryWorkerResponse>) => {
      const pending = this.pending.get(event.data.requestId)
      if (!pending) return
      this.pending.delete(event.data.requestId)
      if (event.data.error) { pending.reject(new Error(event.data.error)); return }
      if (event.data.revision !== this.latestRevision) { pending.resolve([]); return }
      pending.resolve(event.data.solids)
    }
    this.worker = worker
    return worker
  }

  async generate(revision: number, elements: SolidInput[]) {
    this.latestRevision = Math.max(this.latestRevision, revision)
    const uncached = elements.filter((element) => this.cache.get(element.ref)?.signature !== JSON.stringify(element))
    if (uncached.length) {
      const requestId = ++this.sequence
      const request: GeometryWorkerRequest = { requestId, revision, elements: uncached }
      const solids = await new Promise<GeneratedSolid[]>((resolve, reject) => {
        this.pending.set(requestId, { revision, resolve, reject })
        this.ensureWorker().postMessage(request)
      })
      if (revision !== this.latestRevision) return []
      solids.forEach((solid) => {
        const input = uncached.find((element) => element.ref === solid.ref)!
        this.cache.set(solid.ref, { signature: JSON.stringify(input), solid })
      })
    }
    return elements.map((element) => this.cache.get(element.ref)?.solid).filter((solid): solid is GeneratedSolid => Boolean(solid))
  }

  dispose() {
    this.worker?.terminate(); this.worker = null
    this.pending.forEach(({ reject }) => reject(new DOMException('Geometry generation disposed.', 'AbortError')))
    this.pending.clear(); this.cache.clear()
  }
}

export const geometryService = new GeometryService()
