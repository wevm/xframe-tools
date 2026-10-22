/**
 * Responds with a page's card as X's crawler reads it, with `GET /api/card?url=<page>`.
 * @module
 */
import { createFileRoute } from '@tanstack/react-router'
import * as Card from '../../internal/Card.ts'
import * as Crawl from '../../internal/Crawl.ts'

export const Route = createFileRoute('/api/card')({
  server: {
    handlers: {
      GET: async (context) => {
        const url = URL.parse(
          new URL(context.request.url).searchParams.get('url') ?? '',
        )
        if (!url || !['http:', 'https:'].includes(url.protocol))
          return Response.json(
            { message: 'Enter an http or https URL.', status: 'error' },
            { status: 400 },
          )

        const result = await Crawl.read({
          headers: { 'user-agent': Card.crawlerAgent },
          url: url.href,
        })
        return Response.json(result, {
          headers: { 'cache-control': 'no-store' },
        })
      },
    },
  },
})
