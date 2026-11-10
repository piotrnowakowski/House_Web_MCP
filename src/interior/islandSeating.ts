import type { InteriorItem } from '../domain/types'

/** Local x intervals: recess plus the full-depth cabinets beside it. Seating faces +z. */
export function islandSeating(item: Pick<InteriorItem, 'widthM' | 'seatingWidthM' | 'seatingOffsetM'>) {
  const half = item.widthM / 2, width = item.seatingWidthM ?? item.widthM
  const centre = item.seatingOffsetM ?? 0
  const start = centre - width / 2, end = centre + width / 2
  const cabinets = [[-half, start], [end, half]]
    .filter(([a, b]) => b - a > 1e-8)
    .map(([a, b]) => ({ width: b - a, centre: (a + b) / 2 }))
  return { width, centre, start, end, cabinets }
}
