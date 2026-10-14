export type LabelRect = { x: number; y: number; width: number; height: number }
export type PlanLabel = LabelRect & { id: number; priority: number; movable?: boolean }
export const labelsOverlap = (a: LabelRect, b: LabelRect, gap = 3) =>
  a.x < b.x + b.width + gap && a.x + a.width + gap > b.x &&
  a.y < b.y + b.height + gap && a.y + a.height + gap > b.y

/** Keep important measurements readable, decluttering context before shifting a measurement. */
export function layoutPlanLabels(labels: PlanLabel[], viewport: LabelRect, obstacles: LabelRect[] = []) {
  const occupied = [...obstacles]
  const result = new Map<number, { dx: number; dy: number; visible: boolean }>()
  for (const label of [...labels].sort((a, b) => b.priority - a.priority || a.id - b.id)) {
    const candidates = label.movable ? [[0, 0], [0, -22], [0, 22], [-48, 0], [48, 0], [0, -44], [0, 44]] : [[0, 0]]
    let placement = { dx: 0, dy: 0, visible: false }
    for (const [dx, dy] of candidates) {
      const box = { ...label, x: label.x + dx, y: label.y + dy }
      if (box.x < viewport.x || box.y < viewport.y || box.x + box.width > viewport.x + viewport.width || box.y + box.height > viewport.y + viewport.height) continue
      if (occupied.some(other => labelsOverlap(box, other))) continue
      occupied.push(box)
      placement = { dx, dy, visible: true }
      break
    }
    result.set(label.id, placement)
  }
  return result
}
