/**
 * Captures and reproduces the sandbox, permissions, and response headers X applies to player cards.
 * @module
 */
import * as Card from './Card.ts'

/** Response headers copied from X's cards-frame document. */
export const headerNames = [
  'cache-control',
  'content-security-policy',
  'cross-origin-opener-policy',
  'cross-origin-resource-policy',
  'origin-agent-cluster',
  'referrer-policy',
  'x-content-type-options',
  'x-dns-prefetch-control',
  'x-download-options',
  'x-frame-options',
  'x-permitted-cross-domain-policies',
  'x-xss-protection',
] as const

/** Placeholder for the per-request script nonce in captured markup and headers. */
export const noncePlaceholder = '{{nonce}}'

/** Placeholder for the player URL in captured markup. */
export const playerPlaceholder = '{{player}}'

/**
 * Outer iframe attributes from X's web client (`abs.twimg.com/x-web`). The timeline
 * renders this iframe around `/i/cards-frame/<postId>` without a sandbox.
 */
export const timeline = {
  allow: 'autoplay; fullscreen; web-share',
  allowFullScreen: true,
  scrolling: 'no',
} as const

/** A captured cards-frame document. */
export type Policy = {
  /** Player iframe `allow` attribute. */
  allow: string
  /** ISO timestamp of the capture. */
  capturedAt: string
  /** Response headers, with the nonce replaced by {@link noncePlaceholder}. */
  headers: Record<string, string>
  /** Document markup, with the nonce and player URL replaced by placeholders. */
  markup: string
  /** Query string X appends to the player URL. */
  playerQuery: string
  /** Player iframe `sandbox` attribute. */
  sandbox: string
  /** URL the policy was captured from. */
  source: string
}

/**
 * Extracts a policy from a fetched cards-frame response.
 *
 * @throws {ParseError} When the markup has no player iframe or no nonce.
 */
export function parse(options: parse.Options): Policy {
  const iframe = /<iframe\b[\s\S]*?>/i.exec(options.markup)?.[0]
  if (!iframe) throw new ParseError('Cards-frame markup has no iframe.')

  const dataSrc = attribute(iframe, 'data-src')
  if (!dataSrc) throw new ParseError('Cards-frame iframe has no data-src.')

  const nonce = /\bnonce="([^"]+)"/.exec(options.markup)?.[1]
  if (!nonce) throw new ParseError('Cards-frame markup has no script nonce.')

  const player = decode(dataSrc)
  const playerQuery = new URL(player).search.slice(1)

  const headers: Record<string, string> = {}
  for (const name of headerNames) {
    const value = options.headers.get(name)
    if (value !== null)
      headers[name] = value.replaceAll(nonce, noncePlaceholder)
  }

  return {
    allow: attribute(iframe, 'allow') ?? '',
    capturedAt: options.capturedAt,
    headers,
    markup: options.markup
      .replaceAll(nonce, noncePlaceholder)
      .replace(dataSrc, playerPlaceholder),
    playerQuery,
    sandbox: attribute(iframe, 'sandbox') ?? '',
    source: options.source,
  }
}

export declare namespace parse {
  type Options = {
    /** ISO timestamp recorded on the policy. */
    capturedAt: string
    /** Response headers. */
    headers: Headers
    /** Response body. */
    markup: string
    /** Fetched URL. */
    source: string
  }
}

/** Compares two captures, ignoring when and where they were taken. */
export function diff(a: Policy, b: Policy): readonly string[] {
  const changes: string[] = []

  for (const key of ['allow', 'markup', 'playerQuery', 'sandbox'] as const)
    if (a[key] !== b[key]) changes.push(key)

  const names = new Set([...Object.keys(a.headers), ...Object.keys(b.headers)])
  for (const name of [...names].sort())
    if (a.headers[name] !== b.headers[name]) changes.push(`headers.${name}`)

  return changes
}

/**
 * Renders the cards-frame document for a player URL.
 *
 * X only frames HTTPS players and its CSP limits `frame-src` to `https://*`. A
 * loopback player additionally gets loopback `frame-src` sources and loses
 * `upgrade-insecure-requests`, and each relaxation is reported in `deviations`.
 */
export function render(
  policy: Policy,
  options: render.Options,
): render.ReturnType {
  const url = new URL(options.player)
  for (const [key, value] of new URLSearchParams(policy.playerQuery))
    url.searchParams.set(key, value)

  const deviations: string[] = []
  const headers = new Headers()
  for (const [name, value] of Object.entries(policy.headers))
    headers.set(name, value.replaceAll(noncePlaceholder, options.nonce))

  const csp = headers.get('content-security-policy')
  if (csp && Card.isLoopback(url)) {
    headers.set('content-security-policy', relax(csp))
    deviations.push(
      'frame-src allows loopback origins',
      'upgrade-insecure-requests is removed',
    )
  }

  return {
    deviations,
    headers,
    markup: policy.markup
      .replaceAll(noncePlaceholder, options.nonce)
      .replace(playerPlaceholder, escape(url.href)),
  }
}

export declare namespace render {
  type Options = {
    /** Per-request script nonce. */
    nonce: string
    /** Player URL from the card's `twitter:player` tag. */
    player: string
  }

  type ReturnType = {
    /** Differences from X's policy needed to frame a local player. */
    deviations: readonly string[]
    /** Response headers. */
    headers: Headers
    /** Document markup. */
    markup: string
  }
}

/** Thrown when a cards-frame response does not have the expected shape. */
export class ParseError extends Error {
  override name = 'Policy.ParseError'
}

function attribute(tag: string, name: string): string | undefined {
  const match = new RegExp(`\\s${name}(?:="([^"]*)")?(?=[\\s>/])`, 'i').exec(
    tag,
  )
  if (!match) return undefined
  return match[1] ?? ''
}

function decode(value: string): string {
  return value
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&')
}

function escape(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

function relax(csp: string): string {
  return csp
    .split(';')
    .filter((directive) => directive.trim() !== 'upgrade-insecure-requests')
    .map((directive) =>
      directive.trim().startsWith('frame-src ')
        ? `${directive} http://localhost:* http://127.0.0.1:* http://*.localhost:*`
        : directive,
    )
    .join(';')
}
