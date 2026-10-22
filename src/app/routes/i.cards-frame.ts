/**
 * Serves X's cards-frame document, which frames the player under X's sandbox and headers.
 * @module
 */
import { createFileRoute } from '@tanstack/react-router'
import policy from '../../internal/policy.json' with { type: 'json' }
import * as Policy from '../../internal/Policy.ts'

export const Route = createFileRoute('/i/cards-frame')({
  server: {
    handlers: {
      GET: (context) => {
        const player = URL.parse(
          new URL(context.request.url).searchParams.get('player') ?? '',
        )
        if (!player || !['http:', 'https:'].includes(player.protocol))
          return new Response('Missing or invalid player URL.', { status: 400 })

        const nonce = btoa(
          String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))),
        )
        const result = Policy.render(policy, { nonce, player: player.href })

        result.headers.set('content-type', 'text/html; charset=utf-8')
        if (result.deviations.length > 0)
          result.headers.set(
            'x-xframe-deviations',
            result.deviations.join(', '),
          )

        return new Response(result.markup, { headers: result.headers })
      },
    },
  },
})
