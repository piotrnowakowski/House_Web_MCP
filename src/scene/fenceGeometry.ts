import { BoxGeometry } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/** Local x follows the boundary, positive z is inside the enclosure. */
export function fenceGeometry(length: number, height: number, material: 'concrete' | 'panel' | 'gate') {
  const parts: BoxGeometry[] = []
  const box = (x: number, y: number, w: number, h: number, d: number) =>
    parts.push(new BoxGeometry(w, h, d).translate(x, y, 0.1))
  const count = material === 'gate' ? 2 : Math.ceil(length / 2.5), span = length / count
  for (let i = 0; i <= count; i++) {
    if (material === 'gate' && i === 1) continue
    // Endpoint posts stay outside the clear gate span.
    const inset = material === 'gate' ? -0.05 : 0.05
    const x = -length / 2 + i * span + (i === 0 ? inset : i === count ? -inset : 0)
    box(x, height / 2, 0.1, height, 0.2)
  }
  for (let i = 0; i < count; i++) {
    const x = -length / 2 + (i + 0.5) * span, width = span - 0.02
    if (material === 'concrete') {
      const courses = Math.ceil(height / 0.45), course = height / courses
      for (let row = 0; row < courses; row++) box(x, (row + 0.5) * course, width, course - 0.008, 0.12)
    } else {
      for (const y of [0.12, height - 0.06]) box(x, y, width, 0.04, 0.04)
      if (material === 'gate') {
        for (const edge of [-1, 1]) box(x + edge * (width / 2 - 0.02), height / 2, 0.04, height - 0.12, 0.05)
      }
      const wires = Math.ceil(width / (material === 'gate' ? 0.12 : 0.1))
      for (let wire = 1; wire < wires; wire++) box(x - width / 2 + wire * width / wires, height / 2, material === 'gate' ? 0.07 : 0.008, height - 0.2, material === 'gate' ? 0.035 : 0.008)
      if (material === 'panel') for (let y = 0.3; y < height - 0.15; y += 0.2) box(x, y, width, 0.008, 0.008)
    }
  }
  const geometry = mergeGeometries(parts)!
  parts.forEach(part => part.dispose())
  return geometry
}
