import { useFrame, useThree } from '@react-three/fiber'
import { layoutPlanLabels, type LabelRect } from './labelLayout'

/** Runs after the Html anchors update, using CSS pixels so zoom and rotation stay readable. */
export function PlanLabelLayout() {
  const { gl } = useThree()
  useFrame(() => {
    const root = gl.domElement.closest('.interior-editor')
    if (!root) return
    const elements = [...root.querySelectorAll<HTMLElement>('[data-plan-label]')]
    const rect = (element: Element): LabelRect => {
      const r = element.getBoundingClientRect()
      return { x: r.left, y: r.top, width: r.width, height: r.height }
    }
    const obstacles = [...root.querySelectorAll('.interior-header,.interior-floor-switcher,.interior-mobile-history,.interior-action-bar,.adaptive-sheet,.interior-tool-prompt')].map(rect)
    const saveBar = document.querySelector('.workspace-save-bar')
    if (saveBar) obstacles.push(rect(saveBar))
    const labels = elements.flatMap((element, id) => {
      if (element.dataset.spaceVisible === 'false') return []
      const box = rect(element)
      if (!box.width || !box.height) return []
      return [{ ...box, x: box.x - +(element.dataset.labelDx ?? 0), y: box.y - +(element.dataset.labelDy ?? 0), id, priority: +(element.dataset.planLabel ?? 0), movable: element.dataset.movable === 'true' }]
    })
    const layout = layoutPlanLabels(labels, rect(gl.domElement), obstacles)
    elements.forEach((element, id) => {
      const placed = layout.get(id)
      const dx = placed?.dx ?? 0, dy = placed?.dy ?? 0
      element.style.visibility = placed?.visible ? 'visible' : 'hidden'
      element.style.translate = `${dx}px ${dy}px`
      element.dataset.labelDx = String(dx)
      element.dataset.labelDy = String(dy)
      // A leader connects shifted clearance labels to their original measurement anchor.
      const leader = element.querySelector<HTMLElement>('.interior-label-leader')
      if (leader) {
        leader.style.width = `${Math.hypot(dx, dy)}px`
        leader.style.transform = `rotate(${Math.atan2(-dy, -dx)}rad)`
      }
    })
  })
  return null
}
