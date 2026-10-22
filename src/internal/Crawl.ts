/**
 * Fetches a page, its player document, and its poster image, and reports the card with each response's metrics.
 * @module
 */
import * as Card from './Card.ts'

/** Response headers the report keeps, which affect how X frames and caches a player. */
export const headerNames = [
  'cache-control',
  'content-length',
  'content-security-policy',
  'content-type',
  'cross-origin-embedder-policy',
  'cross-origin-opener-policy',
  'cross-origin-resource-policy',
  'location',
  'permissions-policy',
  'referrer-policy',
  'set-cookie',
  'x-frame-options',
] as const

/** Metrics of one fetched response. */
export type Fetched = {
  /** Body size in bytes. */
  bytes: number
  /** Milliseconds from the request to the end of the body. */
  duration: number
  /** Response headers from {@link headerNames}, by lowercase name. */
  headers: Record<string, string>
  /** Whether the request followed a redirect. */
  redirected: boolean
  /** HTTP status code. */
  status: number
  /** Final URL after redirects. */
  url: string
}

/** Outcome of reading a page's card. */
export type Result =
  | {
      /** Card read from the page, or a direct card for a response that is not HTML. */
      card: Card.Card
      /** Poster image response, when the card names one. */
      image?: Fetched | undefined
      /** Page response. */
      page: Fetched
      /** Player document response, when it differs from the page. */
      player?: Fetched | undefined
      /** User agent the requests sent, when set. */
      userAgent?: string | undefined
      status: 'ok'
    }
  | {
      /** Why the page could not be read. */
      message: string
      status: 'error'
    }

/** Fetches a page and reads its card, then fetches its player document and poster image. */
export async function read(options: read.Options): Promise<Result> {
  const page = await fetchOne({ headers: options.headers, url: options.url })
  if (page.status === 'error') return page
  if (page.fetched.status >= 400)
    return {
      message: `${options.url} responded ${page.fetched.status}.`,
      status: 'error',
    }

  const card = page.fetched.headers['content-type']?.includes('html')
    ? Card.parse({ markup: page.body, url: page.fetched.url })
    : Card.direct(page.fetched.url)

  const [player, image] = await Promise.all([
    card.player && card.player !== page.fetched.url
      ? fetchOne({ headers: options.headers, url: card.player })
      : undefined,
    card.image
      ? fetchOne({ headers: options.headers, url: card.image })
      : undefined,
  ])

  return {
    card,
    image: image?.status === 'ok' ? image.fetched : undefined,
    page: page.fetched,
    player: player?.status === 'ok' ? player.fetched : undefined,
    status: 'ok',
    userAgent: options.headers['user-agent'],
  }
}

export declare namespace read {
  type Options = {
    /** Request headers, such as X's crawler user agent. */
    headers: Record<string, string>
    /** Page URL. */
    url: string
  }
}

async function fetchOne(options: read.Options): Promise<fetchOne.ReturnType> {
  const started = performance.now()

  const response = await (async () => {
    try {
      return await fetch(options.url, {
        headers: { accept: 'text/html,*/*;q=0.8', ...options.headers },
        redirect: 'follow',
        signal: AbortSignal.timeout(8_000),
      })
    } catch (error) {
      return error instanceof Error ? error : new Error(String(error))
    }
  })()
  if (response instanceof Error)
    return {
      message: `Could not reach ${options.url}: ${response.message}`,
      status: 'error',
    }

  const buffer = await response.arrayBuffer()
  const headers: Record<string, string> = {}
  for (const name of headerNames) {
    const value = response.headers.get(name)
    if (value !== null) headers[name] = value
  }

  return {
    body: new TextDecoder().decode(buffer),
    fetched: {
      bytes: buffer.byteLength,
      duration: Math.round(performance.now() - started),
      headers,
      redirected: response.redirected,
      status: response.status,
      url: response.url || options.url,
    },
    status: 'ok',
  }
}

declare namespace fetchOne {
  type ReturnType =
    | { body: string; fetched: Fetched; status: 'ok' }
    | { message: string; status: 'error' }
}
