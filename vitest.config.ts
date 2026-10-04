import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const pkg = (name: string) =>
  fileURLToPath(new URL(`./packages/${name}/src/index.ts`, import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      '@sm/core': pkg('sm-core'),
      '@sm/emulator': pkg('sm-emulator'),
    },
  },
  test: {
    globals: true,
    include: ['packages/**/*.test.ts', 'tools/**/*.test.ts'],
  },
})
