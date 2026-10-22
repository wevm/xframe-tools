/**
 * Reads player card markup the way X's crawler and web client do, and reports what X would render.
 * @module
 */

/** User agent X's card crawler sends. Some sites serve different tags to it. */
export const crawlerAgent = 'Twitterbot/1.0'

/** Size X assumes when a URL is framed directly, without card markup. */
export const fallbackSize = { height: 480, width: 480 } as const

/** A player card as X reads it. */
export type Card = {
  /** `twitter:card` value. */
  card: string | undefined
  /** Card description. */
  description: string | undefined
  /** Hostname shown as "From <domain>". */
  domain: string
  /** Poster image shown before the player loads. */
  image: string | undefined
  /** Player document from `twitter:player`. */
  player: string | undefined
  /** Declared player height in pixels. */
  playerHeight: number | undefined
  /** Declared player width in pixels. */
  playerWidth: number | undefined
  /** `twitter:site` handle. */
  site: string | undefined
  /** Raw `twitter:*` and `og:*` tags in document order, first occurrence of each. */
  tags: Record<string, string>
  /** Card title. */
  title: string | undefined
  /** Page the card was read from. */
  url: string
}

/** One result of {@link check}. */
export type Check = {
  /** `fail` stops X rendering the player; `warn` renders with a caveat. */
  level: 'fail' | 'pass' | 'warn'
  /** What was checked. */
  message: string
  /** Card tags the check covers. */
  tags: readonly string[]
}

/** Reads card tags from a page's markup, resolving relative URLs against the page. */
export function parse(options: parse.Options): Card {
  const tags = new Map<string, string>()
  for (const match of options.markup.matchAll(/<meta\b[^>]*>/gi)) {
    const tag = match[0]
    const key = attribute(tag, 'name') ?? attribute(tag, 'property')
    const content = attribute(tag, 'content')
    // The first occurrence wins, as for X's crawler.
    if (key && content !== undefined && !tags.has(key.toLowerCase()))
      tags.set(key.toLowerCase(), content)
  }

  const read = (...keys: readonly string[]) => {
    for (const key of keys) {
      const value = tags.get(key)?.trim()
      if (value) return value
    }
    return undefined
  }

  const resolve = (value: string | undefined) => {
    if (!value) return undefined
    return URL.parse(value, options.url)?.href
  }

  const number = (value: string | undefined) => {
    const parsed = Number(value)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
  }

  return {
    card: read('twitter:card'),
    description: read('twitter:description', 'og:description', 'description'),
    domain: new URL(options.url).hostname,
    image: resolve(read('twitter:image', 'twitter:image:src', 'og:image')),
    player: resolve(read('twitter:player')),
    playerHeight: number(read('twitter:player:height')),
    playerWidth: number(read('twitter:player:width')),
    site: read('twitter:site'),
    tags: Object.fromEntries(
      [...tags].filter(
        (entry) =>
          entry[0].startsWith('twitter:') || entry[0].startsWith('og:'),
      ),
    ),
    title: read('twitter:title', 'og:title') ?? title(options.markup),
    url: options.url,
  }
}

export declare namespace parse {
  type Options = {
    /** Page markup. */
    markup: string
    /** Page URL, used to resolve relative tag values. */
    url: string
  }
}

/** Builds a card for a URL framed directly, for pages without card markup. */
export function direct(url: string): Card {
  return {
    card: undefined,
    description: undefined,
    domain: new URL(url).hostname,
    image: undefined,
    player: url,
    playerHeight: fallbackSize.height,
    playerWidth: fallbackSize.width,
    site: undefined,
    tags: {},
    title: undefined,
    url,
  }
}

/**
 * Reports whether X would render the card as a player.
 *
 * X's web client renders a player only with a title, a player URL, and a player
 * width and height. It frames only HTTPS players, and it never shows a player
 * taller than it is wide.
 */
export function check(
  card: Card,
  options: check.Options = {},
): readonly Check[] {
  const checks: Check[] = []
  const player = card.player ? URL.parse(card.player) : null
  const local = player !== null && isLoopback(player)
  const size = ['twitter:player:height', 'twitter:player:width']

  checks.push(
    card.card === 'player'
      ? {
          level: 'pass',
          message: 'twitter:card is "player"',
          tags: ['twitter:card'],
        }
      : {
          level: 'fail',
          message: card.card
            ? `twitter:card is "${card.card}", so X renders a link card`
            : 'twitter:card is missing, so X renders a link card',
          tags: ['twitter:card'],
        },
  )

  checks.push(
    (() => {
      const tags = ['twitter:player']
      if (!player)
        return { level: 'fail', message: 'twitter:player is missing', tags }
      if (player.protocol === 'https:')
        return { level: 'pass', message: 'twitter:player uses HTTPS', tags }
      if (local)
        return {
          level: 'warn',
          message: 'twitter:player is a local HTTP URL, which X will not frame',
          tags,
        }
      return { level: 'fail', message: 'twitter:player must use HTTPS', tags }
    })(),
  )

  checks.push(
    card.playerWidth && card.playerHeight
      ? {
          level: 'pass',
          message: `Player is ${card.playerWidth}×${card.playerHeight}`,
          tags: size,
        }
      : {
          level: 'fail',
          message:
            'twitter:player:width and twitter:player:height are required',
          tags: size,
        },
  )

  if (
    card.playerWidth &&
    card.playerHeight &&
    card.playerHeight > card.playerWidth
  )
    checks.push({
      level: 'warn',
      message: 'X shows players at most 1:1, so this player renders square',
      tags: size,
    })

  checks.push(
    card.title
      ? {
          level: 'pass',
          message: 'Card has a title',
          tags: ['twitter:title', 'og:title'],
        }
      : {
          level: 'fail',
          message: 'twitter:title or og:title is required',
          tags: ['twitter:title', 'og:title'],
        },
  )

  checks.push(
    (() => {
      const tags = ['twitter:image', 'og:image']
      if (!card.image)
        return {
          level: 'warn',
          message: 'twitter:image is missing, so X shows no poster',
          tags,
        }
      if (options.imageBytes !== undefined && options.imageBytes > imageLimit)
        return {
          level: 'warn',
          message: `Poster image is over ${imageLimit / 1024 / 1024}MB, so X may not show it`,
          tags,
        }
      return { level: 'pass', message: 'Card has a poster image', tags }
    })(),
  )

  if (options.headers) {
    const headers = options.headers
    const x = frameable({ ancestor: 'https://x.com', headers })
    checks.push(
      x
        ? {
            level: 'pass',
            message: 'Player headers allow framing by x.com',
            tags: [],
          }
        : {
            level: 'fail',
            message:
              'Player headers block framing by x.com (X-Frame-Options or frame-ancestors)',
            tags: [],
          },
    )

    if (
      x &&
      options.origin &&
      !frameable({ ancestor: options.origin, headers })
    )
      checks.push({
        level: 'warn',
        message:
          'Player headers allow x.com but block this devtools origin, so the preview stays blank here',
        tags: [],
      })
  }

  return checks
}

export declare namespace check {
  type Options = {
    /** Player response headers, by lowercase name, for framing checks. */
    headers?: Record<string, string> | undefined
    /** Poster image size in bytes. */
    imageBytes?: number | undefined
    /** Origin of the devtools page, which frames the player in place of x.com. */
    origin?: string | undefined
  }
}

/** Largest poster image X accepts for a card, in bytes. */
export const imageLimit = 5 * 1024 * 1024

/**
 * Reports whether a player's response headers let an ancestor frame it, from
 * `X-Frame-Options` and the CSP `frame-ancestors` directive. A CSP with
 * `frame-ancestors` takes precedence over `X-Frame-Options`, as in browsers.
 */
export function frameable(options: frameable.Options): boolean {
  const csp = options.headers['content-security-policy']
  const directive = csp
    ?.split(';')
    .map((entry) => entry.trim().split(/\s+/))
    .find((entry) => entry[0]?.toLowerCase() === 'frame-ancestors')

  if (directive) {
    const ancestor = new URL(options.ancestor)
    return directive.slice(1).some((source) => {
      const value = source.toLowerCase()
      if (value === '*') return true
      if (value === `${ancestor.protocol}`) return true
      if (value === "'none'" || value === "'self'") return false
      const parsed = URL.parse(
        value.includes('://') ? value : `${ancestor.protocol}//${value}`,
      )
      if (!parsed || parsed.protocol !== ancestor.protocol) return false
      const host = parsed.hostname
      if (host.startsWith('%2a.') || host.startsWith('*.'))
        return ancestor.hostname.endsWith(host.slice(host.indexOf('.')))
      return host === ancestor.hostname
    })
  }

  const xfo = options.headers['x-frame-options']?.trim().toLowerCase()
  return xfo !== 'deny' && xfo !== 'sameorigin'
}

export declare namespace frameable {
  type Options = {
    /** Origin of the framing document, such as `https://x.com`. */
    ancestor: string
    /** Player response headers, by lowercase name. */
    headers: Record<string, string>
  }
}

/** Returns the aspect ratio X applies to a player, which is never taller than square. */
export function aspectRatio(card: Card): number {
  const width = card.playerWidth ?? fallbackSize.width
  const height = card.playerHeight ?? fallbackSize.height
  return Math.max(width / height, 1)
}

/**
 * Returns whether two URLs share a site, which hides cookie and storage partitioning
 * and gives a sandboxed player access to its parent. Loopback hosts compare by
 * hostname, so `localhost` and `127.0.0.1` are separate sites. Other hosts compare
 * their last two labels, which misses multi-label public suffixes such as `co.uk`.
 */
export function isSameSite(a: URL, b: URL): boolean {
  if (isLoopback(a) || isLoopback(b)) return a.hostname === b.hostname
  const site = (url: URL) => url.hostname.split('.').slice(-2).join('.')
  return site(a) === site(b)
}

/** Returns whether a URL addresses the local machine. */
export function isLoopback(url: URL): boolean {
  return (
    ['127.0.0.1', '[::1]', 'localhost'].includes(url.hostname) ||
    url.hostname.endsWith('.localhost')
  )
}

function attribute(tag: string, name: string): string | undefined {
  const match = new RegExp(
    `\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`,
    'i',
  ).exec(tag)
  if (!match) return undefined
  return decode(match[1] ?? match[2] ?? match[3] ?? '')
}

function decode(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCodePoint(Number(code)),
    )
    .replace(/&#x([\da-f]+);/gi, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    )
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&')
}

function title(markup: string): string | undefined {
  const value = /<title[^>]*>([^<]*)<\/title>/i.exec(markup)?.[1]?.trim()
  return value ? decode(value) : undefined
}
