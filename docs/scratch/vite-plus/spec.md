# Vite+ adoption

Status: ready-for-human

Vite+ 1.0.0 went stable on 2026-09-28; 1.1.0 followed on 2026-10-07. It is one MIT devDependency,
`vite-plus`, with a `vp` CLI over Vite, Rolldown, Vitest, Oxlint, Oxfmt, tsdown, lint-staged and a
task runner. Semver covers the CLI and the config schema; the bundled tools keep their own versions.

**Decision, 2026-10-13:** migrate fully to 1.1.0. That covers the toolchain, the TS 7 type check in
`vp check`, library builds with `vp pack`, commit hooks with `vp staged`, and CI on
`voidzero-dev/setup-vp`. The first version of this note recommended waiting, because the gain is
mostly consolidation. The migration was chosen for that consolidation. It landed on
`claude/compassionate-carson-l20jp9` as six commits, each green on its own.

## What landed

| Commit | Change | Observable effect |
| --- | --- | --- |
| `chore(deps): align …` | standalone vite 8.3.3, vitest 5.0.3, oxlint 1.87, oxfmt 0.72: what 1.1.0 bundles | oxfmt re-indents two records in `docs/records/` |
| `build: switch the toolchain to Vite+ 1.1` | `vite-plus` replaces five pins; lint/fmt config into `vite.config.ts`; imports → `vite-plus/test`; scripts → `vp` | none: `dist/` byte-identical, same test counts |
| `build: type-check … with TS 7` | `typeCheck: true`; solution-style Storybook tsconfig; `*.vue` shims; `tsc` dropped where covered (core's in a follow-up) | a `.ts` type error now also fails `lint:check` |
| `build: build the libraries with vp pack` | tsdown via `pack` blocks, `scripts/adapterPack.ts`; both `prepack.js` go | CSS-module hash suffixes change; JS differs in codegen only |
| `build: run the pre-commit hook through vp` | `.vite-hooks/pre-commit` → `vp staged --hide-unstaged`; `staged: {'*': 'vp check --fix'}` | the hook checks the staged files, Markdown included |
| `ci: … setup-vp` | `setup-vp@v1.21.1`, `packageManager: pnpm@10.28.0`, `.node-version` 22 | job names unchanged |

Each commit message carries its own evidence and edge cases.

## What the first version of this note got wrong

- **`vp migrate` is usable here, after one manual step.** It only recognises `.oxlintrc.json`/
  `.oxfmtrc.json`. On the dry-run it dropped our TS lint and format configs and reformatted ~22k
  lines with Oxfmt defaults. Moving those configs into `vite.config.ts` first made it produce a clean
  diff (405 insertions, 173 deletions outside the lockfile).
- **TS 7 is not the obstacle to `vp check` type-checking.** Outside Storybook it reports nothing on
  our `.ts`/`.tsx`, and it catches `@ts-expect-error` and `expectTypeOf` pins. Its real limits,
  measured with planted errors: it skips SFCs, and it skips lint-ignored files. So `typecheck`
  keeps `vue-tsc` and `astro check`. The lint-ignored vendored `alien-signals` needs nothing extra:
  `vue-tsc` reports errors there from both the Vue adapter and Storybook, because core imports it.
  Core's own `tsc` was dropped on that evidence.
- **`vp pack` handles the declarations.** One tsdown build produces `index.d.ts`, byte-identical
  to `prepack.js`'s; the duplicate-module problem did not appear.

## Open items

- **CI is unverified.** Pushes to this branch do not trigger it; the first PR run will show it.
  Both workflows parse and every command passes locally. `Release.yml` is first exercised by the
  next release: it publishes with `pnpm publish`, through the pnpm setup-vp manages.
- **Existing clones lose the hook silently** until `git config --unset core.hooksPath && pnpm
  install`. Husky left `core.hooksPath` at `.husky/_`, and `vp config` does not override another
  path. AGENTS.md says so; new clones need nothing.
- **Branch protection.** Required checks on `next` match job names, so the five jobs kept theirs.
  If the rule is updated, Lint Code + Check Formatting could become one `vp check` job.
- **Published CSS class names change** (`_Container_3q8ry_1` → `_Container_RR8n2G`). They are hashed
  and not a contract, but a consumer that targeted them breaks. Worth a line in the release notes.

## Next worthwhile changes

- Vitest now suggests `fsModuleCache: true` for the `boundary` and `docs` projects (30 s and 8 s
  of transforms, redone on every run).
- `vp run` caches nothing yet: `package.json` scripts are uncached by default. Tasks in a `run`
  block of `vite.config.ts` (typecheck, build) would make repeated local and CI runs cheaper; CI
  would also need the Vite Task cache from the setup-vp docs.
- `packages/react/app` still lists `typescript` though nothing there runs `tsc` any more.
- Backlog 32 got a measurement from this work: the slash-menu test times out under a full plain
  run too, at 4.3 s alone against 15 s.
