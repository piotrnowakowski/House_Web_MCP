import { useEffect, useRef, useState } from 'react'
import { useThree } from '@react-three/fiber'
import { Plane, Raycaster, Vector2, Vector3, type Object3D } from 'three'
import type { OrbitControls } from 'three-stdlib'
import { applyCommands } from '../domain/commands'
import { isEnvelopeWall } from '../domain/interiorLayout'
import type { BuildingModel, ProjectCommand, ProjectV2, StoreyModel } from '../domain/types'
import type { SnapSettings } from '../domain/interiorPlacement'
import { dragCommands, type DragTarget } from './directManipulation'

interface Options {
  project: ProjectV2; building: BuildingModel; storey: StoreyModel; enabled: boolean
  snap: SnapSettings; selectedRefs: string[]; selectOnly?: boolean
  onSelect: (ref: string, additive?: boolean) => void
  onCommit: (commands: ProjectCommand[]) => boolean
  onNotice: (message: string, error?: boolean) => void
}

/** Capture before OrbitControls so object gestures never also move the camera. */
export function useDirectManipulation(options: Options) {
  const { camera, gl, scene, get } = useThree()
  const latest = useRef(options); latest.current = options
  const [preview, setPreview] = useState<BuildingModel | null>(null)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (!options.enabled) return
    const element = gl.domElement, raycaster = new Raycaster(), plane = new Plane(new Vector3(0, 1, 0), 0)
    raycaster.params.Line.threshold = .06
    let active: { pointer: number; origin: Vector3; screen: Vector2; source: Options; target: DragTarget; refs: string[]; commands: ProjectCommand[] | null; moved: boolean; error: string | null } | null = null
    const pointers = new Set<number>()
    let suppressClick = false
    const stop = (e: Event) => { e.preventDefault(); e.stopImmediatePropagation() }
    const cast = (e: PointerEvent) => {
      const b = element.getBoundingClientRect()
      raycaster.setFromCamera(new Vector2((e.clientX - b.left) / b.width * 2 - 1, 1 - (e.clientY - b.top) / b.height * 2), camera)
    }
    const end = () => {
      const old = active; active = null; setPreview(null); setDragging(false); setError(null)
      const controls = get().controls as OrbitControls | null
      if (controls) controls.enabled = latest.current.enabled
      if (old && element.hasPointerCapture(old.pointer)) element.releasePointerCapture(old.pointer)
      element.style.cursor = ''
      return old
    }
    const down = (e: PointerEvent) => {
      suppressClick = false
      pointers.add(e.pointerId)
      if (pointers.size > 1) { if (active) { end(); stop(e) } return }
      if (e.button !== 0) return
      cast(e)
      let target: DragTarget | undefined
      for (const hit of raycaster.intersectObjects(scene.children, true)) {
        let object: Object3D | null = hit.object
        while (object && !object.userData.dragTarget) object = object.parent
        if (object) { target = object.userData.dragTarget; break }
      }
      if (!target) return
      stop(e); suppressClick = true
      const current = latest.current
      const controls = get().controls as OrbitControls | null
      if (controls) controls.enabled = false
      const refs = current.selectedRefs.includes(target.ref) ? [...current.selectedRefs] : [target.ref]
      current.onSelect(target.ref, e.shiftKey)
      const wall = current.building.walls.find(w => w.ref === target!.ref)
      const item = current.building.furniture?.find(i => i.ref === target!.ref)
      const blocked = wall?.locked || item?.locked || (wall && isEnvelopeWall(current.building, current.storey, wall))
      if (blocked || e.shiftKey || current.selectOnly) {
        if (blocked) current.onNotice(wall && !wall.locked ? 'Exterior outline is fixed. Drag an interior partition.' : 'Unlock this object before moving it.', true)
        if (controls) controls.enabled = true
        return
      }
      const origin = raycaster.ray.intersectPlane(plane, new Vector3())
      if (!origin) { if (controls) controls.enabled = true; return }
      active = { pointer: e.pointerId, origin, screen: new Vector2(e.clientX, e.clientY), source: current, target, refs, commands: null, moved: false, error: null }
      element.setPointerCapture(e.pointerId); element.style.cursor = 'grabbing'; setDragging(true)
    }
    const move = (e: PointerEvent) => {
      if (!active || e.pointerId !== active.pointer) return
      stop(e)
      if (latest.current.project !== active.source.project) { end(); return }
      if (!active.moved && active.screen.distanceTo(new Vector2(e.clientX, e.clientY)) < 4) return
      active.moved = true; cast(e)
      const point = raycaster.ray.intersectPlane(plane, new Vector3()); if (!point) return
      const current = active
      try {
        const commands = dragCommands(current.source.building, current.source.storey, current.target, { x: point.x - current.origin.x, z: point.z - current.origin.z }, { ...current.source.snap, enabled: current.source.snap.enabled && !e.altKey }, current.refs)
        const proposed = applyCommands(current.source.project, commands)
        current.commands = commands; current.error = null
        setError(null)
        setPreview(proposed.buildings.find(b => b.ref === current.source.building.ref)!)
        element.style.cursor = 'grabbing'
      } catch (error) {
        current.commands = null; current.error = error instanceof Error ? error.message : 'This position is not valid.'
        setError(current.error)
        setPreview(null); element.style.cursor = 'not-allowed'
      }
    }
    const up = (e: PointerEvent) => {
      pointers.delete(e.pointerId)
      if (!active || e.pointerId !== active.pointer) return
      move(e)
      const current = end()
      if (!current) return
      if (current.moved && current.commands?.length) latest.current.onCommit(current.commands)
      else if (current.error) latest.current.onNotice(current.error, true)
    }
    const cancel = (e?: PointerEvent) => { if (e) pointers.delete(e.pointerId); if (!e || e.pointerId === active?.pointer) end() }
    const escape = (e: KeyboardEvent) => { if (e.key === 'Escape' && active) { stop(e); end() } }
    const blur = () => { pointers.clear(); end() }
    const visibility = () => { if (document.hidden) blur() }
    const click = (e: MouseEvent) => { if (suppressClick) { stop(e); suppressClick = false } }
    element.addEventListener('pointerdown', down, true); element.addEventListener('pointermove', move, true)
    element.addEventListener('pointerup', up, true); element.addEventListener('pointercancel', cancel, true)
    element.addEventListener('lostpointercapture', cancel, true); element.addEventListener('click', click, true)
    window.addEventListener('blur', blur); window.addEventListener('keydown', escape, true); document.addEventListener('visibilitychange', visibility)
    return () => {
      end()
      element.removeEventListener('pointerdown', down, true); element.removeEventListener('pointermove', move, true)
      element.removeEventListener('pointerup', up, true); element.removeEventListener('pointercancel', cancel, true)
      element.removeEventListener('lostpointercapture', cancel, true); element.removeEventListener('click', click, true)
      window.removeEventListener('blur', blur); window.removeEventListener('keydown', escape, true); document.removeEventListener('visibilitychange', visibility)
    }
  }, [camera, gl, scene, get, options.enabled, options.project.ref, options.building.ref, options.storey.ref])
  return { preview, dragging, error }
}
