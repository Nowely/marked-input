# Computed style in the HTML snapshots

Status: ready-for-agent

The story sweep saves HTML with all styling removed: `stripUnstableAttributes` deletes `class`
and `style` from every element (`shared/lib/htmlSnapshot.ts:11-15`), and both `.snap` files
contain zero `style=`. So the three `Styled/*` pages, whose entire point is third-party CSS,
carry snapshot coverage that cannot detect a styling regression, and the only style assertions
in the repo are three `toHaveStyle` lines in `pages/Slots/Slots.spec.ts`.

Decided: record resolved styles in the snapshot itself, as a `<style>` block beside the markup.
Four constraints, all verified:

- **The capture point has to move.** `snapshotHtml` takes a string and re-parses it into a
  detached `<template>` (`htmlSnapshot.ts:4-6`); `getComputedStyle` on a fragment outside the
  document resolves nothing. Styles must be read while the story is still mounted — inside
  `renderStoryHtml` (`shared/lib/page.react.tsx:67`, `page.vue.ts:78`) or a helper taking the
  live container.
- **The block cannot key on `class`.** Class is stripped precisely because CSS-module hashes
  and framework builds make it unstable. Selectors have to be structural
  (`div > span:nth-child(1)`) or an injected snapshot id.
- **A property allowlist is mandatory.** One `.snap` is shared by React and Vue on purpose
  (`pages/stories.spec.ts:8-10`); raw `getComputedStyle` is hundreds of properties with
  px-rounding and UA differences, and each one becomes a cross-framework failure over something
  no user can see.
- **The string signature is pinned.** `pages/htmlSnapshot.spec.ts` asserts `snapshotHtml` over
  four string inputs. They move, or the function splits into capture and format.

Step 0, before any baseline is written: check that `packages/storybook/public/rsuite.min.css` is
served during browser tests at all. The vitest projects are declared in the repo-root
`vite.config.ts` with no `root` or `publicDir`, so it may not be — and a baseline captured
without it would pin unstyled values on the very pages this change is for.

Snapshots move here, so the diff gets explained, not regenerated.
