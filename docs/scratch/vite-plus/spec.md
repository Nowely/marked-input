# Vite+ adoption: assessment

Status: needs-triage

Vite+ 1.0.0 went stable on 2026-09-28 (rc.1 promoted unchanged); 1.1.0 followed on 2026-10-07. It is
one MIT devDependency, `vite-plus`, with a `vp` CLI over Vite, Rolldown, Vitest, Oxlint, Oxfmt,
tsdown, lint-staged and its own task runner (Vite Task), plus optional Node/package-manager
management. Semver covers the `vp` CLI and the config schema; the bundled tools keep their own
versions. Standalone Vite, Vitest, Oxlint and Oxfmt are still released — Vite+ is not a
replacement for them, so nothing forces this migration.

This note is the result of reading the 1.1.0 docs (`voidzero-dev/vite-plus` `docs/` at 58c2f83) and
of a dry-run of `vp migrate` 1.1.0 on a throwaway copy of `next` at f603a82 (#303).

## Where `next` already is

#303 did the hard part of a Vite+ 1.0 upgrade on its own: Vitest 5. The versions line up almost
one to one:

| Tool | `next` | Vite+ 1.0.0 | Vite+ 1.1.0 |
| --- | --- | --- | --- |
| vite | 8.3.1 | 8.3.1 | 8.3.3 (as `@voidzero-dev/vite-plus-core`) |
| vitest | 5.0.2 | 5.0.1 | 5.0.3 |
| oxlint / oxlint-tsgolint | 1.85.0 / 7.0.2003 | 1.85.0 / 7.0.2003 | 1.87.0 / 7.0.2003 |
| oxfmt | 0.70.0 | 0.70.0 | 0.72.0 |
| rolldown | 1.2.11 (via vite) | 1.2.11 | 1.2.12 |
| tsdown | — (vite lib mode + `prepack.js`) | 0.23.0 | 0.23.0 |
| hooks | husky 9 + lint-staged 17.6 | `vp hooks` + `vp staged` (lint-staged 17) | same |

Runtime floor: `^22.18.0 || ^24.11.0 || >=26.0.0`; `vp staged` needs `^22.22.1 || ^24.11.0` and
Git ≥ 2.32. Local Node here is 22.22.0. The Node version that `nowely/action-setup-node@v1` gives
CI is not checked.

## What the dry-run did

`pnpm dlx --package=vite-plus@1.1.0 vp migrate --no-interactive --no-agent --no-editor --no-hooks`
exited 0: "4 config updates applied, 117 files had imports rewritten". The diff:

- **Dependencies.** `vite-plus: 1.1.0` joins the catalog and seven manifests. `oxlint`, `oxfmt`,
  `oxlint-tsgolint` leave the root. The catalog's `vite` becomes
  `npm:@voidzero-dev/vite-plus-core@1.1.0`; `vitest` and the `@vitest/*` entries are pinned exactly
  at 5.0.3. `vitest` is added to `core` and `storybook` (browser mode keeps it direct).
- **Workspace-wide overrides.** `overrides: {vite@*: catalog:, vitest@*: catalog:}` plus
  `peerDependencyRules.allowAny/allowedVersions` for both. Every Vite consumer now runs on
  Vite+ core: Astro 7.3.5 drops its own vite 8.1.5, Storybook's builders follow. Peer warnings for
  vite/vitest are silenced for the whole workspace.
- **Scripts.** Root `vitest`/`oxlint`/`oxfmt` become `vp test run`/`vp lint`/`vp fmt`; package
  `vite build`/`vite` become `vp build`/`vp dev`. `pnpm -w exec vitest …` scripts in `core` and
  `storybook` are left as they are.
- **Imports.** Every `vitest` import (specs, benches, `benchRung`, website samples) becomes
  `vite-plus/test`; `vitest/config` and `@vitest/browser-playwright` in `vite.config.ts` become
  `vite-plus` and `vite-plus/test/browser-playwright`. A `vite-plus/prefer-vite-plus-imports`
  rule is added at `error` to keep it that way.
- **Config.** Root `vite.config.ts` gains `lint: {jsPlugins: [vite-plus], rules: {…},
  options: {typeAware: true, typeCheck: true}}` and an empty `fmt: {}`. Package configs wrap
  `plugins` in `lazyPlugins(() => […])`. Three `env.d.ts` shims appear (`*.vue` module in
  storybook and the Vue adapter, `astro/client` in the website).
- **Left alone.** Husky and lint-staged (by design: `vp migrate` never converts Husky).
- **Install.** No `packageManager` field, so `vp` installed with pnpm 12.11.2 rather than the 10.28
  we use. The lockfile stayed at `lockfileVersion: '9.0'`.

### What breaks

1. **Our lint and format configs are not migrated.** The migrator only recognises
   `.oxlintrc.json(c)` and `.oxfmtrc.json(c)` (`packages/cli/src/migration/detector.ts`), not
   `oxlint.config.ts` / `oxfmt.config.ts`. It removes the `oxlint`/`oxfmt` packages those files
   import (both now fail with TS2307), and the new `lint`/`fmt` blocks in `vite.config.ts` take
   over discovery. Our rule set, overrides, `denyWarnings` and formatting options are gone.
2. **The whole touched tree is reformatted with Oxfmt defaults.** The migrator's final `vp fmt`
   runs with `fmt: {}`: double quotes, semicolons, spaced braces. 125 files, about 22k lines of
   churn, almost all of it formatting.
3. **`typeCheck: true` does not fit this repo.** It is tsgolint's TypeScript 7 checker, and we build
   with TS 6 (see `TODO(ts7)` in `oxlint.config.ts`). It also checks Storybook through the
   editor-only `packages/storybook/tsconfig.json`, which resolves `*.vue.ts` seam imports to their
   React siblings, and reports 11 errors that `vue-tsc -p tsconfig.vue.json` does not have. So
   `vp check` cannot replace `pnpm run typecheck` (tsc + vue-tsc + astro check).
4. `vp lint .` then exits 1: those 13 errors, plus 17 warnings from rules our config turns off.

### What works unchanged

On the migrated copy, with Chromium pointed at the preinstalled build:

- `vp test`: 123 files, 2522 passed, 6 todo — the same counts #303 recorded on `next`.
- `pnpm -F @markput/react run build` and `… @markput/vue run build` (`vp build` + `prepack.js`).
- `pnpm -F @markput/website run build` (Astro on Vite+ core) and both Storybook builds.
- `pnpm run typecheck`.
- The `Failed to resolve dependency: react … optimizeDeps.include` lines in the React project
  appear on unmigrated `next` too.

Not checked: byte-identity of the published `dist/`, `vp staged`/`vp hooks`, a GitHub runner.

## What Vite+ would buy here

- One toolchain pin instead of vite, vitest, oxlint, oxlint-tsgolint and oxfmt kept in step by
  hand (vite and vitest stay in the catalog, but as values derived from that pin). The other side: we lose tool-by-tool upgrades (how #303 was cut). Oxlint, Oxfmt and Vitest move
  when a Vite+ release moves them — 1.1.0 already moves all three past `next`.
- One config file: `lint`, `fmt` and `staged` next to `test` in `vite.config.ts`.
- Hooks without Husky: `vp staged` bundles lint-staged 17 and keeps `--hide-unstaged`.
- `vp run` task caching and `vp check` (fmt + lint in one pass). `vp check`'s type-check half is
  out of reach until the TS 7 move.
- `vp pack` (tsdown 0.23) as a possible replacement for vite lib mode + `prepack.js`. tsdown runs
  `rolldown-plugin-dts` too, so whether it gets past the duplicate-module issue the `prepack.js`
  comment describes would need its own spike.

## Recommendation

No migration now. Nothing we use is deprecated, our tools are already on the versions Vite+
bundles, and the gain is mostly consolidation. Each part of that gain comes with hand work: config
merging, about 120 files of import churn, overrides that move Astro and Storybook onto Vite+ core,
and a `vp check` we cannot fully use before TS 7.

Revisit when one of these happens: the TS 7 migration (then `vp check` could take over
`typecheck`), a library-build rework (then `vp pack` is a real candidate), or the upstream
tools start shipping features only through Vite+.

## If we do it: order of work

Each step green on its own:

1. Declare `packageManager: pnpm@10.28.0`, so `vp` stops choosing a pnpm version.
2. Make `oxlint.config.ts` and `oxfmt.config.ts` export plain objects, and import them into
   `vite.config.ts` as `lint` and `fmt` (the "composing configuration files" pattern in the Vite+
   monorepo guide). Keep `typeAware: true, typeCheck: false`.
3. Run `vp migrate --no-interactive --no-hooks --no-agent --no-editor`. With our `fmt` block in
   place, its formatting pass should be a no-op. Review the overrides and the `env.d.ts` shims;
   drop the ones that change nothing.
4. Decide on the import rewrite: accept `vite-plus/test`, or keep `vitest` imports, drop
   `prefer-vite-plus-imports`, and keep `vitest` direct.
5. Husky + lint-staged → `.vite-hooks/pre-commit` running `vp staged --hide-unstaged` and a
   `staged` block. This changes the hook committers run, so it gets its own commit.
6. CI: keep the current jobs on `pnpm run …`, or move to `voidzero-dev/setup-vp` pinned to an
   exact release. Make sure CI's Node is at least 22.22.1.
7. Docs: `AGENTS.md` (Commands, Checks, Testing), `packages/core/README.md`.
