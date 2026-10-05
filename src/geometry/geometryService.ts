import type { BuildingModel } from '../domain/types'
import { atticWallProfile } from '../domain/attic'
import type { GeneratedSolid, GeometryWorkerRequest, GeometryWorkerResponse, SolidInput } from './types'

type Pending = { resolve: (solids: GeneratedSolid[]) => void; reject: (reason: unknown) => void }

export const solidInputsForBuilding = (building: BuildingModel): SolidInput[] => [
  ...building.slabs.map((slab) => ({ kind: 'slab' as const, ref: slab.ref, footprint: slab.footprint, holes: slab.holes, topElevationM: slab.topElevationM, thicknessM: slab.thicknessM })),
  ...building.walls.map((wall) => ({ kind: 'wall' as const, ref: wall.ref, start: wall.start, end: wall.end, baseElevationM: wall.baseElevationM, heightM: wall.heightM, thicknessM: wall.thicknessM, topProfile: atticWallProfile(building, wall), openings: wall.openings.map(({ offsetM, widthM, heightM, sillM }) => ({ offsetM, widthM, heightM, sillM })) })),
]

export class GeometryService {
  private worker: Worker | null = null
  private sequence = 0
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
      pending.resolve(event.data.solids)
    }
    this.worker = worker
    return worker
  }

  async generate(revision: number, elements: SolidInput[]) {
    // Revisions are local to a project and can decrease on undo or a study switch.
    // Keep results per request; the consuming effect rejects superseded requests.
    const results = new Map<string, GeneratedSolid>()
    const uncached = elements.filter((element) => {
      const cached = this.cache.get(element.ref)
      if (cached?.signature !== JSON.stringify(element)) return true
      results.set(element.ref, cached.solid)
      return false
    })
    if (uncached.length) {
      const requestId = ++this.sequence
      const request: GeometryWorkerRequest = { requestId, revision, elements: uncached }
      const solids = await new Promise<GeneratedSolid[]>((resolve, reject) => {
        this.pending.set(requestId, { resolve, reject })
        this.ensureWorker().postMessage(request)
      })
      solids.forEach((solid) => {
        const input = uncached.find((element) => element.ref === solid.ref)!
        this.cache.set(solid.ref, { signature: JSON.stringify(input), solid })
        results.set(solid.ref, solid)
      })
    }
    return elements.map((element) => results.get(element.ref)).filter((solid): solid is GeneratedSolid => Boolean(solid))
  }

  dispose() {
    this.worker?.terminate(); this.worker = null
    this.pending.forEach(({ reject }) => reject(new DOMException('Geometry generation disposed.', 'AbortError')))
    this.pending.clear(); this.cache.clear()
  }
}

export const geometryService = new GeometryService()
