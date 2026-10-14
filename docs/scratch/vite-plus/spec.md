# Vite+ adoption

Status: ready-for-human

**Decision, 2026-10-13:** move the whole toolchain to Vite+ 1.1 (`vite-plus`, the `vp` CLI): lint,
format, test, type check, library builds (`vp pack`), commit hooks (`vp staged`) and CI
(`setup-vp`). PR #304.

## Findings worth keeping

- `vp migrate` only reads `.oxlintrc.json`/`.oxfmtrc.json`. Moving our TS configs into
  `vite.config.ts` first is what made its diff clean.
- The TS 7 check in `vp lint` skips SFCs and lint-ignored files, so `vue-tsc` and `astro check` stay.
- `vp pack` (tsdown) needs `lightningcss.projectRoot`, or CSS-module names hash the absolute build
  path, and `NODE_ENV=production` for Vue, or SFC templates keep their comments.
- `vite: catalog:` stays in core and the adapters: without it pnpm installs a second, real `vite`.
- Storybook (≤ 11.0 alpha) caps its optional `vite-plus` peer below 1.0, so install warns. Harmless.

## Open items

- **Required checks on `next`**: `Check Code` replaces `Lint Code`, `Type Check` and
  `Check Formatting`. `Run Tests` and `Build Package` keep their names.
- **`Release.yml`** first runs on the next release.
- **Existing clones**: `git config --unset core.hooksPath && pnpm install` once, or the hook stays
  Husky's dead path.
- **Published output changes**: JS is fully minified (react 142 → 106 kB, vue 146 → 110 kB);
  CSS-module class names change shape (`_Container_3q8ry_1` → `yR3LcW_Container`). Worth a line in
  the release notes.

## Next

- `--cache` on `typecheck` (`vp run`), and `test.fsModuleCache`.
- Backlog 32: one test per slash-menu entry.
