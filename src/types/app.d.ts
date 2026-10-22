/** The devtools app's build, which `#app` names and `pnpm build:app` writes to `dist/app/server`. */
declare const handlers: {
  /** Serves a request with the Worker's bindings. */
  fetch(
    request: Request,
    env: Record<string, unknown>,
    ctx: unknown,
  ): Promise<Response>
}
export default handlers
