/**
 * Void configuration of the hosted devtools. X's timeline page opens popups with the opener kept.
 * @module
 */
import { defineConfig } from 'void/config'

export default defineConfig({
  routing: {
    headers: {
      '/__xframe': ['Cross-Origin-Opener-Policy: same-origin-allow-popups'],
      '/__xframe/': ['Cross-Origin-Opener-Policy: same-origin-allow-popups'],
    },
    redirects: { '/': '/__xframe/' },
  },
  worker: { compatibility_date: '2026-10-01' },
})
