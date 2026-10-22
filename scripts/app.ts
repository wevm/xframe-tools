/**
 * Builds the devtools app with Void and TanStack Start into `dist/app`, which the package's `#app`
 * and `#assets` imports read. Run it with `pnpm build:app`, before zile.
 * Void detects TanStack Start from `package.json`, whose dependencies `zile publish:prepare` removes.
 * @module
 */
import * as ChildProcess from 'node:child_process'
import * as Fs from 'node:fs'
import * as Path from 'node:path'
import { base } from '../src/internal/Base.ts'

const root = Path.resolve(import.meta.dirname, '..')
const dist = Path.resolve(root, 'dist')
const target = Path.resolve(dist, 'app')

/** Media types of the client assets. A text type is stored as UTF-8, and any other as base64. */
const types = {
  '.css': { text: true, type: 'text/css; charset=utf-8' },
  '.js': { text: true, type: 'text/javascript; charset=utf-8' },
  '.json': { text: true, type: 'application/json' },
  '.png': { text: false, type: 'image/png' },
  '.svg': { text: true, type: 'image/svg+xml' },
  '.woff2': { text: false, type: 'font/woff2' },
} as const

// `Devtools` matches requests under the default base, which the package's build always serves.
if (process.env.XFRAME_BASE)
  throw new Error(
    'XFRAME_BASE is set. Unset it to build the package, which serves the devtools under `/__xframe`.',
  )

// Vitest sets `NODE_ENV=test`, which would build with `import.meta.env.DEV` set, so the build runs
// without it, as in production.
const { NODE_ENV: _mode, VITEST: _, ...env } = process.env
ChildProcess.execFileSync('vp', ['build'], {
  cwd: root,
  env,
  stdio: ['ignore', 'ignore', 'inherit'],
})

Fs.rmSync(target, { force: true, recursive: true })
Fs.cpSync(Path.resolve(dist, 'server'), Path.resolve(target, 'server'), {
  // Source maps, Vite's manifest, and the Wrangler config hold build paths, and no import reads them.
  filter: (source) =>
    !source.endsWith('.map') &&
    !source.endsWith('wrangler.json') &&
    !source.includes(`${Path.sep}.vite`),
  recursive: true,
})

// The app imports `cloudflare:workers` only for its side effects, which Node cannot resolve. The
// Vite plugin runs the app in Node, so the import is removed, and the build fails if it changes.
const server = Path.resolve(target, 'server/index.js')
const source = Fs.readFileSync(server, 'utf8')
const parts = source.split('import"cloudflare:workers";')
if (parts.length > 2 || /["']cloudflare:workers["']/.test(parts.join('')))
  throw new Error(
    `${server} imports \`cloudflare:workers\` in a new form. Update scripts/app.ts to remove it.`,
  )
Fs.writeFileSync(server, parts.join(''))

// The Worker of a host app serves its own assets, so the package embeds the devtools' assets and
// serves them under `base`.
const client = Path.resolve(dist, 'client')
const assets: Record<string, unknown> = {}
for (const file of Fs.readdirSync(client, { recursive: true }).map(String)) {
  const path = Path.resolve(client, file)
  if (Fs.statSync(path).isDirectory()) continue
  // `.assetsignore` and `wrangler.json` configure Wrangler, and are not served.
  if (Path.basename(file).startsWith('.') || file === 'wrangler.json') continue

  const extension = Path.extname(file)
  const entry = types[extension as keyof typeof types]
  if (!entry)
    throw new Error(
      `${path} has no media type. Add \`${extension}\` to \`types\` in scripts/app.ts.`,
    )

  const content = Fs.readFileSync(path)
  assets[`${base}/${file.split(Path.sep).join('/')}`] = {
    body: content.toString(entry.text ? 'utf8' : 'base64'),
    encoding: entry.text ? 'utf8' : 'base64',
    type: entry.type,
  }
}
Fs.writeFileSync(
  Path.resolve(target, 'assets.js'),
  `export default ${JSON.stringify(assets)}\n`,
)

for (const folder of ['client', 'server'])
  Fs.rmSync(Path.resolve(dist, folder), { force: true, recursive: true })
