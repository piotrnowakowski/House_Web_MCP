import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
import type { Object3D } from 'three'
import { parseProject } from '../domain/schema'
import type { ProjectV1 } from '../domain/types'

let sceneRoot: Object3D | null = null
let renderCanvas: HTMLCanvasElement | null = null

export const setExportSceneRoot = (root: Object3D | null) => { sceneRoot = root }
export const setRenderCanvas = (canvas: HTMLCanvasElement | null) => { renderCanvas = canvas }

const download = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export const exportProjectJson = (project: ProjectV1) => {
  download(new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' }), 'House_Web_MCP-project.json')
}

export const exportSceneGlb = async () => {
  if (!sceneRoot) throw new Error('The 3D scene is not ready for export.')
  const exporter = new GLTFExporter()
  const result = await exporter.parseAsync(sceneRoot, { binary: true, onlyVisible: true })
  download(new Blob([result as ArrayBuffer], { type: 'model/gltf-binary' }), 'House_Web_MCP.glb')
}

export const exportScenePng = () => {
  if (!renderCanvas) throw new Error('The render surface is not ready for export.')
  renderCanvas.toBlob((blob) => { if (blob) download(blob, 'House_Web_MCP.png') }, 'image/png')
}

export const importProjectFile = async (file: File): Promise<ProjectV1> => parseProject(JSON.parse(await file.text()))
