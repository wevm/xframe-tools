/**
 * Void configuration of the hosted devtools, deployed to xframe.tools. X's timeline page opens popups with the
 * opener kept.
 * @module
 */
import { defineConfig } from 'void/config'
import { base } from './src/internal/Base.ts'

const coop = ['Cross-Origin-Opener-Policy: same-origin-allow-popups']

export default defineConfig({
  cloudflare: {
    name: 'xframe-tools',
    routes: [{ custom_domain: true, pattern: 'xframe.tools' }],
  },
  routing: base
    ? {
        headers: { [base]: coop, [`${base}/`]: coop },
        redirects: { '/': `${base}/` },
      }
    : { headers: { '/': coop } },
  worker: { compatibility_date: '2026-10-01' },
})
