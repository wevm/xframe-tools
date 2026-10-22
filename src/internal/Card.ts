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
export function check(card: Card): readonly Check[] {
  const checks: Check[] = []
  const player = card.player ? URL.parse(card.player) : null
  const local = player !== null && isLoopback(player)

  checks.push(
    card.card === 'player'
      ? { level: 'pass', message: 'twitter:card is "player"' }
      : {
          level: 'fail',
          message: card.card
            ? `twitter:card is "${card.card}", so X renders a link card`
            : 'twitter:card is missing, so X renders a link card',
        },
  )

  checks.push(
    (() => {
      if (!player)
        return { level: 'fail', message: 'twitter:player is missing' }
      if (player.protocol === 'https:')
        return { level: 'pass', message: 'twitter:player uses HTTPS' }
      if (local)
        return {
          level: 'warn',
          message: 'twitter:player is a local HTTP URL, which X will not frame',
        }
      return { level: 'fail', message: 'twitter:player must use HTTPS' }
    })(),
  )

  checks.push(
    card.playerWidth && card.playerHeight
      ? {
          level: 'pass',
          message: `Player is ${card.playerWidth}×${card.playerHeight}`,
        }
      : {
          level: 'fail',
          message:
            'twitter:player:width and twitter:player:height are required',
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
    })

  checks.push(
    card.title
      ? { level: 'pass', message: 'Card has a title' }
      : { level: 'fail', message: 'twitter:title or og:title is required' },
  )

  checks.push(
    card.image
      ? { level: 'pass', message: 'Card has a poster image' }
      : {
          level: 'warn',
          message: 'twitter:image is missing, so X shows no poster',
        },
  )

  return checks
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
