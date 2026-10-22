/** Creates the router from the generated route tree. @module */
import { createRouter } from '@tanstack/react-router'
import { base } from '../internal/Base.ts'
import { routeTree } from './routeTree.gen.ts'

/** TanStack Start calls this on the server and in the browser. */
export function getRouter() {
  return createRouter({ basepath: base, routeTree, scrollRestoration: true })
}
