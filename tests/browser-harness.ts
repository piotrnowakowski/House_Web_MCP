/** Read-only scene inspection and a deterministic project fixture for local browser regressions. */
import { _roots } from '@react-three/fiber'
import { Box3, Vector3 } from 'three'
import { sampleProject } from '../src/domain/sampleProject'
import v2 from '../project-data/zielonki-v2/before-short-hall-r55.json'
import { parseProject } from '../src/domain/schema'
import { useStudioStore } from '../src/state/store'

export function fixture() {
  const project = structuredClone(sampleProject)
  project.ref = 'project/interior-browser-test'
  project.name = 'Interior browser study'
  useStudioStore.getState().replaceProject(project)
  useStudioStore.setState({ hydrated: true, launcherOpen: false, selectedRef: null })
}
export function dragFixture() {
  const project = parseProject(v2)
  project.ref = 'project/interior-drag-test'; project.name = 'Interior drag test'
  useStudioStore.getState().replaceProject(project)
  useStudioStore.setState({ hydrated: true, launcherOpen: false, selectedRef: null })
}
export function state() {
  const value = useStudioStore.getState()
  return {
    project: value.project,
    history: value.history.length,
    future: value.future.length,
    selectedRef: value.selectedRef,
  }
}
export function camera() {
  const canvas = document.querySelector('canvas')!
  const value = _roots.get(canvas)!.store.getState()
  return {
    position: value.camera.position.toArray(),
    rotation: value.camera.quaternion.toArray(),
    zoom: value.camera.zoom,
  }
}
export function modelSize(ref: string) {
  const canvas = document.querySelector('canvas')!
  const scene = _roots.get(canvas)!.store.getState().scene
  const model = scene.getObjectByName(`interior-product/${ref}`)
  return model ? new Box3().setFromObject(model, true).getSize(new Vector3()).toArray() : null
}
export function point(x: number, z: number, y = 0) {
  const canvas = document.querySelector('canvas')!
  const value = _roots.get(canvas)!.store.getState()
  const p = new Vector3(x, y, z).project(value.camera)
  const bounds = canvas.getBoundingClientRect()
  return { x: bounds.x + ((p.x + 1) * bounds.width) / 2, y: bounds.y + ((1 - p.y) * bounds.height) / 2 }
}
