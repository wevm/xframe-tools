/**
 * The Worker entry: `Devtools.create` serves the devtools under `/__xframe` in a Cloudflare Worker.
 *
 * ```ts
 * import { Devtools } from 'xframe-tools/worker'
 *
 * const devtools = Devtools.create()
 *
 * export default {
 *   fetch(request, env, ctx) {
 *     if (Devtools.matches(request)) return devtools.fetch(request, env, ctx)
 *     return app.fetch(request, env, ctx)
 *   },
 * }
 * ```
 * @module
 */
export * as Devtools from './Devtools.ts'
