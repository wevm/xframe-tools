/** Renders a player card in X's timeline layout beside its metrics, tags, checks, and frame policy. @module */
import { type FormEvent, type ReactNode, useState } from 'react'
import { style, variants } from 'zyzz/default'
import { base } from '../../internal/Base.ts'
import * as Card from '../../internal/Card.ts'
import type * as Crawl from '../../internal/Crawl.ts'
import policy from '../../internal/policy.json' with { type: 'json' }
import * as Policy from '../../internal/Policy.ts'
import * as Icons from '../components/Icons.tsx'

export function Preview(props: Preview.Props) {
  const state = props.state
  const [reloads, setReloads] = useState(0)

  return (
    <main {...styles.shell()}>
      <UrlBar
        loading={state.status === 'loading'}
        onReload={() => setReloads((value) => value + 1)}
        onSubmit={props.onSubmit}
        url={props.url}
      />

      <div {...styles.columns()}>
        <section aria-label="Post" {...styles.timeline()}>
          <Post reloads={reloads} state={state} />
        </section>

        <div {...styles.inspector()}>
          {state.status === 'ready' ? (
            <Inspector origin={props.origin} state={state} />
          ) : (
            <section {...styles.panel()}>
              <p {...styles.muted()}>
                {state.status === 'error'
                  ? state.message
                  : 'Card metrics, tags, checks, and the frame policy appear here.'}
              </p>
            </section>
          )}
        </div>
      </div>
    </main>
  )
}

export declare namespace Preview {
  type Props = {
    /** Called with the URL entered in the address bar. */
    onSubmit: (url: string) => void
    /** Origin of the devtools page, known once the page runs in the browser. */
    origin?: string | undefined
    /** Card loading state. */
    state: State
    /** URL from the page's search parameters. */
    url?: string | undefined
  }

  /** A card and the responses it was read from. Responses are absent for a URL framed directly. */
  type Report = {
    /** Card to frame. */
    card: Card.Card
    /** Poster image response. */
    image?: Crawl.Fetched | undefined
    /** Page response. */
    page?: Crawl.Fetched | undefined
    /** Player document response, when it differs from the page. */
    player?: Crawl.Fetched | undefined
    /** User agent the requests sent. */
    userAgent?: string | undefined
  }

  type State =
    | { status: 'idle' }
    | { message: string; status: 'error' }
    | { status: 'loading'; url: string }
    | {
        /** Where the card was read: by the server, by the browser, or not at all. */
        from: 'browser' | 'direct' | 'server'
        /** Why the card tags could not be read, when framed directly. */
        note?: string | undefined
        /** Card and responses. */
        report: Report
        status: 'ready'
      }
}

function UrlBar(props: UrlBar.Props) {
  const [value, setValue] = useState(props.url ?? '')

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const url = value.trim()
    if (url) props.onSubmit(url)
  }

  return (
    <form {...styles.bar()} onSubmit={submit}>
      <button
        {...styles.iconButton()}
        aria-label="Reload frame"
        onClick={props.onReload}
        type="button"
      >
        <Icons.Reload />
      </button>
      <label {...styles.address()}>
        <span {...styles.visuallyHidden()}>Page or player URL</span>
        <Icons.Link />
        <input
          {...styles.input()}
          autoComplete="off"
          name="url"
          onChange={(event) => setValue(event.target.value)}
          placeholder="Paste a page or player URL. Localhost works."
          spellCheck={false}
          type="url"
          value={value}
        />
      </label>
      <button
        {...styles.button()}
        disabled={!value.trim() || props.loading}
        type="submit"
      >
        {props.loading ? 'Loading' : 'Load'}
      </button>
    </form>
  )
}

declare namespace UrlBar {
  type Props = {
    loading: boolean
    onReload: () => void
    onSubmit: (url: string) => void
    url?: string | undefined
  }
}

function Post(props: Post.Props) {
  const state = props.state

  return (
    <article {...styles.post()}>
      <span aria-hidden="true" {...styles.avatar()} />
      <div {...styles.body()}>
        <div {...styles.byline()}>
          <span {...styles.name()}>xframe Tools</span>
          <Icons.Verified />
          <span {...styles.muted()}>@xframe · 1h</span>
        </div>

        {(() => {
          if (state.status === 'ready')
            return <Player reloads={props.reloads} report={state.report} />
          if (state.status === 'loading')
            return (
              <>
                <p {...styles.text()}>
                  <span {...styles.link()}>{display(state.url)}</span>
                </p>
                <div {...styles.empty()}>Reading card…</div>
              </>
            )
          return (
            <>
              <p {...styles.text()}>Paste a URL to preview its player.</p>
              <div {...styles.empty()}>No player loaded</div>
            </>
          )
        })()}

        <div {...styles.actions()}>
          <Action count="2" icon={<Icons.Reply />} label="Reply" />
          <Action count="" icon={<Icons.Repost />} label="Repost" />
          <Action count="3" icon={<Icons.Heart />} label="Like" />
          <Action count="1K" icon={<Icons.Views />} label="Views" />
          <span {...styles.trailing()}>
            <Action count="" icon={<Icons.Bookmark />} label="Bookmark" />
            <Action count="" icon={<Icons.Share />} label="Share" />
          </span>
        </div>
      </div>
    </article>
  )
}

declare namespace Post {
  type Props = {
    reloads: number
    state: Preview.State
  }
}

function Player(props: Player.Props) {
  const card = props.report.card
  const src = `${base}/i/cards-frame?${new URLSearchParams({ player: card.player ?? card.url })}`

  return (
    <>
      <p {...styles.text()}>
        <a {...styles.link()} href={card.url} rel="noreferrer" target="_blank">
          {display(card.url)}
        </a>
      </p>
      <div
        {...styles.card({
          style: { aspectRatio: String(Card.aspectRatio(card)) },
        })}
      >
        <iframe
          {...styles.frame()}
          allow={Policy.timeline.allow}
          allowFullScreen={Policy.timeline.allowFullScreen}
          key={props.reloads}
          scrolling={Policy.timeline.scrolling}
          src={src}
          title={card.title ?? card.domain}
        />
      </div>
      <p {...styles.source()}>From {card.domain}</p>
    </>
  )
}

declare namespace Player {
  type Props = {
    reloads: number
    report: Preview.Report
  }
}

function Inspector(props: Inspector.Props) {
  const report = props.state.report
  const [tab, setTab] = useState<Inspector.Tab>('tags')
  const player = report.player ?? report.page
  const checks = [
    ...Card.check(report.card, {
      headers: player?.headers,
      imageBytes: report.image?.bytes,
      origin: props.origin,
    }),
  ]

  if (props.state.from === 'direct')
    checks.unshift({
      level: 'warn',
      message: `Card tags could not be read, so the URL is framed directly at ${Card.fallbackSize.width}×${Card.fallbackSize.height}`,
      tags: [],
    })
  if (props.state.from === 'browser')
    checks.unshift({
      level: 'warn',
      message:
        'The server could not reach this URL, so the browser read its card',
      tags: [],
    })

  const site = (() => {
    const url = report.card.player ? URL.parse(report.card.player) : null
    const origin = props.origin ? URL.parse(props.origin) : null
    if (!url || !origin || !Card.isSameSite(url, origin)) return undefined
    if (!Card.isLoopback(origin)) return { href: undefined }
    const href = new URL(window.location.href)
    href.hostname = origin.hostname === '127.0.0.1' ? 'localhost' : '127.0.0.1'
    return { href: href.href }
  })()
  if (site)
    checks.unshift({
      level: 'fail',
      message:
        'The player shares a site with this page, so storage is not partitioned and the sandbox can reach its parent',
      tags: [],
    })

  const failures = checks.filter((entry) => entry.level === 'fail').length

  return (
    <>
      <div {...styles.metrics()}>
        <Metric
          label="Response time"
          value={report.page ? `${report.page.duration}ms` : '–'}
        />
        <Metric label="Page size" value={size(report.page?.bytes)} />
        <Metric label="Player size" value={size(player?.bytes)} />
        <Metric label="Image size" value={size(report.image?.bytes)} />
      </div>

      {site?.href && (
        <a {...styles.notice()} href={site.href}>
          Open the devtools on {new URL(site.href).hostname} to frame this
          player cross-site
        </a>
      )}

      <section {...styles.panel({ style: { padding: 0 } })}>
        <div aria-label="Inspector" role="tablist" {...styles.tabs()}>
          {Inspector.tabs.map((entry) => (
            <button
              aria-selected={tab === entry}
              key={entry}
              onClick={() => setTab(entry)}
              role="tab"
              type="button"
              {...styles.tab({ selected: tab === entry })}
            >
              {Inspector.labels[entry]}
              {entry === 'checks' && failures > 0 && (
                <span {...styles.badge()}>{failures}</span>
              )}
            </button>
          ))}
        </div>
        <div role="tabpanel" {...styles.tabPanel({ padded: tab !== 'tags' })}>
          {(() => {
            if (tab === 'tags') return <Tags checks={checks} report={report} />
            if (tab === 'checks') return <Checks checks={checks} />
            if (tab === 'policy') return <PolicyTab />
            if (tab === 'request')
              return <Request from={props.state.from} report={report} />
            return <Headers fetched={player} />
          })()}
        </div>
      </section>
    </>
  )
}

declare namespace Inspector {
  type Props = {
    origin?: string | undefined
    state: Extract<Preview.State, { status: 'ready' }>
  }

  type Tab = (typeof tabs)[number]
}

namespace Inspector {
  export const tabs = [
    'tags',
    'checks',
    'policy',
    'request',
    'headers',
  ] as const

  export const labels = {
    checks: 'Checks',
    headers: 'Headers',
    policy: 'Frame policy',
    request: 'Request',
    tags: 'Card tags',
  } as const satisfies Record<Tab, string>
}

function Metric(props: Metric.Props) {
  return (
    <div {...styles.metric()}>
      <span {...styles.metricValue()}>{props.value}</span>
      <span {...styles.metricLabel()}>{props.label}</span>
    </div>
  )
}

declare namespace Metric {
  type Props = { label: string; value: string }
}

function Tags(props: Tags.Props) {
  // X reads twitter:* tags first and falls back to og:* tags.
  const entries = Object.entries(props.report.card.tags).sort(
    (a, b) =>
      Number(b[0].startsWith('twitter:')) - Number(a[0].startsWith('twitter:')),
  )

  return (
    <div>
      {entries.length === 0 ? (
        <p {...styles.row()}>
          <span {...styles.muted()}>No twitter:* or og:* tags found</span>
        </p>
      ) : (
        entries.map((entry) => {
          const level = worst(
            props.checks.filter((check) => check.tags.includes(entry[0])),
          )
          return (
            <div key={entry[0]} {...styles.row()}>
              <code {...styles.tagName()}>{entry[0]}</code>
              <code title={entry[1]} {...styles.tagValue()}>
                {entry[1]}
              </code>
              {level ? <Level level={level} /> : <span />}
            </div>
          )
        })
      )}
    </div>
  )
}

declare namespace Tags {
  type Props = {
    checks: readonly Card.Check[]
    report: Preview.Report
  }
}

function Checks(props: Checks.Props) {
  return (
    <div {...styles.list()}>
      {props.checks.map((check) => (
        <div key={check.message} {...styles.check()}>
          <Level level={check.level} />
          <span>{check.message}</span>
        </div>
      ))}
    </div>
  )
}

declare namespace Checks {
  type Props = { checks: readonly Card.Check[] }
}

function PolicyTab() {
  const sandbox = Policy.tokens(policy.sandbox)

  return (
    <div {...styles.list()}>
      <p {...styles.muted()}>
        The player and every popup it opens inherit this sandbox.
      </p>
      <div {...styles.tokens()}>
        {sandbox.granted.map((token) => (
          <code key={token} {...styles.token({ granted: true })}>
            {token}
          </code>
        ))}
        {sandbox.blocked.map((token) => (
          <code key={token} {...styles.token({ granted: false })}>
            {token}
          </code>
        ))}
      </div>
      <Facts
        entries={[
          ['allow', policy.allow],
          ['Player query', policy.playerQuery],
          ['COOP', policy.headers['cross-origin-opener-policy'] ?? '–'],
          [
            'Captured',
            `${policy.capturedAt.slice(0, 10)} from ${new URL(policy.source).pathname}`,
          ],
        ]}
      />
    </div>
  )
}

function Request(props: Request.Props) {
  const report = props.report
  const page = report.page

  return (
    <Facts
      entries={[
        ['Method', 'GET'],
        ['URL', report.card.url],
        ['Status', page ? String(page.status) : '–'],
        ['Redirected', page ? (page.redirected ? 'Yes' : 'No') : '–'],
        [
          'Read by',
          {
            browser: 'Browser, after the server could not reach it',
            direct: 'Not read, framed directly',
            server: 'Server, as X’s crawler',
          }[props.from],
        ],
        ['User agent', report.userAgent ?? 'Browser default'],
        ['Content type', page?.headers['content-type'] ?? '–'],
        ['Player', report.card.player ?? '–'],
        [
          'Player status',
          report.player
            ? `${report.player.status} in ${report.player.duration}ms`
            : 'Same document as the page',
        ],
        [
          'Image',
          report.image
            ? `${report.image.status}, ${size(report.image.bytes)}, ${report.image.headers['content-type'] ?? 'unknown type'}`
            : '–',
        ],
      ]}
    />
  )
}

declare namespace Request {
  type Props = {
    from: Extract<Preview.State, { status: 'ready' }>['from']
    report: Preview.Report
  }
}

function Headers(props: Headers.Props) {
  const entries = Object.entries(props.fetched?.headers ?? {})
  if (entries.length === 0)
    return <p {...styles.muted()}>No player response headers were read.</p>
  return (
    <div {...styles.list()}>
      <p {...styles.muted()}>Player response headers that affect framing.</p>
      <Facts entries={entries} mono />
    </div>
  )
}

declare namespace Headers {
  type Props = { fetched?: Crawl.Fetched | undefined }
}

function Facts(props: Facts.Props) {
  return (
    <dl {...styles.facts()}>
      {props.entries.map((entry) => (
        <div key={entry[0]} {...styles.fact()}>
          <dt {...styles.muted()}>{entry[0]}</dt>
          <dd {...styles.factValue({ mono: props.mono ?? false })}>
            {entry[1]}
          </dd>
        </div>
      ))}
    </dl>
  )
}

declare namespace Facts {
  type Props = {
    entries: readonly (readonly [string, string])[]
    mono?: boolean | undefined
  }
}

function Level(props: Level.Props) {
  return (
    <span
      aria-label={props.level}
      role="img"
      {...styles.level({ level: props.level })}
    >
      {(() => {
        if (props.level === 'pass') return <Icons.Check />
        if (props.level === 'warn') return <Icons.Warning />
        return <Icons.Cross />
      })()}
    </span>
  )
}

declare namespace Level {
  type Props = { level: Card.Check['level'] }
}

function Action(props: Action.Props) {
  return (
    <span aria-label={props.label} {...styles.action()}>
      {props.icon}
      {props.count && <span>{props.count}</span>}
    </span>
  )
}

declare namespace Action {
  type Props = {
    count: string
    icon: ReactNode
    label: string
  }
}

function display(url: string) {
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '')
}

function size(bytes: number | undefined) {
  if (bytes === undefined) return '–'
  return `${(bytes / 1024).toFixed(2)}kb`
}

function worst(checks: readonly Card.Check[]) {
  if (checks.some((check) => check.level === 'fail')) return 'fail'
  if (checks.some((check) => check.level === 'warn')) return 'warn'
  if (checks.length > 0) return 'pass'
  return undefined
}

namespace styles {
  export const shell = style({
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    marginLeft: 'auto !custom',
    marginRight: 'auto !custom',
    maxWidth: '1280px !custom',
    padding: 4,
  })

  export const bar = style({
    alignItems: 'center',
    display: 'flex',
    gap: 2,
  })

  export const iconButton = style({
    alignItems: 'center',
    backgroundColor: 'transparent !custom',
    border: '1px solid',
    borderColor: 'gray.400',
    borderRadius: '9999px !custom',
    color: 'gray.900',
    cursor: 'pointer',
    display: 'inline-flex',
    flexShrink: 0,
    height: 10,
    justifyContent: 'center',
    width: 10,
    ':focus-visible': { outline: '2px solid', outlineColor: 'blue.600' },
    ':hover': { color: 'foreground' },
  })

  export const address = style({
    alignItems: 'center',
    backgroundColor: 'gray.100',
    border: '1px solid',
    borderColor: 'gray.400',
    borderRadius: '9999px !custom',
    color: 'gray.800',
    display: 'flex',
    flexGrow: 1,
    gap: 2,
    height: 10,
    minWidth: 0,
    paddingLeft: 4,
    paddingRight: 4,
    ':focus-within': { borderColor: 'blue.600' },
  })

  export const input = style({
    backgroundColor: 'transparent !custom',
    border: 'none',
    color: 'foreground',
    flexGrow: 1,
    fontFamily: 'mono',
    minWidth: 0,
    outline: 'none',
    typography: 'copy.14',
    '::placeholder': { color: 'gray.800', fontFamily: 'sans' },
  })

  export const button = style({
    backgroundColor: 'foreground',
    border: 'none',
    borderRadius: '9999px !custom',
    color: 'background.primary',
    cursor: 'pointer',
    flexShrink: 0,
    fontWeight: 'bold',
    height: 10,
    paddingLeft: 5,
    paddingRight: 5,
    typography: 'button.14',
    ':disabled': { cursor: 'default', opacity: 0.5 },
    ':focus-visible': { outline: '2px solid', outlineColor: 'blue.600' },
  })

  export const columns = style({
    display: 'grid',
    gap: 4,
    gridTemplateColumns: 'minmax(0, 1fr) !custom',
    '@media (min-width: 64rem)': {
      alignItems: 'start',
      gridTemplateColumns: 'minmax(0, 600px) minmax(0, 1fr) !custom',
    },
  })

  export const timeline = style({
    border: '1px solid',
    borderColor: 'gray.400',
    borderRadius: '2xl',
    '@media (min-width: 64rem)': { position: 'sticky', top: 4 },
  })

  export const inspector = style({
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    minWidth: 0,
  })

  export const post = style({
    display: 'flex',
    gap: 3,
    paddingBottom: 3,
    paddingLeft: 4,
    paddingRight: 4,
    paddingTop: 3,
  })

  export const avatar = style({
    backgroundImage:
      'linear-gradient(135deg, #1d9bf0, #7856ff 60%, #f91880) !custom',
    borderRadius: '9999px !custom',
    flexShrink: 0,
    height: 10,
    width: 10,
  })

  export const body = style({
    display: 'flex',
    flexDirection: 'column',
    flexGrow: 1,
    minWidth: 0,
  })

  export const byline = style({
    alignItems: 'center',
    display: 'flex',
    gap: 1,
    minWidth: 0,
  })

  export const name = style({ fontWeight: 'bold', typography: 'copy.16' })

  export const muted = style({ color: 'gray.800', typography: 'copy.14' })

  export const text = style({
    overflowWrap: 'anywhere',
    paddingBottom: 3,
    paddingTop: 1,
    typography: 'copy.16',
  })

  export const link = style({
    color: 'blue.600',
    textDecoration: 'none',
    ':hover': { textDecoration: 'underline' },
  })

  export const card = style({
    backgroundColor: 'black',
    border: '1px solid',
    borderColor: 'gray.400',
    borderRadius: '2xl',
    overflow: 'hidden',
    width: '100% !custom',
  })

  export const frame = style({
    border: 'none',
    display: 'block',
    height: '100% !custom',
    width: '100% !custom',
  })

  export const empty = style({
    alignItems: 'center',
    aspectRatio: '1 !custom',
    border: '1px dashed',
    borderColor: 'gray.500',
    borderRadius: '2xl',
    color: 'gray.800',
    display: 'flex',
    justifyContent: 'center',
    typography: 'copy.14',
  })

  export const source = style({
    color: 'gray.800',
    paddingTop: 1,
    typography: 'copy.13',
  })

  export const actions = style({
    alignItems: 'center',
    color: 'gray.800',
    display: 'flex',
    justifyContent: 'space-between',
    paddingTop: 3,
  })

  export const action = style({
    alignItems: 'center',
    display: 'inline-flex',
    gap: 1,
    typography: 'copy.13',
  })

  export const trailing = style({ display: 'inline-flex', gap: 3 })

  export const panel = style({
    border: '1px solid',
    borderColor: 'gray.400',
    borderRadius: 'xl',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    padding: 4,
  })

  export const metrics = style({
    border: '1px solid',
    borderColor: 'gray.400',
    borderRadius: 'xl',
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr)) !custom',
    overflow: 'hidden',
    '@media (min-width: 40rem)': {
      gridTemplateColumns: 'repeat(4, minmax(0, 1fr)) !custom',
    },
  })

  export const metric = style({
    boxShadow: '0 0 0 0.5px #2e2e2e !custom',
    display: 'flex',
    flexDirection: 'column',
    gap: 1,
    paddingBottom: 3,
    paddingLeft: 4,
    paddingRight: 4,
    paddingTop: 3,
  })

  export const metricValue = style({
    fontFamily: 'mono',
    typography: 'copy.16',
  })

  export const metricLabel = style({ color: 'gray.800', typography: 'copy.13' })

  export const notice = style({
    border: '1px solid',
    borderColor: 'red.700',
    borderRadius: 'xl',
    color: 'red.900',
    padding: 3,
    textDecoration: 'none',
    typography: 'copy.14',
    ':hover': { textDecoration: 'underline' },
  })

  export const row = style({
    alignItems: 'center',
    borderBottom: '1px solid',
    borderBottomColor: 'gray.400',
    columnGap: 4,
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 3fr) auto !custom',
    paddingBottom: 2,
    paddingLeft: 4,
    paddingRight: 4,
    paddingTop: 2,
    ':last-child': { borderBottom: 'none' },
    '@media (min-width: 40rem)': {
      gridTemplateColumns: 'minmax(0, 13rem) minmax(0, 1fr) auto !custom',
    },
  })

  export const tagName = style({
    color: 'gray.900',
    fontFamily: 'mono',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    typography: 'copy.13',
    whiteSpace: 'nowrap',
  })

  export const tagValue = style({
    fontFamily: 'mono',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    typography: 'copy.13',
    whiteSpace: 'nowrap',
  })

  export const tabs = style({
    borderBottom: '1px solid',
    borderBottomColor: 'gray.400',
    display: 'flex',
    gap: 5,
    overflowX: 'auto',
    paddingLeft: 4,
    paddingRight: 4,
  })

  export const tab = variants({
    base: {
      alignItems: 'center',
      backgroundColor: 'transparent !custom',
      border: 'none',
      borderBottom: '2px solid',
      cursor: 'pointer',
      display: 'inline-flex',
      flexShrink: 0,
      gap: 2,
      paddingBottom: 3,
      paddingTop: 3,
      typography: 'copy.14',
      ':focus-visible': { outline: '2px solid', outlineColor: 'blue.600' },
    },
    variants: {
      selected: {
        false: {
          borderBottomColor: 'transparent !custom',
          color: 'gray.800',
          ':hover': { color: 'foreground' },
        },
        true: { borderBottomColor: 'blue.600', color: 'foreground' },
      },
    },
  })

  export const badge = style({
    backgroundColor: 'red.700',
    borderRadius: '9999px !custom',
    color: 'white',
    paddingLeft: 2,
    paddingRight: 2,
    typography: 'label.12',
  })

  export const tabPanel = variants({
    variants: {
      padded: { false: {}, true: { padding: 4 } },
    },
  })

  export const list = style({
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
  })

  export const check = style({
    alignItems: 'flex-start',
    display: 'flex',
    gap: 2,
    typography: 'copy.14',
  })

  export const level = variants({
    base: { display: 'inline-flex', flexShrink: 0 },
    variants: {
      level: {
        fail: { color: 'red.900' },
        pass: { color: 'green.900' },
        warn: { color: 'amber.900' },
      },
    },
  })

  export const tokens = style({ display: 'flex', flexWrap: 'wrap', gap: 2 })

  export const token = variants({
    base: {
      border: '1px solid',
      borderRadius: '9999px !custom',
      fontFamily: 'mono',
      paddingBottom: 1,
      paddingLeft: 2,
      paddingRight: 2,
      paddingTop: 1,
      typography: 'copy.13',
    },
    variants: {
      granted: {
        false: {
          borderColor: 'gray.400',
          color: 'gray.700',
          textDecoration: 'line-through',
        },
        true: { borderColor: 'green.700', color: 'green.900' },
      },
    },
  })

  export const facts = style({
    display: 'flex',
    flexDirection: 'column',
    margin: 0,
  })

  export const fact = style({
    borderBottom: '1px solid',
    borderBottomColor: 'gray.400',
    columnGap: 4,
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 10rem) minmax(0, 1fr) !custom',
    paddingBottom: 2,
    paddingTop: 2,
    typography: 'copy.14',
    ':last-child': { borderBottom: 'none' },
  })

  export const factValue = variants({
    base: { margin: 0, overflowWrap: 'anywhere', textAlign: 'right' },
    variants: {
      mono: {
        false: {},
        true: { fontFamily: 'mono', textAlign: 'left', typography: 'copy.13' },
      },
    },
  })

  export const visuallyHidden = style({
    clip: 'rect(0 0 0 0) !custom',
    height: '1px !custom',
    overflow: 'hidden',
    position: 'absolute',
    whiteSpace: 'nowrap',
    width: '1px !custom',
  })
}
