import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const pkg = (name: string) =>
  fileURLToPath(new URL(`./packages/${name}/src/index.ts`, import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      '@sm/core': pkg('sm-core'),
      '@sm/emulator': pkg('sm-emulator'),
      '@sm/tst': pkg('sm-tst'),
      '@sm/to-asm': pkg('sm-to-asm'),
      '@sm/jack': pkg('jack-to-sm'),
      '@sm/vm': pkg('sm-vm'),
    },
  },
  test: {
    globals: true,
    include: ['packages/**/*.test.ts', 'tools/**/*.test.ts', 'web/**/*.test.ts'],
    testTimeout: 60_000,
    hookTimeout: 180_000,
  },
})
