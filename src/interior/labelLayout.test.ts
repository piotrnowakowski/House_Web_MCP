import { describe, expect, it } from 'vitest'
import { labelsOverlap, layoutPlanLabels, type PlanLabel } from './labelLayout'

describe('plan label layout', () => {
  const viewport = { x: 0, y: 0, width: 390, height: 844 }
  it('separates coincident clearance values and suppresses overlapping room dimensions', () => {
    const labels: PlanLabel[] = [
      { id: 0, x: 100, y: 300, width: 44, height: 16, priority: 50, movable: true },
      { id: 1, x: 100, y: 300, width: 44, height: 16, priority: 50, movable: true },
      { id: 2, x: 100, y: 300, width: 50, height: 18, priority: 10 },
    ]
    const layout = layoutPlanLabels(labels, viewport)
    expect(layout.get(0)?.visible).toBe(true)
    expect(layout.get(1)?.visible).toBe(true)
    expect(layout.get(2)?.visible).toBe(false)
    const boxes = labels.filter(l => layout.get(l.id)?.visible).map(l => ({ ...l, x: l.x + layout.get(l.id)!.dx, y: l.y + layout.get(l.id)!.dy }))
    expect(labelsOverlap(boxes[0], boxes[1])).toBe(false)
  })
  it('keeps labels inside the viewport and clear of controls', () => {
    const label = { id: 0, x: -10, y: 30, width: 44, height: 16, priority: 50, movable: true }
    expect(layoutPlanLabels([label], viewport, [{ x: 0, y: 0, width: 390, height: 120 }]).get(0)?.visible).toBe(false)
    expect(layoutPlanLabels([{ ...label, x: 340, y: 300 }], viewport).get(0)?.visible).toBe(true)
  })
  it('restores context labels when zoom provides enough separation', () => {
    const labels = [0, 1].map(id => ({ id, x: 100 + id * 30, y: 300, width: 50, height: 16, priority: 10 }))
    expect(layoutPlanLabels(labels, viewport).get(1)?.visible).toBe(false)
    expect(layoutPlanLabels(labels.map(l => ({ ...l, x: l.x * 2 })), viewport).get(1)?.visible).toBe(true)
  })
})
