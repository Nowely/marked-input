# Caret and selection behaviour is measured against Chromium only

The single-host migration turned on browser-specific behaviour that had to be probed rather than reasoned about — gap carets, edge positions, what `beforeinput` reports as cancelable. Firefox measured materially worse on gap carets and edge positions, and covering both would have doubled the probe matrix for a design that was not yet proven. Maintainer decision, 2026-08-10: probe and pin Chromium, and treat other engines as unmeasured rather than supported.

This is a known exposure, not an oversight — the published `@markput/react` and `@markput/vue` packages have Safari and Firefox users.

Full record: [`docs/records/one-host-migration.md`](../records/one-host-migration.md).
