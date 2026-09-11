import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import { createWebMcpManifest } from './src/services/webmcpDefinitions'

const webMcpManifestPlugin = () => ({
  name: 'webmcp-manifest',
  configResolved: () => {
    const manifestPath = resolve(process.cwd(), 'public', 'webmcp-tools.json')
    writeFileSync(manifestPath, `${JSON.stringify(createWebMcpManifest(), null, 2)}\n`, 'utf8')
  },
})

const assetHash = createHash('sha256')
for (const directory of ['models', 'textures']) {
  const root = resolve('public', directory)
  for (const file of readdirSync(root, { recursive: true, withFileTypes: true }).filter(file => file.isFile()).sort((a, b) => `${a.parentPath}/${a.name}`.localeCompare(`${b.parentPath}/${b.name}`))) {
    const path = resolve(file.parentPath, file.name)
    assetHash.update(path.slice(root.length).replaceAll('\\', '/')).update(readFileSync(path))
  }
}

export default defineConfig({
  define: { __STATIC_ASSET_VERSION__: JSON.stringify(assetHash.digest('hex').slice(0, 16)) },
  plugins: [react(), webMcpManifestPlugin()],
  base: process.env.BASE_PATH ?? '/',
  server: { host: '127.0.0.1', watch: { ignored: ['**/tmp/**', '**/output/**', '**/.playwright-mcp/**'] } },
  preview: { host: '127.0.0.1' },
  build: { sourcemap: true },
  // Pre-bundle the heavy runtime libraries so a cold dev start does not re-optimise and reload the page mid-session.
  optimizeDeps: { include: ['three', '@react-three/fiber', '@react-three/drei', 'camera-controls', 'three-mesh-bvh', 'zustand', 'zod', 'manifold-3d/lib/wasm'] },
})
