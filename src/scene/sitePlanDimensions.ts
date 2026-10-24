import { polygonSignedArea } from '../domain/geometry'
import { planMetres, sitePlanEdges, type SitePlanElement } from '../domain/sitePlan'
import type { Vec2 } from '../domain/types'

export function sitePlanDimensions(element: SitePlanElement, screen: (point: Vec2) => { x: number; y: number }) {
  const side = element.points.length > 2 && polygonSignedArea(element.points) < 0 ? -1 : 1
  return sitePlanEdges(element).flatMap(([a, b], edge) => {
    const p = screen(a), q = screen(b), dx = q.x - p.x, dy = q.y - p.y, length = Math.hypot(dx, dy)
    if (length < 1) return []
    const nx = side * dy / length, ny = -side * dx / length, offset = element.diameterM ? 0 : 18
    const u = { x: p.x + nx * offset, y: p.y + ny * offset }, v = { x: q.x + nx * offset, y: q.y + ny * offset }
    const anchor = { x: (u.x + v.x) / 2, y: (u.y + v.y) / 2 }
    const center = { x: anchor.x + nx * 9, y: anchor.y + ny * 9 }
    const text = `${element.diameterM ? 'Ø ' : ''}${planMetres(Math.hypot(b.x - a.x, b.z - a.z))}`
    let angle = Math.atan2(dy, dx) * 180 / Math.PI
    if (angle > 90) angle -= 180
    if (angle < -90) angle += 180
    const radians = angle * Math.PI / 180, textWidth = text.length * 6.5 + 8
    const width = Math.abs(Math.cos(radians)) * textWidth + Math.abs(Math.sin(radians)) * 17
    const height = Math.abs(Math.sin(radians)) * textWidth + Math.abs(Math.cos(radians)) * 17
    const tx = (dx / length + nx) * 3, ty = (dy / length + ny) * 3
    const path = `M ${p.x} ${p.y} l ${nx * (offset + 5)} ${ny * (offset + 5)} M ${q.x} ${q.y} l ${nx * (offset + 5)} ${ny * (offset + 5)} M ${u.x} ${u.y} L ${v.x} ${v.y} M ${u.x - tx} ${u.y - ty} l ${tx * 2} ${ty * 2} M ${v.x - tx} ${v.y - ty} l ${tx * 2} ${ty * 2}`
    return [{ edge, length, textWidth, text, angle, center, anchor, path, x: center.x - width / 2, y: center.y - height / 2, width, height }]
  })
}
