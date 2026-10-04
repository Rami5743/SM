import { copyFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const pkg = (name: string) =>
  fileURLToPath(new URL(`../packages/${name}/src/index.ts`, import.meta.url))

export default defineConfig({
  base: process.env.SITE_BASE ?? '/',
  resolve: {
    alias: {
      '@sm/core': pkg('sm-core'),
      '@sm/emulator': pkg('sm-emulator'),
      '@sm/tst': pkg('sm-tst'),
      '@sm/to-asm': pkg('sm-to-asm'),
    },
  },
  build: { outDir: 'dist', emptyOutDir: true },
  plugins: [
    {
      // GitHub Pages serves 404.html for an unknown path, so a copy of the
      // page makes a deep link such as /en/reference work on a static host.
      name: 'spa-fallback',
      closeBundle() {
        copyFileSync(
          fileURLToPath(new URL('./dist/index.html', import.meta.url)),
          fileURLToPath(new URL('./dist/404.html', import.meta.url)),
        )
      },
    },
  ],
})
