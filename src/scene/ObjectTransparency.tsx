import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { Mesh, Raycaster, Vector2 } from 'three'
import { useStudioStore } from '../state/store'
import { fadeMesh, transparencyRef } from './transparencyMaterials'

export function ObjectTransparency() {
  const { gl, scene, camera, invalidate } = useThree()
  const active = useStudioStore(state => state.transparencyMode)
  const refs = useStudioStore(state => state.transparentRefs)
  const faded = useRef(new Map<Mesh, ReturnType<typeof fadeMesh>>())

  useEffect(() => { invalidate() }, [refs, invalidate])
  useEffect(() => {
    const entries = faded.current
    return () => { entries.forEach(entry => entry.restore()); entries.clear() }
  }, [])

  useFrame(() => {
    if (!refs.length && !faded.current.size) return
    const targets = new Set(refs)
    const visible = new Set<Mesh>()
    scene.traverseVisible(object => {
      if (object instanceof Mesh && targets.has(transparencyRef(object) ?? '')) visible.add(object)
    })
    faded.current.forEach((entry, mesh) => {
      if (!visible.has(mesh) || mesh.material !== entry.material) {
        entry.restore()
        faded.current.delete(mesh)
      }
    })
    visible.forEach(mesh => {
      if (!faded.current.has(mesh)) faded.current.set(mesh, fadeMesh(mesh))
      faded.current.get(mesh)!.update()
    })
  })

  useEffect(() => {
    if (!active) return
    const canvas = gl.domElement
    const previousCursor = canvas.style.cursor
    canvas.style.cursor = 'crosshair'
    const raycaster = new Raycaster()
    let start: { x: number; y: number; id: number } | null = null
    const cancel = () => { start = null }
    const down = (event: PointerEvent) => {
      if (!event.isPrimary || event.button !== 0) { cancel(); return }
      start = { x: event.clientX, y: event.clientY, id: event.pointerId }
    }
    const move = (event: PointerEvent) => {
      if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 5) cancel()
    }
    const up = (event: PointerEvent) => {
      const click = start
      cancel()
      if (!click || click.id !== event.pointerId || Math.hypot(event.clientX - click.x, event.clientY - click.y) > 5) return
      const rect = canvas.getBoundingClientRect()
      raycaster.setFromCamera(new Vector2((event.clientX - rect.left) / rect.width * 2 - 1, 1 - (event.clientY - rect.top) / rect.height * 2), camera)
      const state = useStudioStore.getState()
      for (const hit of raycaster.intersectObjects(scene.children, true)) {
        if (!(hit.object instanceof Mesh)) continue
        const ref = transparencyRef(hit.object)
        if (!ref || state.transparentRefs.includes(ref)) continue
        state.makeTransparent(ref)
        break
      }
    }
    canvas.addEventListener('pointerdown', down, true)
    canvas.addEventListener('pointermove', move, true)
    canvas.addEventListener('pointerup', up, true)
    canvas.addEventListener('pointercancel', cancel, true)
    canvas.addEventListener('pointerleave', cancel)
    return () => {
      canvas.style.cursor = previousCursor
      canvas.removeEventListener('pointerdown', down, true)
      canvas.removeEventListener('pointermove', move, true)
      canvas.removeEventListener('pointerup', up, true)
      canvas.removeEventListener('pointercancel', cancel, true)
      canvas.removeEventListener('pointerleave', cancel)
    }
  }, [active, camera, gl, scene])
  return null
}
