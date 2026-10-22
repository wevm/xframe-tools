/** The client assets of the devtools app's build, which `#assets` names and `pnpm build:app` writes. */
declare const assets: Readonly<
  Record<
    string,
    {
      /** The asset's content, in `encoding`. */
      body: string
      /** `base64` for a binary asset, and `utf8` for a text asset. */
      encoding: 'base64' | 'utf8'
      /** The asset's media type, such as `text/javascript; charset=utf-8`. */
      type: string
    }
  >
>
export default assets
