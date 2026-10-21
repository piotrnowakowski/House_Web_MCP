import { defineConfig } from 'vitest/config'

// Project migration tests load full project JSON and exceed 5 s on loaded CI runners.
export default defineConfig({ test: { include: ['src/**/*.test.ts', 'server/**/*.test.ts'], testTimeout: 30_000 } })
