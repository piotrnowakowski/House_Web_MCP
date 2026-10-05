import { grassBladePoints, type GrassAttributes } from './grassGeometry'
import type { ProjectV2 } from '../domain/types'

self.onmessage = (event: MessageEvent<{ project: ProjectV2; candidates: number }>) => {
  const blades = grassBladePoints(event.data.project, event.data.candidates)
  const attributes: GrassAttributes = {
    offsets: new Float32Array(blades.length * 3),
    angles: new Float32Array(blades.length),
    heights: new Float32Array(blades.length),
    shades: new Float32Array(blades.length),
  }
  blades.forEach((blade, index) => {
    attributes.offsets.set([blade.x, blade.y, blade.z], index * 3)
    attributes.angles[index] = blade.angle
    attributes.heights[index] = blade.height
    attributes.shades[index] = blade.shade
  })
  self.postMessage(attributes, { transfer: Object.values(attributes).map(array => array.buffer) })
}
