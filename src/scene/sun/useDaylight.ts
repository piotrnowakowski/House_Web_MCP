import { useEffect, useMemo, useState } from 'react'
import type { MeshBVH } from 'three-mesh-bvh'
import { pointInPolygon } from '../../domain/geometry'
import type { BuildingModel, Polygon2, ProjectV2, StoreyModel, Vec2, Vec3 } from '../../domain/types'
import { assessDaylight, daylightFloor, daylightObstacles, daylightSample, LIGHT_LEVELS, type DaylightSample } from './daylight'

export function useDaylight(mesh: MeshBVH | null, project: ProjectV2, building: BuildingModel, floor: StoreyModel,
  point: Vec2 | null, showZones: boolean, sun: Vec3, trees: boolean, neighbors: boolean, room?: Polygon2) {
  const rays = useMemo(() => mesh && daylightObstacles(mesh, project, building, trees, neighbors), [mesh, project, building, trees, neighbors])
  const grid = useMemo(() => {
    const floorGrid = daylightFloor(building, floor)
    return room ? { ...floorGrid, cells: floorGrid.cells.filter(p => pointInPolygon(p, room)) } : floorGrid
  }, [building, floor, room])
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
  const map = useMemo(() => {
    if (!ready || !rays || !showZones) return null
    const segments = LIGHT_LEVELS.map(() => [] as string[])
    const size = Number(grid.cell.toFixed(4))
    const bands = room ? new Uint8Array(ready.length) : null
    let bright = 0, direct = 0
    ready.forEach((sample, i) => {
      const { level, direct: inSun } = assessDaylight(sample, sun, rays.blocked)
      if (bands) bands[i] = level
      if (level >= 6) bright++
      if (inSun) direct++
      const { x, z } = grid.cells[i]
      segments[level].push(`M${(x - size / 2).toFixed(4)} ${(z - size / 2).toFixed(4)}h${size}v${size}h-${size}Z`)
    })
    return { paths: segments.map(segment => segment.join('')), bands, coverage: ready.length ? { bright: Math.round(100 * bright / ready.length), direct: Math.round(100 * direct / ready.length) } : null }
  }, [ready, rays, showZones, sun, grid, room])
  return { grid, reading, paths: map?.paths ?? null, coverage: map?.coverage ?? null, bands: map?.bands ?? null }
}
