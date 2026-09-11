import { Canvas, events } from '@react-three/fiber'
import { memo, Suspense } from 'react'
import { ACESFilmicToneMapping, PCFSoftShadowMap, SRGBColorSpace } from 'three'
import { StudioScene } from './StudioScene'
import { useStudioStore } from '../state/store'
import { useRenderQuality } from './renderingPreferences'
import { RendererLifecycle, ViewportBoundary } from './ViewportBoundary'

export default memo(function PlotCanvas() {
  const quality = useRenderQuality()
  return <ViewportBoundary><Canvas
    events={state => ({ ...events(state), filter: hits => useStudioStore.getState().transparencyMode ? [] : hits })}
    frameloop="demand"
    shadows={quality !== 'fast'}
    dpr={quality === 'detailed' ? [1, 2] : 1}
    camera={{ position: [29, 23, 32], fov: 38, near: 0.1, far: 1200 }}
    gl={{ antialias: false, alpha: false, preserveDrawingBuffer: false, powerPreference: 'high-performance' }}
    onCreated={({ gl }) => {
      gl.outputColorSpace = SRGBColorSpace
      gl.toneMapping = ACESFilmicToneMapping
      gl.toneMappingExposure = 1.08
      gl.shadowMap.type = PCFSoftShadowMap
      gl.domElement.setAttribute('role', 'application')
      gl.domElement.setAttribute('aria-label', 'Interactive ProjectV2 spatial editor')
      gl.domElement.tabIndex = 0
    }}
  ><RendererLifecycle /><Suspense fallback={null}><StudioScene /></Suspense></Canvas></ViewportBoundary>
})
