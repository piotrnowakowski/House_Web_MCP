import { create } from 'zustand'

export type RenderQuality = 'auto' | 'fast' | 'detailed'

const savedQuality = (): RenderQuality => {
  try {
    const value = localStorage.getItem('render-quality') ?? sessionStorage.getItem('render-quality')
    return value === 'fast' || value === 'detailed' ? value : 'auto'
  } catch { return 'auto' }
}

/** Display preferences stay outside the persisted architectural project. */
export const useRenderingPreferences = create<{
  quality: RenderQuality
  software: boolean | null
  setQuality: (quality: RenderQuality) => void
  setSoftware: (software: boolean | null) => void
}>((set) => ({
  quality: savedQuality(),
  software: null,
  setQuality: quality => {
    try {
      localStorage.setItem('render-quality', quality)
      sessionStorage.setItem('render-quality', quality)
    } catch { /* Storage may be unavailable in a private browser. */ }
    set({ quality })
  },
  setSoftware: software => set({ software }),
}))

export const useRenderQuality = () => useRenderingPreferences(state =>
  state.quality === 'auto' ? (state.software === false ? 'detailed' : 'fast') : state.quality)
