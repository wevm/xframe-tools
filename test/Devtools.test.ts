/**
 * Serves the devtools and a probe player, and checks in Chromium that the player runs under X's restrictions.
 * @module
 */
import * as ChildProcess from 'node:child_process'
import * as Net from 'node:net'
import { chromium, type Browser } from 'playwright'
import { afterAll, beforeAll, describe, expect, test } from 'vite-plus/test'
import * as Player from './fixtures/Player.ts'

let browser: Browser
let devtools: string
let player: Player.serve.ReturnType
let server: ChildProcess.ChildProcess

beforeAll(async () => {
  player = await Player.serve()
  const port = await free()
  // The dev server runs as it does for a developer, outside the test runner's environment.
  const { VITEST: _, ...env } = process.env
  server = ChildProcess.spawn(
    'pnpm',
    ['exec', 'vp', 'dev', '--port', String(port), '--strictPort'],
    { env, stdio: 'ignore' },
  )
  // The probe listens on 127.0.0.1, so the devtools on localhost are a separate site, as x.com is.
  devtools = `http://localhost:${port}/__xframe`
  await ready(`${devtools}/`)
  browser = await chromium.launch(
    process.env.PLAYWRIGHT_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH }
      : {},
  )
}, 90_000)

afterAll(async () => {
  await browser?.close()
  server?.kill()
  await player?.close()
})

describe('GET /api/card', () => {
  test('reads a local player card with its responses', async () => {
    const response = await fetch(
      `${devtools}/api/card?${new URLSearchParams({ url: `${player.origin}/` })}`,
    )
    const result = await response.json()

    expect(result.card).toMatchInlineSnapshot(
      {
        player: expect.stringMatching(/^http:\/\/127\.0\.0\.1:\d+\/player$/),
        url: expect.stringMatching(/^http:\/\/127\.0\.0\.1:\d+\/$/),
      },
      `
      {
        "card": "player",
        "description": "Reports what X's player sandbox allows.",
        "domain": "127.0.0.1",
        "player": StringMatching /\\^http:\\\\/\\\\/127\\\\\\.0\\\\\\.0\\\\\\.1:\\\\d\\+\\\\/player\\$/,
        "playerHeight": 360,
        "playerWidth": 480,
        "title": "Sandbox probe",
        "url": StringMatching /\\^http:\\\\/\\\\/127\\\\\\.0\\\\\\.0\\\\\\.1:\\\\d\\+\\\\/\\$/,
      }
    `,
    )
    expect(result.page).toMatchObject({ redirected: false, status: 200 })
    expect(result.player).toMatchObject({ status: 200 })
    expect(result.userAgent).toMatchInlineSnapshot(`"Twitterbot/1.0"`)
  })
})

describe('GET /i/cards-frame', () => {
  test('frames the player with X sandbox and query', async () => {
    const response = await fetch(
      `${devtools}/i/cards-frame?${new URLSearchParams({ player: `${player.origin}/player` })}`,
    )
    const markup = await response.text()

    expect(/sandbox="([^"]+)"/.exec(markup)?.[1]).toMatchInlineSnapshot(
      `"allow-popups allow-same-origin allow-scripts allow-presentation"`,
    )
    expect(/data-src="([^"]+)"/.exec(markup)?.[1]).toBe(
      `${player.origin}/player?autoplay=1&amp;auto_play=true`,
    )
    expect(response.headers.get('x-xframe-deviations')).toMatchInlineSnapshot(
      `"frame-src allows loopback origins, upgrade-insecure-requests is removed"`,
    )
  })

  test('rejects a missing player URL', async () => {
    const response = await fetch(`${devtools}/i/cards-frame`)

    expect(response.status).toBe(400)
  })
})

describe('preview', () => {
  test('runs the player under X sandbox', async () => {
    const page = await browser.newPage()
    await page.goto(
      `${devtools}/?${new URLSearchParams({ url: `${player.origin}/` })}`,
    )

    const frame = await (async () => {
      await expect
        .poll(
          () =>
            page
              .frames()
              .some((entry) => entry.url().endsWith('auto_play=true')),
          { timeout: 15_000 },
        )
        .toBe(true)
      const found = page
        .frames()
        .find((entry) => entry.url().endsWith('auto_play=true'))
      if (!found) throw new Error('Player frame did not load.')
      return found
    })()
    await frame.waitForSelector('li[data-probe="alert"]')
    const results = await frame.$$eval('li[data-probe]', (items) =>
      Object.fromEntries(
        items.map((item) => [item.dataset.probe, item.dataset.result]),
      ),
    )

    expect(results).toMatchInlineSnapshot(`
      {
        "alert": "blocked",
        "document.cookie": "allowed",
        "framed": "allowed",
        "localStorage": "allowed",
        "origin": "allowed",
        "parent.document": "blocked",
      }
    `)
    await page.close()
  })

  test('reports a player that refuses framing', async () => {
    const page = await browser.newPage()
    await page.goto(
      `${devtools}/?${new URLSearchParams({ url: `${player.origin}/blocked` })}`,
    )

    await expect
      .poll(() =>
        page.getByText('Player headers block framing by x.com').isVisible(),
      )
      .toBe(true)
    await page.close()
  })

  test('blocks form submission in a popup the player opens', async () => {
    const page = await browser.newPage()
    await page.goto(
      `${devtools}/?${new URLSearchParams({ url: `${player.origin}/` })}`,
    )
    await expect
      .poll(
        () =>
          page.frames().some((entry) => entry.url().endsWith('auto_play=true')),
        { timeout: 15_000 },
      )
      .toBe(true)
    const frame = page
      .frames()
      .find((entry) => entry.url().endsWith('auto_play=true'))
    if (!frame) throw new Error('Player frame did not load.')

    const [popup] = await Promise.all([
      page.waitForEvent('popup'),
      frame.click('#popup'),
    ])
    const messages: string[] = []
    popup.on('console', (message) => messages.push(message.text()))
    await popup.waitForSelector('#form button')
    await popup.click('#form button')

    await expect
      .poll(() =>
        messages.some((text) =>
          text.includes("'allow-forms' permission is not set"),
        ),
      )
      .toBe(true)
    expect(await popup.title()).not.toBe('submitted')
    await page.close()
  })
})

function free() {
  return new Promise<number>((resolve, reject) => {
    const probe = Net.createServer()
    probe.once('error', reject)
    probe.listen(0, 'localhost', () => {
      const address = probe.address()
      probe.close(() =>
        address && typeof address !== 'string'
          ? resolve(address.port)
          : reject(new Error('No free port.')),
      )
    })
  })
}

/** Resolves once the URL responds, within a minute. */
async function ready(url: string) {
  const deadline = Date.now() + 60_000
  while (Date.now() < deadline) {
    const ok = await fetch(url)
      .then((response) => response.ok)
      .catch(() => false)
    if (ok) return
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error(`${url} did not respond within a minute.`)
}
