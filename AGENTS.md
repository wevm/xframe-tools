# Adapted from wevm/zyzz

Source: https://github.com/wevm/zyzz/blob/main/AGENTS.md
Source blob: `c011a86d47f2991c8803c6533b4d3a8569282261` at commit `be0ca7d`. Retrieved 2026-10-22. General coding conventions are retained. Project principles, UI, testing, layout, tooling, and commands are adapted for xframe Tools. Rust, benchmark, and documentation-site sections are removed.

# Agent Guidelines

## Project Principles

- The devtools reproduce the environment X gives a player card: the timeline iframe, the cards-frame document, its sandbox, its permissions policy, and its response headers. Fidelity to X is the product. A difference from X is a defect unless the devtools report it.
- `src/internal/policy.json` is the authoritative capture of X's cards-frame. `pnpm update:policy` writes it from `https://x.com/i/cards-frame/<postId>`, and nothing else edits it. The cards-frame route serves the captured markup and headers verbatim, with only the nonce and player URL substituted.
- Values that come from X's web client bundle and not from the cards-frame response, such as the timeline iframe's `allow` attribute, live in `Policy.timeline` with a comment naming their source.
- A relaxation needed for local development, such as framing a loopback player, is reported in `Policy.render`'s `deviations`, in the `x-xframe-deviations` header, and in the page's checks. Never relax a policy silently.
- Card checks mirror X's rendering rules. Each `fail` names a condition under which X renders no player. Each `warn` names a condition under which X renders a player that differs from the preview.
- The player must be cross-site from the devtools page, as it is from `x.com`. Same-site framing hides storage partitioning and gives the sandboxed player access to its parent, so the page reports it as a failed check.
- Every page, asset, and endpoint is served under `base` (`/__xframe`), so a host app can mount the build on one path.

## TypeScript Conventions

- Treat `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess` as design constraints. Include `| undefined` when an optional property can explicitly receive `undefined`, and narrow indexed reads before use.
- Use `readonly T[]` for array types. Preserve mutable arrays only when mutation is part of the contract.
- Use `type` for project-owned shapes. Use `interface` only when declaration merging or an external ambient contract requires it.
- Include `.ts` extensions on relative imports and exports. Scripts and test fixtures run in Node without a build step, and they import the same modules as the app.
- Author every source file and script in TypeScript. `.js` files are banned. Node runs TypeScript natively (`node script.ts`), so scripts need no build step.
- Import module-shaped internal files as namespaces (`import * as Policy from './Policy.ts'`) and access members through the module name. Named imports are fine for types, leaf helpers, React components, and third-party APIs that are not module namespaces.
- Import Node built-ins as namespaces unless the neighboring code or API is clearer with a named import.
- Use static imports. Reserve dynamic imports for a real runtime or bundle boundary, not dependency-cycle workarounds.
- Use `import type` and `export type` where an import or export is type-only.
- Use functions and plain data for normal APIs. Classes are limited to errors and framework-required entrypoints.
- Keep error classes in the module that throws them. Set custom error `name` values to the namespaced form, such as `Policy.ParseError`.
- Use unions or `as const` objects instead of enums.
- Prefer `camelCase` constants. Preserve uppercase names only when they mirror an external protocol or established neighboring code.
- Default optional option bags in the signature (`options: fn.Options = {}`), not with `options?: fn.Options` and downstream fallback logic.
- Name typed option bags `options`. Use a domain noun only when the value is not an options bag.
- Prefer one named object parameter over several positional parameters. An instance-like receiver such as `policy` or `card` may be the first positional parameter, followed by an options bag.
- Put a function's parameter, return, and error types in a matching `declare namespace` (`render.Options`, `render.ReturnType`). Keep a sibling exported type only when several functions share the domain type.
- Avoid inline object types on local variables. When an explicit local object type improves clarity, name it directly above the use.
- Do not extract a named type until it is reused or makes a difficult shape materially easier to read.
- Keep shared domain types beside the module that owns the concept.
- Let declared return types constrain intermediate expressions. Avoid redundant local annotations.
- Return values directly unless a binding is reused or gives a complex expression a useful name.
- Prefer immediately invoked function expressions (IIFEs) with explicit branches and early returns over nested or complex ternary expressions. Keep simple two-way ternaries when both branches are easy to scan.
- For a fallible local derivation, prefer an IIFE expression over a mutable variable assigned across `try` and `catch` blocks.
- Never destructure parameters in function definitions, including arrow functions, callbacks, and methods. Accept a named parameter and destructure inside the body when reading several properties.
- Declare component props as `Component.Props` inside the component's matching namespace. Do not use inline props types or standalone component props aliases.
- Prefer short names whose meaning is clear from local context, such as `options`, `card`, `entry`, and `fn`.
- Keep wire formats, ordered tuples, protocol fields, and other order-sensitive shapes explicit. Do not alphabetize data whose order has meaning.
- Avoid new `any`. Use a precise boundary type, validation, narrowing, or the smallest justified assertion.
- Separate distinct contexts and logical steps with one blank line. Group setup, guard clauses, derivation, mutation or emission, and final returns so each step is easy to scan.
- Do not use section-divider comments. Use exports, TSDoc, and whitespace to express module structure.
- Comment invariants and non-obvious reasons, not line-by-line mechanics. Keep comments independent of plans, task IDs, and prior versions.

## Alphabetical Ordering

- Alphabetize imports, named import/export specifiers, public exports, type properties, object properties, union members, unordered lists, configuration maps, scripts, and dependencies. Use case-insensitive lexical order consistently.
- Keep attached documentation with the declaration or property it describes. Do not introduce use-before-initialization or reorder execution.
- Preserve order with observable semantics: Vite plugins, authored CSS declarations, captured markup and headers, tuples, workflow steps, and fixtures testing those orders.
- Keep `name` and `on` first in GitHub workflows; alphabetize the remaining top-level keys. Preserve the package.json group order around `[!start-pkg]`; alphabetize entries within each group.

## Module and Instance Conventions

- Organize each module file as one conceptual namespace containing its public types, constants, functions, and errors. Consumers read calls as `Module.operation(...)`.
- Prefer stateless module functions for pure behavior. Do not create an instance when inputs fully describe the operation.
- Keep parsing, checks, and policy rendering in `src/internal/`, which imports nothing from `void`, `react`, or `@tanstack/*`. Scripts and tests import it in Node.
- Keep HTTP wiring in `src/app/routes/`. A route validates its input, calls `src/internal/`, and returns a `Response`.
- Avoid side-effect registration.

## Abstraction Conventions

- Start with concrete code and extract only after repeated uses reveal a stable shared contract.
- Prefer small local duplication over an abstraction that adds flags, modes, or call-site-specific branches.
- Wait for at least three concrete uses before introducing a general abstraction unless a hard boundary already exists.
- Keep authoritative state, configuration, schemas, and constants in one place; derive dependent values.
- Avoid wrappers that only rename another function or mirror an SDK without narrowing capabilities or adding a domain contract.

## Code Documentation

- Start every maintained TypeScript module with a brief TSDoc `@module` comment describing its responsibility. Place it before imports.
- Add TSDoc to every public export and public type property. Write or update the contract documentation alongside the implementation.
- Document caller-visible purpose, inputs, output, defaults, errors, and side effects. Keep low-level wiring in nearby implementation comments.

## Prose Conventions

Applies to documentation, comments, TSDoc, commit messages, and pull requests.

- Write about the code, not about the person using it. Avoid second person outside interface copy.
- Describe behavior in technical terms rather than by the experience it produces.
- State an invariant or a reason the code cannot show on its own. Leave out justification the code already makes plain.
- Do not use semicolons or em dashes in prose. Split the sentence, or use a comma, colon, or parenthesis. Semicolons remain valid inside code and CSS.
- Keep PR titles and bodies short and concrete. Explain the problem and resulting behavior in a few sentences, include one small example, and add one validation line.

## Testing Conventions

- Runtime coverage is integration only. Do not write unit tests, private-helper tests, or per-function suites disguised as integration tests.
- No mocking, stubbing, fake implementations, module replacements, fake timers, or stubbed globals. Tests start the real dev server with `vp dev`, serve the probe player from `test/fixtures/Player.ts`, and drive Chromium through Playwright.
- The probe player listens on `127.0.0.1` and the devtools on `localhost`, so the player is cross-site from the devtools, as it is from `x.com`.
- Assert sandbox behavior through what the browser enforces, such as the probe's results and Chromium's console messages. Do not assert attributes alone as proof of enforcement.
- Group tests in a `describe` named after the route or flow under test, such as `describe('GET /i/cards-frame')`.
- Assert observable results with inline snapshots (`toMatchInlineSnapshot`). Pass property matchers for genuinely nondeterministic fields, such as ports.
- Add an integration regression scenario for every bug fix, and for every X restriction a player has failed under.
- Use bounded waits for observable conditions. Do not hide flakes with arbitrary sleeps or retries.

## UI Conventions

- Name route page components `Page` and register them with `component: Page`.
- The page uses X's dark scheme. An address bar spans the top. The left column renders the post and its card as X's timeline does, without X's navigation sidebar or trending column. The right column is the inspector, a stack of cards: response metrics, checks, the frame policy, and a network card with request and headers tabs. Below `64rem` the columns stack.
- Screens in `src/app/screens/` take data and handlers as props. Routes own loading and navigation.
- Prefer `zyzz/default` variables and typography tokens. Write a value with ` !custom` only when no default token expresses the design.
- Group a module's styles in `namespace styles` at the bottom of the file, with `styles.card()` at application sites. Separate adjacent `style` definitions with one blank line.
- Keep components in the file that uses them until a second screen needs them. Before adding a shared component, propose it and its responsibility, and wait for agreement.
- Use native controls with labels and visible focus. Respect reduced motion.

## Repository Layout

- `src/internal/` holds pure modules: `Card` reads and checks card tags, `Policy` parses and renders X's cards-frame, `Crawl` fetches a page, its player document, and its poster image with their metrics, and `Base` names the mount path.
- `src/app/` is the TanStack Start app that Void builds: `router.tsx`, `routes/`, `screens/`, and `components/`.
- `scripts/policy.ts` captures X's live cards-frame policy, or checks the saved capture for drift.
- `test/` holds the integration suite and its fixtures.

## Tooling

- Declare every dependency in the default catalog in `pnpm-workspace.yaml`, and reference it as `catalog:` in `package.json`.
- Prettier is banned. Vite+ runs oxfmt, oxlint, and Vitest, configured in `vite.config.ts`. `vite` is aliased to Vite+'s core.
- Void builds and deploys the app to Cloudflare Workers. Read the Markdown docs in `node_modules/void/docs/` before changing Void configuration.

## Workflow Conventions

- Use the smallest script that covers the changed behavior. Run focused tests while iterating.
- Run `pnpm check:types` after TypeScript changes.
- Run `pnpm check:policy` before changing behavior that depends on X's policy, and `pnpm update:policy` to refresh the capture. Review the diff of `src/internal/policy.json` in the same change.
- Run `git diff --check` and inspect the final diff before reporting completion.

## Git Conventions

- Conventional commits, lowercase, no trailing period: `feat:`, `fix:`, `perf:`, `refactor:`, `docs:`, `test:`, `chore:`. Scope optional.
- Name the thing that changed, in the identifiers the codebase already uses.
- State the change, not the reason for it. Leave `because`, `so that`, and `in order to` out of the subject.
- Never force push and never amend a pushed commit. Correct a mistake with a follow-up commit.

## Commands

- `pnpm dev` serves the devtools at `http://localhost:3000/__xframe/`.
- `pnpm build` builds the Worker with Void. `pnpm deploy` deploys it with `void deploy`.
- `pnpm check` runs `vp check --fix` for formatting and syntax-only lint. `pnpm check:types` runs `tsc`.
- `pnpm test` runs the integration suite. `PLAYWRIGHT_EXECUTABLE_PATH` names a Chromium binary in place of Playwright's own.
- `pnpm check:policy` fails when X's live cards-frame differs from `src/internal/policy.json`. `pnpm update:policy` rewrites it.
- `node test/fixtures/Player.ts` serves the probe player at `http://127.0.0.1:5173`.
