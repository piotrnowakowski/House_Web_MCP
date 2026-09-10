import { Material, Mesh, Object3D } from 'three'

/** Nearest semantic object, excluding overlays, hidden objects and proposal previews. */
export function transparencyRef(object: Object3D): string | null {
  let ref: string | null = null
  for (let current: Object3D | null = object; current; current = current.parent) {
    if (!current.visible || current.userData.editorOnly || current.userData.captureSource === 'ghost') return null
    if (!ref && typeof current.userData.semanticRef === 'string') ref = current.userData.semanticRef
  }
  return ref
}

/** Clone per mesh so shared finishes and React's original material instances stay intact. */
export function fadeMesh(mesh: Mesh) {
  const original = mesh.material
  const sources = Array.isArray(original) ? original : [original]
  const copies = sources.map(material => material.clone())
  const faded: Material | Material[] = Array.isArray(original) ? copies : copies[0]
  const castShadow = mesh.castShadow
  mesh.material = faded
  mesh.castShadow = false
  return {
    material: faded,
    update() {
      copies.forEach((copy, index) => {
        // React may update the original finish while this temporary copy is attached.
        copy.copy(sources[index])
        copy.transparent = true
        copy.opacity = Math.min(sources[index].opacity, 0.12)
        copy.depthWrite = false
      })
    },
    restore() {
      if (mesh.material === faded) mesh.material = original
      mesh.castShadow = castShadow
      copies.forEach(material => material.dispose())
    },
  }
}
