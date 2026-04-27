# AGENTS.md

## Project

Markput is an editable text field that combines plain text with inline custom
components through annotated markup patterns.

Packages:

- `packages/core/` (`@markput/core`): dependency-free TypeScript runtime.
  Features live under `src/features/<feature-name>/`, shared utilities under
  `src/shared/`.
- `packages/react/markput/` (`@markput/react`): React adapter.
- `packages/vue/markput/` (`@markput/vue`): Vue adapter.
- `packages/storybook/` (`@markput/storybook`): shared stories and browser
  tests. Test helpers in `src/shared/lib/`.
- `packages/react/app/`, `packages/vue/app/`: E2E demo apps.
- `packages/website/` (`@markput/website`): Astro/Starlight docs in
  `src/content/docs/`.

Default branch: `next`. Shared dependency versions live in the pnpm catalog
in `pnpm-workspace.yaml`. Use `pnpm` for everything.

## Commands

- Setup: `pnpm install`, `pnpm exec playwright install chromium`
- Focused test: `pnpm -w exec vitest run path/to/file.spec.ts`
- Full checks: `pnpm test`, `pnpm run build`, `pnpm run typecheck`,
  `pnpm run lint:check`, `pnpm run format:check`
- Fixers: `pnpm run lint`, `pnpm run format`
- Dev servers: `pnpm run dev`, `pnpm run dev:sb:react`,
  `pnpm run dev:sb:vue`, `pnpm run dev:react:app`, `pnpm run dev:vue:app`

## Architecture Guardrails

Read `packages/website/src/content/docs/development/architecture.md` before
changing core behavior, feature boundaries, token rendering, DOM mapping, or
caret recovery.

The Store orchestrates Signals, feature modules, DOM registration, value edits,
caret recovery, the parser, BlockRegistry, and the event bus. Features
communicate through `store.<feature>.*`, `store.props`, `store.dom`, and
`store.caret`, never through direct feature imports.

Ownership rules:

- `store.props`: framework-provided configuration. Set via `store.props.set()`.
- `store.dom`: DOM refs, structural registration, and DOM-to-token mapping.
- `store.value`: accepted serialized value and replacement APIs.
- `store.caret`: caret state and recovery.
- `store.slots`: slot components and slot props.
- Parser: token addresses and the token index derived from options, drag mode,
  and Mark components.

Hard rules:

- Do not mirror runtime state across features. If two features need the same
  fact, expose it from the feature or store object that owns that fact.
- DOM/token mapping must go through `store.dom`. Do not infer token location
  outside `DomFeature` from DOM child order, public data attributes, user refs,
  or framework-rendered wrapper shape.
- User value mutations must go through `store.value.replaceRange()` or
  `store.value.replaceAll()` with raw positions and optional caret recovery.
  Do not write `store.value.current()` directly for user edits.
- Token objects are parse results, not durable identities. Do not keep a token
  object for later mutation or comparison across edits; use token addresses,
  shape snapshots, or clone the token state before comparing.
- New reactive state must live in the owner of the underlying concept. Do not
  add ad-hoc Signals that mirror state already owned by another feature.
- Components depend on the smallest established abstraction that fits: prefer
  `store.dom`, `store.value`, `store.caret`, `store.parsing`, and slot APIs
  over direct cross-feature imports or DOM guesses.
- Temporary compatibility bridges must be named, documented as temporary, and
  include the condition for removal once the owning feature exists.

## Reuse Before You Add

Before writing a new util, helper, hook, type, or abstraction, search for one
that already does almost the same thing.

- If an existing util is close but not quite right, **upgrade it** instead of
  forking a near-duplicate. Adjust its signature, add an option, generalize
  the implementation.
- If two places solve the same problem differently, surface the inconsistency
  and propose a single shared owner.
- New abstractions need a justification. "Slightly different shape" is not
  one. "Three callers need this and the existing util cannot represent X" is.

## Spec, Plan, and Architecture Review

When you receive a spec, plan, or design — even a small one — review it before
implementing. Push back early, not after the code is written.

Flag and propose alternatives for:

- **Over-engineering**: configuration knobs nobody asked for, premature
  generic types, layers of indirection for a single call site, "future-proof"
  extension points without a concrete second use case.
- **Scope creep**: changes that quietly grow beyond the stated goal.
- **Bad architecture**: state mirrored between features, DOM inferred without
  `store.dom`, parser logic leaking into adapters, framework code reaching
  into core internals, abstractions that hide a single concrete behavior.
- **Code smells**: deep parameter chains, boolean flags driving branches,
  duplicated parsing/serialization, ad-hoc caches, untyped `any` boundaries.

When something looks dramatically wrong or wasteful, say so plainly and
propose a concrete better approach. Do not silently implement a bad request.

## Code Quality

- Prefer **clear, readable code** over clever or micro-optimized code. A
  slower-but-obvious implementation is acceptable unless a benchmark in
  `packages/core/` or a documented hot path says otherwise. Performance
  trade-offs need a measurement, not a hunch.
- Names describe intent, not type or implementation.
- Functions do one thing. Split when a function needs a comment to explain
  what its halves do.
- Avoid comments that narrate the code. Comments explain _why_, constraints,
  or non-obvious trade-offs.

## Testing Policy

- Test files: `*.spec.ts`, `*.spec.tsx`, or framework-specific storybook
  names. Do not add `*.test.ts`.
- Core unit tests live next to the source and use Vitest.
- Test names use imperative present without "should":
  `it('returns undefined when token missing')`.
- Parser tests use `toMatchInlineSnapshot()` with `tokensToDebugTree()`.
- Use `@faker-js/faker` for generated test data.
- Storybook files live in `packages/storybook/src/pages/` as
  `*.react.stories.tsx`, `*.react.spec.tsx`, `*.vue.stories.ts`, or
  `*.vue.spec.ts`.
- Browser tests compose Storybook stories and use real Vitest Browser Mode
  with Playwright. Reuse focus helpers from
  `packages/storybook/src/shared/lib/focus.ts`; Vue tests can use
  `withProps()` from `packages/storybook/src/shared/lib/testUtils.vue.ts`.
- Keep core public functions covered by co-located unit tests.

### HTML / DOM Snapshot Failures

When an HTML or DOM snapshot test fails, **do not regenerate it
automatically**. The snapshot is the contract.

1. Diff the old vs new structure and explain _why_ it changed.
2. Verify the new structure is intentional: same semantic shape, expected
   nesting, no accidental extra wrappers, attribute order or ARIA roles
   preserved where they matter.
3. If the change is correct, update the snapshot and note in the PR what
   structural change caused it.
4. If you cannot explain the diff, treat it as a regression.

## Checks

For code, behavior, public API, package config, or build config changes, run
before finalizing:

1. `pnpm test`
2. `pnpm run build`
3. `pnpm run typecheck`
4. `pnpm run lint:check`
5. `pnpm run format:check`

Focused checks are fine during iteration. Report any skipped check with the
reason.

For docs-only changes, run `pnpm exec oxfmt --check <changed-files>` (or note
that the file is excluded by `oxfmt.config.ts`). For changes under
`packages/website/src/content/docs/**` that touch MDX, frontmatter,
navigation, or config, also run `pnpm -F @markput/website run build`.

Update `packages/website/src/content/docs/` whenever public API, behavior, or
architecture changes. If runtime behavior and docs disagree, fix the docs or
flag the inconsistency.

## Communication With This User

- The user is not a native English speaker. When useful, you may add a short
  "**Language tips**" section for unclear or ungrammatical phrasing from their
  last message: give the corrected version and briefly say why. Keep it 2-5
  lines, friendly, not pedantic. Do not force this section on every reply.
- Ask before installing dependencies or editing the `pnpm-workspace.yaml`
  catalog.
- PR titles use Conventional Commits.
