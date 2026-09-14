import { gableGlazingProfile } from './gableGlazing'
import { wallLength } from './geometry'
import type { BuildingModel, StoreyModel } from './types'

/** Projected jambs of continuous bedroom gable glazing, used to align partitions. */
export function gablePlanGuides(building: BuildingModel, storey: StoreyModel) {
  if (storey.level <= 0) return []
  const guides = new Map<string, { ref: string; start: { x: number; z: number }; end: { x: number; z: number }; width: number }>()
  const bedroomWalls = new Set(building.spaces.filter(s => storey.spaceRefs.includes(s.ref) && s.usage === 'bedroom').flatMap(s => s.boundary.map(b => b.wallRef)))
  for (const roof of building.roof.segments) for (const side of ['min', 'max'] as const) {
    for (const panel of gableGlazingProfile(roof, side, building)?.panels ?? []) {
      const wall = building.walls.find(w => storey.wallRefs.includes(w.ref) && w.openings.some(o => o.ref === panel.hostRef))
      if (!wall || !panel.hostRef || !panel.connected || !bedroomWalls.has(wall.ref) || !wallLength(wall)) continue
      const across = roof.ridgeDirection === 'z' ? 'x' : 'z'
      const along = across === 'x' ? 'z' : 'x'
      const min = Math.min(...panel.opening.map(p => p.x)), max = Math.max(...panel.opening.map(p => p.x))
      const point = (value: number) => ({ ...wall.start, [across]: value, [along]: wall.start[along] })
      guides.set(panel.hostRef, { ref: panel.hostRef, start: point(min), end: point(max), width: max - min })
    }
  }
  return [...guides.values()]
}
