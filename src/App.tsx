import { Canvas } from '@react-three/fiber'
import { Suspense, useEffect, useRef } from 'react'
import { ACESFilmicToneMapping, PCFSoftShadowMap, SRGBColorSpace } from 'three'
import { StudioScene } from './scene/StudioScene'
import { importProjectFile } from './services/export'
import { loadProject, saveProject } from './services/persistence'
import { registerWebMcpTools } from './services/webmcp'
import { useStudioStore } from './state/store'
import { StudioHud } from './ui/CanvasUi'

export function App() {
  const project = useStudioStore((state) => state.project)
  const toast = useStudioStore((state) => state.toast)
  const hydrated = useStudioStore((state) => state.hydrated)
  const replaceProject = useStudioStore((state) => state.replaceProject)
  const setHydrated = useStudioStore((state) => state.setHydrated)
  const setToast = useStudioStore((state) => state.setToast)
  const setViewMode = useStudioStore((state) => state.setViewMode)
  const setTransformMode = useStudioStore((state) => state.setTransformMode)
  const setMonth = useStudioStore((state) => state.setMonth)
  const selectedRef = useStudioStore((state) => state.selectedRef)
  const setSelectedRef = useStudioStore((state) => state.setSelectedRef)
  const setExplodeFloors = useStudioStore((state) => state.setExplodeFloors)
  const setHelpOpen = useStudioStore((state) => state.setHelpOpen)
  const undo = useStudioStore((state) => state.undo)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let active = true
    loadProject().then((saved) => {
      if (active && saved) replaceProject(saved)
    }).catch(() => setToast('Local autosave could not be restored.')).finally(() => { if (active) setHydrated(true) })
    return () => { active = false }
  }, [replaceProject, setHydrated, setToast])

  useEffect(() => {
    if (!hydrated) return
    const timer = window.setTimeout(() => saveProject(project).catch(() => setToast('Autosave failed. Export JSON to keep this revision.')), 350)
    return () => window.clearTimeout(timer)
  }, [project, hydrated, setToast])

  useEffect(() => registerWebMcpTools(), [])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 4200)
    return () => window.clearTimeout(timer)
  }, [setToast, toast])

  useEffect(() => {
    const openImport = () => inputRef.current?.click()
    const keyboard = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        try { undo() } catch (error) { setToast(error instanceof Error ? error.message : 'Undo failed.') }
      }
      if (event.key === '1') setViewMode('technical')
      if (event.key === '2') setViewMode('realistic')
      if (event.key.toLowerCase() === 't') setTransformMode('translate')
      if (event.key.toLowerCase() === 's') setTransformMode('scale')
      if (event.key.toLowerCase() === 'r') setTransformMode('rotate')
      if (event.key.toLowerCase() === 'f' && !event.repeat) setExplodeFloors(!useStudioStore.getState().explodeFloors)
      if (event.key === '[') setMonth(useStudioStore.getState().month - 1)
      if (event.key === ']') setMonth(useStudioStore.getState().month + 1)
      if (event.key === '?' && !event.repeat) setHelpOpen(!useStudioStore.getState().helpOpen)
      if (event.key === 'Escape') {
        setHelpOpen(false)
        setSelectedRef(null)
      }
    }
    window.addEventListener('house-web-mcp:import', openImport)
    window.addEventListener('keydown', keyboard)
    return () => {
      window.removeEventListener('house-web-mcp:import', openImport)
      window.removeEventListener('keydown', keyboard)
    }
  }, [setExplodeFloors, setHelpOpen, setMonth, setSelectedRef, setTransformMode, setViewMode, setToast, undo])

  const handleImport = async (file?: File) => {
    if (!file) return
    try { replaceProject(await importProjectFile(file)) }
    catch (error) { setToast(error instanceof Error ? `Import rejected: ${error.message}` : 'Import rejected.') }
    finally { if (inputRef.current) inputRef.current.value = '' }
  }

  return <main aria-label="House_Web_MCP 3D planning workspace">
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [29, 23, 32], fov: 38, near: 0.1, far: 250 }}
      gl={{ antialias: true, alpha: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' }}
      onCreated={({ gl }) => {
        gl.outputColorSpace = SRGBColorSpace
        gl.toneMapping = ACESFilmicToneMapping
        gl.toneMappingExposure = 1.08
        gl.shadowMap.type = PCFSoftShadowMap
        gl.domElement.setAttribute('role', 'application')
        gl.domElement.setAttribute('tabindex', '0')
        gl.domElement.setAttribute('aria-keyshortcuts', '1 2 T S R F [ ] Control+Z Escape ?')
        gl.domElement.setAttribute('aria-label', 'Interactive 3D home and garden editor. Drag to orbit, right-drag to pan, scroll to zoom, and press question mark for keyboard shortcuts.')
      }}
    >
      <Suspense fallback={null}>
        <StudioScene />
        <StudioHud />
      </Suspense>
    </Canvas>
    <input ref={inputRef} className="sr-only" type="file" accept="application/json,.json" onChange={(event) => handleImport(event.target.files?.[0])} aria-label="Import versioned project JSON" />
    <div className="sr-only" aria-live="polite">{toast}</div>
    <div className="sr-only" aria-live="polite">{selectedRef ? `Selected ${selectedRef}` : 'Selection cleared'}</div>
  </main>
}
