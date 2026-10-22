/**
 * Reads a page's card markup over HTTP, from the server with X's crawler user agent or from the browser.
 * @module
 */
import * as Card from './Card.ts'

/** Outcome of reading a page's card markup. */
export type Result =
  | {
      /** Card read from the page, or a direct card for a response that is not HTML. */
      card: Card.Card
      status: 'ok'
    }
  | {
      /** Why the page could not be read. */
      message: string
      status: 'error'
    }

/** Fetches a page and reads its card. Responses that are not HTML are framed directly. */
export async function read(options: read.Options): Promise<Result> {
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
  if (!response.ok)
    return {
      message: `${options.url} responded ${response.status}.`,
      status: 'error',
    }

  if (!response.headers.get('content-type')?.includes('html'))
    return { card: Card.direct(response.url), status: 'ok' }

  const markup = await response.text()
  return { card: Card.parse({ markup, url: response.url }), status: 'ok' }
}

export declare namespace read {
  type Options = {
    /** Request headers, such as X's crawler user agent. */
    headers: Record<string, string>
    /** Page URL. */
    url: string
  }
}
