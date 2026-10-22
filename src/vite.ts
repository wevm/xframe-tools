/**
 * The Vite entry: `xframe()` serves the devtools under `/__xframe` beside the app, on the dev and
 * preview servers.
 *
 * ```ts
 * import { defineConfig } from 'vite'
 * import { xframe } from 'xframe-tools/vite'
 *
 * export default defineConfig({
 *   plugins: [xframe()],
 * })
 * ```
 * @module
 */
import type * as Http from 'node:http'
import type { Plugin, PreviewServer, ViteDevServer } from 'vite'
import * as Devtools from './Devtools.ts'

/**
 * Returns the Vite plugin that serves the devtools under `/__xframe`. Requests to other paths reach
 * the app as before.
 */
export function xframe(): Plugin {
  const devtools = Devtools.create()

  // The middleware runs before Vite's own, so the app's `base` and its SPA fallback never rewrite
  // the devtools' paths.
  const mount = (server: PreviewServer | ViteDevServer) => {
    const protocol = server.config.server.https ? 'https' : 'http'

    server.middlewares.use((incoming, outgoing, next) => {
      const url = new URL(
        incoming.url ?? '/',
        `${protocol}://${incoming.headers.host ?? 'localhost'}`,
      )
      if (!Devtools.matches(new Request(url))) return next()

      devtools
        .fetch(toRequest(incoming, url))
        .then((response) => send(outgoing, response))
        .catch(next)
    })
  }

  return {
    configurePreviewServer: mount,
    configureServer: mount,
    name: 'xframe-tools',
  }
}

/** Returns a Node request to `url` as a fetch `Request`. */
function toRequest(incoming: Http.IncomingMessage, url: URL) {
  const headers = new Headers()
  for (const [name, value] of Object.entries(incoming.headers)) {
    // `Headers` rejects HTTP/2 pseudo-headers, such as `:path`.
    if (value === undefined || name.startsWith(':')) continue
    for (const entry of Array.isArray(value) ? value : [value])
      headers.append(name, entry)
  }

  // Every route of the devtools reads only its query, so the body stays unread.
  return new Request(url, { headers, method: incoming.method ?? 'GET' })
}

/** Writes a fetch `Response` to a Node response. */
async function send(outgoing: Http.ServerResponse, response: Response) {
  outgoing.statusCode = response.status
  for (const [name, value] of response.headers)
    if (name !== 'set-cookie') outgoing.setHeader(name, value)
  const cookies = response.headers.getSetCookie()
  if (cookies.length > 0) outgoing.setHeader('set-cookie', cookies)

  if (!response.body) return void outgoing.end()
  for await (const chunk of response.body) outgoing.write(chunk)
  outgoing.end()
}
