/**
 * A host app that serves the devtools through the package's Vite plugin, from the build in `dist`.
 * @module
 */
import { defineConfig } from 'vite'
import { xframe } from 'xframe-tools/vite'

export default defineConfig({
  plugins: [xframe()],
})
