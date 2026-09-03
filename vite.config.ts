import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createWebMcpManifest } from './src/services/webmcpDefinitions'

const webMcpManifestPlugin = () => ({
  name: 'webmcp-manifest',
  configResolved: () => {
    const manifestPath = resolve(process.cwd(), 'public', 'webmcp-tools.json')
    writeFileSync(manifestPath, `${JSON.stringify(createWebMcpManifest(), null, 2)}\n`, 'utf8')
  },
})

export default defineConfig({
  plugins: [react(), webMcpManifestPlugin()],
  base: process.env.BASE_PATH ?? '/',
  server: { host: '127.0.0.1' },
  preview: { host: '127.0.0.1' },
  build: { sourcemap: true },
  // Pre-bundle the heavy runtime libraries so a cold dev start does not re-optimise and reload the page mid-session.
  optimizeDeps: { include: ['three', '@react-three/fiber', '@react-three/drei', '@react-three/rapier', '@thatopen/components', 'camera-controls', 'three-mesh-bvh', 'zustand', 'zod', 'manifold-3d/lib/wasm'] },
})
