/**
 * Serves a sandbox probe as a local player, on a loopback host other than the devtools'.
 * @module
 */
import * as Fs from 'node:fs/promises'
import * as Http from 'node:http'
import * as Path from 'node:path'

/** Starts the probe server and resolves with its origin and a close function. */
export async function serve(
  options: serve.Options = {},
): Promise<serve.ReturnType> {
  const markup = await Fs.readFile(
    Path.resolve(import.meta.dirname, 'player.html'),
    'utf8',
  )

  const popup = `<!doctype html><form id="form"><button>Submit</button></form>
<script>document.getElementById('form').addEventListener('submit', () => { document.title = 'submitted' })</script>`

  // A card whose player refuses to be framed, as a player with `X-Frame-Options: DENY` does.
  const denied = markup.replace('content="/player"', 'content="/denied"')

  const server = Http.createServer((request, response) => {
    const path = new URL(request.url ?? '/', 'http://localhost').pathname
    response.setHeader('content-type', 'text/html; charset=utf-8')
    // The devtools read card tags from the browser when the server cannot reach this host.
    response.setHeader('access-control-allow-origin', '*')
    if (path === '/denied') response.setHeader('x-frame-options', 'DENY')
    response.end(
      (() => {
        if (path === '/popup') return popup
        if (path === '/blocked') return denied
        return markup
      })(),
    )
  })

  const host = options.host ?? '127.0.0.1'
  await new Promise<void>((resolve) =>
    server.listen(options.port ?? 0, host, resolve),
  )
  const address = server.address()
  if (!address || typeof address === 'string')
    throw new Error('Probe server has no port.')

  return {
    close: () => new Promise((resolve) => server.close(() => resolve())),
    origin: `http://${host}:${address.port}`,
  }
}

export declare namespace serve {
  type Options = {
    /** Loopback host to listen on. Defaults to `127.0.0.1`. */
    host?: string | undefined
    /** Port to listen on. Defaults to a free port. */
    port?: number | undefined
  }

  type ReturnType = {
    /** Stops the server. */
    close: () => Promise<void>
    /** Origin of the probe, such as `http://127.0.0.1:5173`. */
    origin: string
  }
}

if (import.meta.main) {
  const player = await serve({ port: Number(process.env.PORT ?? 5173) })
  console.log(`Probe player at ${player.origin}`)
}
