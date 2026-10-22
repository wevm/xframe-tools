/**
 * Path prefix the devtools serve every page, asset, and endpoint under, so a host app can mount them.
 * @module
 */

/**
 * Mount path of the devtools, without a trailing slash. `XFRAME_BASE` overrides it at build time, such as `/` for the
 * root deploy on xframe.tools. Read it only from build configuration, since the browser has no `process.env`.
 */
export const base = (process.env.XFRAME_BASE ?? '/__xframe').replace(/\/$/, '')
