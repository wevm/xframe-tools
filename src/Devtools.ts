/**
 * The devtools as a fetch handler. `Devtools.create` serves the built app and its client assets under
 * `base`, in a Cloudflare Worker or in Node.
 * @module
 */
import handlers from '#app'
import assets from '#assets'

/**
 * Mount path of the package's build. `scripts/app.ts` builds the app without `XFRAME_BASE`, so it
 * is `Base.base`'s default. The package reads no `process.env`, which a Worker may not have.
 */
const base = '/__xframe'

/**
 * Creates the devtools' fetch handler. It serves every page, asset, and endpoint under `base`
 * (`/__xframe`), and holds no state between requests.
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
 */
export function create(): create.ReturnType {
  return {
    async fetch(request, _env, ctx) {
      const path = new URL(request.url).pathname

      const asset = assets[path]
      if (asset && (request.method === 'GET' || request.method === 'HEAD'))
        return new Response(request.method === 'HEAD' ? null : decode(asset), {
          headers: {
            // Asset names carry a content hash.
            'cache-control': 'public, max-age=31536000, immutable',
            'content-type': asset.type,
          },
        })

      // The app reads no bindings. The host's own, such as its `ASSETS`, never reach it, so the
      // app's asset lookups miss and its pages render on the server.
      return handlers.fetch(
        request,
        {},
        ctx ?? { passThroughOnException() {}, waitUntil() {} },
      )
    },
  }
}

export declare namespace create {
  type ReturnType = {
    /**
     * Serves a request under `base`. Check the path with `Devtools.matches` first. `env` is
     * unused, and `ctx` is the Worker's execution context, when one exists.
     */
    fetch: (request: Request, env?: unknown, ctx?: unknown) => Promise<Response>
  }
}

/** Returns whether the devtools serve `request`, which is when its path is under `base`. */
export function matches(request: Request): boolean {
  const path = new URL(request.url).pathname
  return path === base || path.startsWith(`${base}/`)
}

/** Returns an asset's content. Binary assets are stored in base64, and text assets as they are. */
function decode(asset: (typeof assets)[string]) {
  if (asset.encoding === 'utf8') return asset.body
  return Uint8Array.from(atob(asset.body), (char) => char.charCodeAt(0))
}
