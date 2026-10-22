/** Creates the router from the generated route tree. @module */
import { createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen.ts'

/** TanStack Start calls this on the server and in the browser. */
export function getRouter() {
  return createRouter({
    basepath: import.meta.env.BASE_URL,
    routeTree,
    scrollRestoration: true,
  })
}
