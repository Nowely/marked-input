# The showcase's net is single-framework, so every adapter rule ships half-measured

Type: task
Status: ready-for-human
Blocked by: —

## Problem

`map.md:707-718`:

> **The showcase net is single-framework, and that is an accepted cost rather than an oversight.**
> MEASURED 2026-08-26: `pnpm -w exec vitest list --project vue | grep -ci notion` → `0`, while
> `pages/` holds nineteen framework-free `*.spec.ts` that BOTH projects run. Five of the ten
> defects the hardening round fixed have their only regression pin in `Notion.react.spec.tsx`.
> Converting the page to AGENTS.md's shared harness would double the net, and it is NOT the cheap
> rename the shape suggests: `Notion.fixtures.vue.ts` has to re-declare the whole vocabulary —
> ~800 lines of `options.tsx` plus sixteen presentational leaves — as Vue components, which is a
> second implementation and its own phase (`spec.md`'s P12, still owed with `useControlRef`).

`insights.md:356-364` adds what has changed since and what has not:

> the showcase's net is still three React-only files (`Notion.react.spec.tsx`,
> `caret.react.spec.tsx`, `structure.react.spec.tsx`), and the rules those pin — caret, focus,
> claim ordering — are exactly where an adapter can differ. Every fix from round eight on ships
> half-measured. … **It jumps to rank 1 the moment one adapter defect escapes** — and note that the
> one adapter defect this effort DID find (Vue's `history` boolean cast) was found by a shared spec
> on its first run, which is the argument for this item, not against it.

Verified at `52ef65ae`: the showcase's stories are `Notion.stories.react.tsx` (the `Empty` story
ticket [12](12-upward-mouse-selection.md) reduces to lives at `:53`), and the three React-only spec
files are still the showcase's whole net.

## Why it matters here

`outcome.md:566-570` ranks it seventh *"despite being the largest item, because five of the ten
defects the last hardening round fixed have their only pin in a React-only file — so every fix
above ships half-measured until this lands."*

## Cost, honestly

The largest single item on either record's list, and a second implementation rather than a rename:
~800 lines of `options.tsx` vocabulary plus sixteen presentational leaves as Vue components, plus
Vue's `useControlRef`. The mitigation already taken bounds the exposure and is not a substitute:
the three core rules whose only pin was that file now have core unit pins, and rounds 8–11 put most
new pins in specs both projects run.
