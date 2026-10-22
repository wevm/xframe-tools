/**
 * Captures X's live cards-frame policy into `src/internal/policy.json`, or checks the saved capture for drift.
 * @module
 */
import * as Fs from 'node:fs/promises'
import * as Path from 'node:path'
import * as Policy from '../src/internal/Policy.ts'

// Any post with a third-party player card serves the same cards-frame policy.
const postId = process.env.XFRAMES_POST_ID ?? '2113035952356794655'
const source = `https://x.com/i/cards-frame/${postId}`
const target = Path.resolve(import.meta.dirname, '../src/internal/policy.json')
const check = process.argv.includes('--check')

const response = await fetch(source, {
  headers: {
    'user-agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
  },
})
if (!response.ok) throw new Error(`${source} responded ${response.status}.`)

const live = Policy.parse({
  capturedAt: new Date().toISOString(),
  headers: response.headers,
  markup: await response.text(),
  source,
})

const saved = await (async () => {
  try {
    return JSON.parse(await Fs.readFile(target, 'utf8')) as Policy.Policy
  } catch {
    return undefined
  }
})()

const changes = saved ? Policy.diff(saved, live) : ['policy.json']

if (check) {
  if (changes.length === 0) {
    console.log(`X's cards-frame policy matches ${Path.basename(target)}.`)
    process.exit(0)
  }

  console.error(`X's cards-frame policy changed: ${changes.join(', ')}.`)
  console.error('Run `pnpm update:policy` and review the diff.')
  process.exit(1)
}

if (changes.length === 0) {
  console.log('No changes.')
  process.exit(0)
}

await Fs.writeFile(target, `${JSON.stringify(live, null, 2)}\n`)
console.log(`Updated ${changes.join(', ')}.`)
