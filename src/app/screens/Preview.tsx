/** Renders a post with a player card in X's timeline layout, with the card's checks and frame policy. @module */
import { type FormEvent, useState } from 'react'
import { style, variants } from 'zyzz/default'
import { base } from '../../internal/Base.ts'
import * as Card from '../../internal/Card.ts'
import policy from '../../internal/policy.json' with { type: 'json' }
import * as Policy from '../../internal/Policy.ts'
import * as Icons from '../components/Icons.tsx'

export function Preview(props: Preview.Props) {
  const state = props.state

  return (
    <main {...styles.column()}>
      <header {...styles.header()}>
        <span {...styles.back()}>
          <Icons.ArrowLeft />
        </span>
        <h1 {...styles.title()}>Post</h1>
      </header>

      <Composer onSubmit={props.onSubmit} url={props.url} />

      <article {...styles.post()}>
        <Avatar />
        <div {...styles.body()}>
          <div {...styles.byline()}>
            <span {...styles.name()}>xframe Tools</span>
            <Icons.Verified />
            <span {...styles.muted()}>@xframe · 1h</span>
          </div>

          {(() => {
            if (state.status === 'idle')
              return (
                <>
                  <p {...styles.text()}>Paste a URL to preview its player.</p>
                  <div {...styles.empty()}>No player loaded</div>
                </>
              )
            if (state.status === 'error')
              return <p {...styles.text()}>{state.message}</p>
            if (state.status === 'loading')
              return (
                <>
                  <p {...styles.text()}>
                    <span {...styles.link()}>{display(state.url)}</span>
                  </p>
                  <div {...styles.empty()}>Reading card…</div>
                </>
              )
            return <Player origin={props.origin} state={state} />
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

      {state.status === 'ready' && (
        <Checks origin={props.origin} state={state} />
      )}
      <PolicyPanel />
    </main>
  )
}

export declare namespace Preview {
  type Props = {
    /** Origin of the devtools page, known once the page runs in the browser. */
    origin?: string | undefined
    /** Called with the URL entered in the composer. */
    onSubmit: (url: string) => void
    /** Card loading state. */
    state: State
    /** URL from the page's search parameters. */
    url?: string | undefined
  }

  type State =
    | { status: 'idle' }
    | { message: string; status: 'error' }
    | { status: 'loading'; url: string }
    | {
        /** Card to frame. */
        card: Card.Card
        /** Where the card was read: by the server, by the browser, or not at all. */
        from: 'browser' | 'direct' | 'server'
        /** Why the card tags could not be read, when framed directly. */
        note?: string | undefined
        status: 'ready'
      }
}

function Composer(props: Composer.Props) {
  const [value, setValue] = useState(props.url ?? '')

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const url = value.trim()
    if (url) props.onSubmit(url)
  }

  return (
    <form {...styles.composer()} onSubmit={submit}>
      <Avatar />
      <div {...styles.body()}>
        <label {...styles.visuallyHidden()} htmlFor="url">
          Page or player URL
        </label>
        <input
          {...styles.input()}
          autoComplete="off"
          id="url"
          name="url"
          onChange={(event) => setValue(event.target.value)}
          placeholder="Paste a page or player URL"
          spellCheck={false}
          type="url"
          value={value}
        />
        <div {...styles.toolbar()}>
          <span {...styles.hint()}>
            <Icons.Link />
            Reads twitter:player tags. Localhost works.
          </span>
          <button {...styles.button()} disabled={!value.trim()} type="submit">
            Load
          </button>
        </div>
      </div>
    </form>
  )
}

declare namespace Composer {
  type Props = {
    onSubmit: (url: string) => void
    url?: string | undefined
  }
}

function Player(props: Player.Props) {
  const card = props.state.card
  const [key, setKey] = useState(0)
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
          key={key}
          scrolling={Policy.timeline.scrolling}
          src={src}
          title={card.title ?? card.domain}
        />
      </div>
      <div {...styles.source()}>
        <span>From {card.domain}</span>
        <button
          {...styles.reload()}
          onClick={() => setKey((value) => value + 1)}
          type="button"
        >
          <Icons.Reload />
          Reload frame
        </button>
      </div>
    </>
  )
}

declare namespace Player {
  type Props = {
    origin?: string | undefined
    state: Extract<Preview.State, { status: 'ready' }>
  }
}

function Checks(props: Checks.Props) {
  const card = props.state.card
  const checks = [...Card.check(card)]
  const player = card.player ? URL.parse(card.player) : null
  const origin = props.origin ? URL.parse(props.origin) : null

  if (props.state.from === 'direct')
    checks.unshift({
      level: 'warn',
      message: `Card tags could not be read, so the URL is framed directly at ${Card.fallbackSize.width}×${Card.fallbackSize.height}`,
    })
  if (props.state.from === 'browser')
    checks.unshift({
      level: 'warn',
      message:
        'The server could not reach this URL, so the browser read its card',
    })

  const swap = (() => {
    if (!player || !origin || !Card.isSameSite(player, origin)) return undefined
    if (!Card.isLoopback(origin)) return null
    const url = new URL(window.location.href)
    url.hostname = origin.hostname === '127.0.0.1' ? 'localhost' : '127.0.0.1'
    return url.href
  })()

  return (
    <section {...styles.panel()}>
      <h2 {...styles.panelTitle()}>Card checks</h2>
      {swap !== undefined && (
        <div {...styles.check()}>
          <span {...styles.level({ level: 'fail' })}>
            <Icons.Cross />
          </span>
          <span>
            The player shares a site with this page, so storage is not
            partitioned and the sandbox can reach its parent.{' '}
            {swap ? (
              <a {...styles.link()} href={swap}>
                Open on {new URL(swap).hostname}
              </a>
            ) : (
              'Serve the devtools from a different domain.'
            )}
          </span>
        </div>
      )}
      {checks.map((check) => (
        <div key={check.message} {...styles.check()}>
          <span {...styles.level({ level: check.level })}>
            {(() => {
              if (check.level === 'pass') return <Icons.Check />
              if (check.level === 'warn') return <Icons.Warning />
              return <Icons.Cross />
            })()}
          </span>
          <span>{check.message}</span>
        </div>
      ))}
    </section>
  )
}

declare namespace Checks {
  type Props = {
    origin?: string | undefined
    state: Extract<Preview.State, { status: 'ready' }>
  }
}

function PolicyPanel() {
  const sandbox = Policy.tokens(policy.sandbox)

  return (
    <section {...styles.panel()}>
      <h2 {...styles.panelTitle()}>Frame policy</h2>
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
      <dl {...styles.facts()}>
        <dt {...styles.muted()}>allow</dt>
        <dd>
          <code>{policy.allow}</code>
        </dd>
        <dt {...styles.muted()}>COOP</dt>
        <dd>
          <code>{policy.headers['cross-origin-opener-policy']}</code>
        </dd>
        <dt {...styles.muted()}>Captured</dt>
        <dd>
          {new Date(policy.capturedAt).toISOString().slice(0, 10)} from{' '}
          <code>{new URL(policy.source).pathname}</code>
        </dd>
      </dl>
    </section>
  )
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
    icon: React.ReactNode
    label: string
  }
}

function Avatar() {
  return <span aria-hidden="true" {...styles.avatar()} />
}

function display(url: string) {
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '')
}

namespace styles {
  export const column = style({
    borderLeft: '1px solid',
    borderLeftColor: 'gray.400',
    borderRight: '1px solid',
    borderRightColor: 'gray.400',
    marginLeft: 'auto !custom',
    marginRight: 'auto !custom',
    maxWidth: '600px !custom',
    minHeight: '100dvh !custom',
    paddingBottom: 16,
  })

  export const header = style({
    alignItems: 'center',
    backdropFilter: 'blur(12px) !custom',
    backgroundColor: 'rgb(0 0 0 / 0.65) !custom',
    display: 'flex',
    gap: 6,
    height: '53px !custom',
    paddingLeft: 4,
    paddingRight: 4,
    position: 'sticky',
    top: 0,
    zIndex: 1,
  })

  export const back = style({
    alignItems: 'center',
    display: 'inline-flex',
    height: 9,
    justifyContent: 'center',
    width: 9,
  })

  export const title = style({ typography: 'heading.20' })

  export const composer = style({
    borderBottom: '1px solid',
    borderBottomColor: 'gray.400',
    borderTop: '1px solid',
    borderTopColor: 'gray.400',
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

  export const input = style({
    backgroundColor: 'transparent !custom',
    border: 'none',
    color: 'foreground',
    fontSize: 'xl',
    outline: 'none',
    paddingBottom: 3,
    paddingTop: 2,
    width: '100% !custom',
    '::placeholder': { color: 'gray.800' },
  })

  export const toolbar = style({
    alignItems: 'center',
    borderTop: '1px solid',
    borderTopColor: 'gray.400',
    display: 'flex',
    gap: 3,
    justifyContent: 'space-between',
    paddingTop: 3,
  })

  export const hint = style({
    alignItems: 'center',
    color: 'blue.600',
    display: 'inline-flex',
    gap: 2,
    typography: 'copy.13',
  })

  export const button = style({
    backgroundColor: 'foreground',
    border: 'none',
    borderRadius: '9999px !custom',
    color: 'background.primary',
    cursor: 'pointer',
    flexShrink: 0,
    fontWeight: 'bold',
    paddingBottom: 2,
    paddingLeft: 5,
    paddingRight: 5,
    paddingTop: 2,
    typography: 'button.14',
    ':disabled': { cursor: 'default', opacity: 0.5 },
    ':focus-visible': { outline: '2px solid', outlineColor: 'blue.600' },
  })

  export const post = style({
    borderBottom: '1px solid',
    borderBottomColor: 'gray.400',
    display: 'flex',
    gap: 3,
    paddingBottom: 3,
    paddingLeft: 4,
    paddingRight: 4,
    paddingTop: 3,
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
    alignItems: 'center',
    color: 'gray.800',
    display: 'flex',
    justifyContent: 'space-between',
    paddingTop: 1,
    typography: 'copy.13',
  })

  export const reload = style({
    alignItems: 'center',
    backgroundColor: 'transparent !custom',
    border: 'none',
    color: 'gray.800',
    cursor: 'pointer',
    display: 'inline-flex',
    gap: 1,
    typography: 'copy.13',
    ':hover': { color: 'blue.600' },
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
    borderRadius: '2xl',
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
    marginLeft: 4,
    marginRight: 4,
    marginTop: 4,
    padding: 4,
  })

  export const panelTitle = style({ typography: 'heading.20' })

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
    columnGap: 4,
    display: 'grid',
    gridTemplateColumns: 'auto 1fr !custom',
    rowGap: 2,
    typography: 'copy.14',
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
