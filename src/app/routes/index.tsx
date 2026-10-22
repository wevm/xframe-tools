/** Serves the post preview, which frames a player the way X's timeline does. @module */
import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { base } from '../../internal/Base.ts'
import * as Card from '../../internal/Card.ts'
import * as Crawl from '../../internal/Crawl.ts'
import { Preview } from '../screens/Preview.tsx'

export const Route = createFileRoute('/')({
  component: Page,
  validateSearch: (search: Record<string, unknown>): Search =>
    typeof search.url === 'string' && search.url ? { url: search.url } : {},
})

/** Search parameters of the preview. */
export type Search = {
  /** Page or player URL to preview. */
  url?: string | undefined
}

function Page() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const [origin, setOrigin] = useState<string>()
  const [state, setState] = useState<Preview.State>({ status: 'idle' })

  useEffect(() => setOrigin(window.location.origin), [])

  useEffect(() => {
    const url = search.url
    if (!url) {
      setState({ status: 'idle' })
      return
    }

    let current = true
    setState({ status: 'loading', url })
    void load(url).then((next) => {
      // A newer URL replaces this result.
      if (current) setState(next)
    })
    return () => {
      current = false
    }
  }, [search.url])

  return (
    <Preview
      onSubmit={(url) => void navigate({ search: { url } })}
      origin={origin}
      state={state}
      url={search.url}
    />
  )
}

/**
 * Reads the card on the server, as X does. A deployed server cannot reach a
 * loopback URL, so the browser reads it next, and the URL is framed directly when
 * neither can read it.
 */
async function load(input: string): Promise<Preview.State> {
  const url = URL.parse(input) ?? URL.parse(`https://${input}`)
  if (!url || !['http:', 'https:'].includes(url.protocol))
    return { message: 'Enter an http or https URL.', status: 'error' }

  const server = await (async (): Promise<Crawl.Result> => {
    try {
      const response = await fetch(
        `${base}/api/card?${new URLSearchParams({ url: url.href })}`,
      )
      return (await response.json()) as Crawl.Result
    } catch (error) {
      return { message: String(error), status: 'error' }
    }
  })()
  if (server.status === 'ok')
    return { card: server.card, from: 'server', status: 'ready' }

  if (Card.isLoopback(url)) {
    const browser = await Crawl.read({ headers: {}, url: url.href })
    if (browser.status === 'ok')
      return { card: browser.card, from: 'browser', status: 'ready' }
  }

  return {
    card: Card.direct(url.href),
    from: 'direct',
    note: server.message,
    status: 'ready',
  }
}
