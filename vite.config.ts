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
})
