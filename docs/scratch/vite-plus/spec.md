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
| `ci: … setup-vp` | `setup-vp@v1.21.1` with `node-version: '22'`, `packageManager: pnpm@10.28.0` | job names unchanged |

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
  path. AGENTS.md says so. A fresh clone needs nothing: verified, `pnpm install` sets
  `core.hooksPath` to `.vite-hooks/_` and the hook blocked a commit with an `any`.
- **Published CSS class names change** (`_Container_3q8ry_1` → `_Container_RR8n2G`). They are hashed
  and not a contract, but a consumer that targeted them breaks. Worth a line in the release notes.

## Next worthwhile changes

In rough order of value per effort. Measurements are from a 4-core container.

1. **CI layout.** Five jobs each pay checkout + setup-vp + install for one command. Proposal:
   `check` (`vp check`, then `vp run typecheck`), `test`, `build` (+ smoke-pack), plus one gate job
   `ci` with `needs: [check, test, build]` and `if: always()` that fails when any of them did.
   Branch protection then requires only `ci`, so later job changes never touch repo settings again.
   The cost is one settings change at merge time: the required checks on `next` must become `ci`.
   `vp check` is also cheaper than separate lint and fmt jobs: one program for lint rules and
   types, and Vite+ quotes about 2× for that path.
2. **Playwright in CI.** `vp exec playwright install --with-deps chromium` downloads the browser and
   its apt packages on every run. Cache `~/.cache/ms-playwright` keyed by the playwright version and
   run only `install-deps` on a hit, or run the job in the `mcr.microsoft.com/playwright:v1.63.0`
   image.
3. **`vp run` caching for `typecheck`.** `vp run -r --cache typecheck`: 21 s cold, then 3 of 4 tasks
   replay from cache (the three `vue-tsc` programs, ~23 s of task time saved). `astro check` never
   caches, because starlight-typedoc rewrites `src/content/docs/api/*.md` during the check. That is
   a read and a write of the same input. Cheapest step: `--cache` in the root `typecheck` script.
   CI can reuse the cache across runs too (`node_modules/.vite/task-cache`), but Vite+ marks that
   experimental and asks for a measurement first.
4. **`test.fsModuleCache: true`.** Vitest persists transforms in `node_modules/.vitest-cache`. The
   `boundary` + `docs` projects drop from ~6.9 s to ~5.8 s warm. The browser projects, which are
   most of the suite, were not measured. A one-line change; a local gain only unless CI caches the
   directory.
5. **Dependency leftovers.**
   - `packages/react/app` lists `typescript`, but nothing runs `tsc` there now.
   - `vite: catalog:` is still declared by packages that only use `vite-plus`: core and both
     adapters. Each needs a check that no plugin peers on `vite` (the apps and Storybook do,
     through `@vitejs/plugin-*` and the Storybook builders).
   - Storybook's `typecheck` → `typecheck:vue` indirection can be one script.
   - Storybook 10.6 declares an optional peer `vite-plus@^0.1.15 || ^0.2.0`, so every install warns
     about 1.1.0. It is harmless (both Storybook builds pass); silence it with
     `peerDependencyRules.allowedVersions` (`storybook>vite-plus: '1'`) or wait for Storybook. The
     typedoc warning about TypeScript 6 is older and unrelated.
6. **Backlog 32.** Split "inserts a block … for every entry it offers" into one test per entry, so
   each entry gets its own 15 s budget. It takes 4.3 s alone and ran out of time under a full run.
7. **Existing clones, automatically.** If more than one clone needs the hook fix, `prepare` could
   drop the stale path itself, cross-platform:
   `node -e "try{require('child_process').execSync('git config --unset-all core.hooksPath ^\\.husky/_$')}catch{}" && vp config --no-agent`.
   Remove it once everyone has installed. Not worth it for a single maintainer.
