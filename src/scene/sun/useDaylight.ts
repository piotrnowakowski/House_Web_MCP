import { useEffect, useMemo, useState } from 'react'
import type { MeshBVH } from 'three-mesh-bvh'
import type { BuildingModel, ProjectV2, StoreyModel, Vec2, Vec3 } from '../../domain/types'
import { assessDaylight, daylightFloor, daylightObstacles, daylightSample, LIGHT_LEVELS, type DaylightSample } from './daylight'

export function useDaylight(mesh: MeshBVH | null, project: ProjectV2, building: BuildingModel, floor: StoreyModel,
  point: Vec2 | null, showZones: boolean, sun: Vec3, trees: boolean, neighbors: boolean) {
  const rays = useMemo(() => mesh && daylightObstacles(mesh, project, building, trees, neighbors), [mesh, project, building, trees, neighbors])
  const grid = useMemo(() => daylightFloor(building, floor), [building, floor])
  const sample = useMemo(() => rays && point && daylightSample(building, floor, point, rays), [building, floor, rays, point])
  const reading = useMemo(() => sample && rays && assessDaylight(sample, sun, rays.blocked), [sample, sun, rays])

  // Only sky visibility is expensive. Compute it once per cell in short slices, leaving
  // touch and the timeline responsive. Changes to the sun only need one ray per cell.
  const [prepared, setPrepared] = useState<{ grid: typeof grid; rays: typeof rays; samples: DaylightSample[] } | null>(null)
  const ready = prepared?.grid === grid && prepared.rays === rays ? prepared.samples : null
  useEffect(() => {
    if (!showZones || !rays || ready) return
    const samples: DaylightSample[] = []
    let timer = window.setTimeout(step, 0)
    function step() {
      const deadline = performance.now() + 7
      while (samples.length < grid.cells.length && performance.now() < deadline) {
        samples.push(daylightSample(building, floor, grid.cells[samples.length], rays!))
      }
      if (samples.length === grid.cells.length) setPrepared({ grid, rays, samples })
      else timer = window.setTimeout(step, 0)
    }
    return () => window.clearTimeout(timer)
  }, [showZones, rays, ready, grid, building, floor])
  const paths = useMemo(() => {
    if (!ready || !rays || !showZones) return null
    const segments = LIGHT_LEVELS.map(() => [] as string[])
    const size = Number(grid.cell.toFixed(4))
    ready.forEach((sample, i) => {
      const { level } = assessDaylight(sample, sun, rays.blocked)
      const { x, z } = grid.cells[i]
      segments[level].push(`M${(x - size / 2).toFixed(4)} ${(z - size / 2).toFixed(4)}h${size}v${size}h-${size}Z`)
    })
    return segments.map(segment => segment.join(''))
  }, [ready, rays, showZones, sun, grid])
  return { grid, reading, paths }
}
