import { expect, it } from 'vitest'
import type { SitePlanElement } from '../domain/sitePlan'
import { sitePlanDimensions } from './sitePlanDimensions'
import { labelsOverlap, layoutPlanLabels } from '../interior/labelLayout'

const screen = (p: { x: number; z: number }) => ({ x: p.x * 20, y: p.z * 20 })
const rectangle: SitePlanElement = { ref: 'test', name: 'Test', category: 'Wyposażenie', points: [{ x: -3, z: -2 }, { x: 3, z: -2 }, { x: 3, z: 2 }, { x: -3, z: 2 }], summary: '', color: '', priority: 8, developed: true }

it('places dimensions outside either polygon winding and keeps rotated text upright', () => {
  for (const rotation of [0, Math.PI / 4, 2]) for (const reversed of [false, true]) {
    const points = rectangle.points.map(p => ({ x: p.x * Math.cos(rotation) - p.z * Math.sin(rotation), z: p.x * Math.sin(rotation) + p.z * Math.cos(rotation) }))
    if (reversed) points.reverse()
    const dimensions = sitePlanDimensions({ ...rectangle, points }, screen)
    expect(dimensions).toHaveLength(4)
    for (const d of dimensions) {
      const a = screen(points[d.edge]), b = screen(points[(d.edge + 1) % 4]), mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
      expect((d.center.x - mid.x) * mid.x + (d.center.y - mid.y) * mid.y).toBeGreaterThan(0)
      expect(d.angle).toBeGreaterThanOrEqual(-90)
      expect(d.angle).toBeLessThanOrEqual(90)
      expect(d.width).toBeGreaterThan(0)
      expect(d.text).toMatch(/^[46],00 m$/)
      expect(d.path).not.toContain('NaN')
    }
  }
})

it('measures a line once, labels canopy diameter and skips zero-length edges', () => {
  const line = { ...rectangle, points: [{ x: 0, z: 0 }, { x: 5, z: 0 }] }
  expect(sitePlanDimensions(line, screen).map(d => d.text)).toEqual(['5,00 m'])
  const crown = sitePlanDimensions({ ...line, diameterM: 5 }, screen)
  expect(crown[0].text).toBe('Ø 5,00 m')
  expect(crown[0].center.y).toBe(-9)
  expect(sitePlanDimensions({ ...line, points: [{ x: 0, z: 0 }, { x: 0, z: 0 }] }, screen)).toEqual([])
})

it('keeps all six L-shaped house dimensions readable in a narrow mobile drawing', () => {
  const house = { ...rectangle, points: [{ x: 0, z: 0 }, { x: 13.21, z: 0 }, { x: 13.21, z: 10.13 }, { x: 5.57, z: 10.13 }, { x: 5.57, z: 7.75 }, { x: 0, z: 7.75 }] }
  const labels = sitePlanDimensions(house, p => ({ x: 55 + p.x * 9.6, y: 290 + p.z * 9.6 })).map((d, id) => ({ ...d, id, priority: 100, movable: true }))
  const layout = layoutPlanLabels(labels, { x: 6, y: 6, width: 230, height: 610 })
  const placed = labels.map(l => {
    const result = layout.get(l.id)!
    expect(result.visible).toBe(true)
    return { ...l, x: l.x + result.dx, y: l.y + result.dy }
  })
  for (let i = 0; i < placed.length; i++) for (let j = i + 1; j < placed.length; j++) expect(labelsOverlap(placed[i], placed[j])).toBe(false)
})
