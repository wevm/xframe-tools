/** Renders the document shell in X's dark color scheme. @module */
import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
} from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { style, vars } from 'zyzz/default'
import reset from 'zyzz/reset.css?url'

export const Route = createRootRoute({
  component: Root,
  head: () => ({
    links: [{ href: reset, rel: 'stylesheet' }],
    meta: [
      { charSet: 'utf-8' },
      { content: 'width=device-width, initial-scale=1', name: 'viewport' },
      { content: 'dark', name: 'color-scheme' },
      { title: 'X Frames Devtools' },
    ],
  }),
})

function Root() {
  return (
    <Document>
      <Outlet />
    </Document>
  )
}

function Document(props: Document.Props) {
  return (
    <html lang="en" {...vars({ colorScheme: 'dark' })}>
      <head>
        <HeadContent />
      </head>
      <body {...styles.body()}>
        {props.children}
        <Scripts />
      </body>
    </html>
  )
}

declare namespace Document {
  type Props = { children: ReactNode }
}

namespace styles {
  export const body = style({
    backgroundColor: 'background.primary',
    color: 'foreground',
    fontFamily: 'sans',
    minHeight: '100dvh !custom',
  })
}
