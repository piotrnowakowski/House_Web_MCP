import { Canvas, events } from '@react-three/fiber'
import { memo, Suspense } from 'react'
import { ACESFilmicToneMapping, PCFSoftShadowMap, SRGBColorSpace } from 'three'
import { StudioScene } from './StudioScene'
import { useStudioStore } from '../state/store'

export default memo(function PlotCanvas() {
  return <Canvas
    events={state => ({ ...events(state), filter: hits => useStudioStore.getState().transparencyMode ? [] : hits })}
    frameloop="demand"
    shadows
    dpr={[1, 2]}
    camera={{ position: [29, 23, 32], fov: 38, near: 0.1, far: 1200 }}
    gl={{ antialias: true, alpha: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' }}
    onCreated={({ gl }) => {
      gl.outputColorSpace = SRGBColorSpace
      gl.toneMapping = ACESFilmicToneMapping
      gl.toneMappingExposure = 1.08
      gl.shadowMap.type = PCFSoftShadowMap
      gl.domElement.setAttribute('role', 'application')
      gl.domElement.setAttribute('aria-label', 'Interactive ProjectV2 spatial editor')
      gl.domElement.tabIndex = 0
    }}
  ><Suspense fallback={null}><StudioScene /></Suspense></Canvas>
})
