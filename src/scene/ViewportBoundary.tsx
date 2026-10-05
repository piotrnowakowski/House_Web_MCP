import { Component, useEffect, useState, type ReactNode } from 'react'
import { useThree } from '@react-three/fiber'
import { useRenderingPreferences } from './renderingPreferences'

export class ViewportBoundary extends Component<{ children: ReactNode }, { failed: boolean; attempt: number }> {
  state = { failed: false, attempt: 0 }
  static getDerivedStateFromError() { return { failed: true } }
  // R3F configures the renderer asynchronously, outside its React error boundary.
  private onRendererFailure = (event: PromiseRejectionEvent) => {
    if (!(event.reason instanceof Error) || !/^Error creating WebGL context/.test(event.reason.message)) return
    event.preventDefault()
    this.setState({ failed: true })
  }
  componentDidMount() { window.addEventListener('unhandledrejection', this.onRendererFailure) }
  componentWillUnmount() { window.removeEventListener('unhandledrejection', this.onRendererFailure) }
  render() {
    if (this.state.failed) return <div className="editor-loading" role="alert">
      <p>The 3D view is unavailable. Your project and tools are still available.</p>
      <button onClick={() => { useRenderingPreferences.getState().setQuality('fast'); this.setState(state => ({ failed: false, attempt: state.attempt + 1 })) }}>Retry 3D in fast mode</button>
    </div>
    return <div key={this.state.attempt} style={{ width: '100%', height: '100%' }}>{this.props.children}</div>
  }
}

/** Detect software rendering once; context loss is contained inside the viewport. */
export function RendererLifecycle() {
  const gl = useThree(state => state.gl)
  const [lost, setLost] = useState(false)
  useEffect(() => {
    const context = gl.getContext()
    const extension = context.getExtension('WEBGL_debug_renderer_info')
    const renderer = extension ? String(context.getParameter(extension.UNMASKED_RENDERER_WEBGL)) : ''
    useRenderingPreferences.getState().setSoftware(/swiftshader|llvmpipe|software|softpipe/i.test(renderer))
    const onLost = (event: Event) => { event.preventDefault(); setLost(true) }
    gl.domElement.addEventListener('webglcontextlost', onLost)
    return () => {
      gl.domElement.removeEventListener('webglcontextlost', onLost)
      // A replacement canvas must initialize conservatively too.
      useRenderingPreferences.getState().setSoftware(null)
    }
  }, [gl])
  if (lost) throw new Error('The graphics context was lost.')
  return null
}
