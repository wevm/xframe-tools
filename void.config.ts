/**
 * Void configuration of the hosted devtools, deployed to xframe.tools. Void cannot apply routing rules to a TanStack
 * Start deploy, so only `/__xframe` builds redirect the root, and the app sets its own headers.
 * @module
 */
import { defineConfig } from 'void/config'
import { base } from './src/internal/Base.ts'

export default defineConfig({
  cloudflare: {
    name: 'xframe-tools',
    routes: [{ custom_domain: true, pattern: 'xframe.tools' }],
  },
  ...(base && { routing: { redirects: { '/': `${base}/` } } }),
  worker: { compatibility_date: '2026-10-01' },
})
