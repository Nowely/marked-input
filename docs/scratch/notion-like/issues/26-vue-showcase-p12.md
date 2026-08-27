# The showcase's net is single-framework, so every adapter rule ships half-measured

Type: task
Status: resolved — the page is framework-free and both projects run its net (2026-08-27)
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

## Answer (T-VUE, 2026-08-27)

**The net is DOUBLE-RUN.** `Notion.spec.ts` (92), `caret.spec.ts` (15) and `structure.spec.ts` (37)
are framework-free and both vitest projects run them: 144 assertions per project where there were
144 in one. (`vitest list` per project, 2026-08-27; the first write of this line said 18 for the
caret file, which does not add up to 144 and was not measured.) `Notion.stories.ts` is shared too, so the `Showcase` and `Empty` story snapshots moved
out of `stories.react.spec.tsx.snap` and into the file both projects compare against.

**The port was not the deliverable and it was not a rename either.** What made it small was
measuring the estimate rather than trusting it. `options.tsx` went **869 → 498 lines**: every
markup, menu entry, continuation, indent flag, split, and every reading a kind makes of its own body
left it for `notion/vocabulary.ts`, which imports nothing at all, and `marks.tsx` went 69 → 49 the
same way. The shared module is 512 lines, of which about 60 are the assembler that wires a paint map
onto the declarations. Each adapter's option file now supplies components and nothing else.

(`2a566273`'s body says "322 lines", which was the pre-measurement estimate; the figure above is the
count.)

The sixteen leaves ARE a real second implementation — 654 lines of Vue against 525 of React, plus 555
against 498 for the option file and 81 against 49 for the marks. The vocabulary is not.

**Vue's `useControlRef` and `Atomic` shipped**, which is what [24](24-ship-the-atomic-wrapper.md)
deferred here. The hook takes Vue's ref ARGUMENT rather than an element, through the same `unwrapEl`
reading `Row.vue` makes, so a component whose root is not an element registers nothing instead of
throwing.

### What the shared net found on its first run

Two defects, both Vue-only, both invisible to review:

1. **A row kind could not keep its own class.** `RowProps` publishes `class` and documents the
   fallthrough; the adapter passed `className`, which Vue resolves to a DOM property write applied
   after the template's own class and overwriting it whole. Measured: a component reading
   `<div class="mine">` painted `class="_Row_…"` and nothing else. Fixed in `Row.vue` (`268feab1`);
   reverting it reddens **29** of this page's Vue tests with `title: +0`, `no toggle starting "Why"`
   and `the page painted no fence`.
2. **A kind that reads its own raw body never repainted.** `node.slot()` is a core signal and core's
   signals are not Vue-reactive, so a plain read is right once and stale after; a `computed` over one
   is worse, because with no reactive dependency it caches for ever; and reading it during render
   does not help either, because `Atomic` — a child with unchanged props and a compiled stable slot
   — is skipped when its parent repaints. Measured on the board: a card dragged between columns wrote
   the document, the emitted value was right, undo took it back, and the columns on screen never
   moved. Every raw-bodied kind reads through a `useMarkput` ref now, and the rule is in
   `guides/row-kinds.md`.

Three further differences were DOM-level and are recorded at the commit rather than here: a Vue
`<select>` writes a bound `value` as an attribute (so the fence takes `v-model`), Vue emits
`checked` before `type` unless the template says otherwise, and Vue condenses the newlines around
mixed text into spaces. All three were found by the moved story snapshot, which was never
regenerated — the bytes are React's and Vue was made to match them.

### What stays React-only, and why

`Ui.stories.react.tsx` — the UI-kit page, eleven stories over the presentational leaves. It drives
no editor, so running it twice would pin React's own JSX rather than an adapter rule. Its snapshots
stay in `stories.react.spec.tsx.snap`.

`boundary.spec.ts` keeps its own node project and now scans both paints. Its store-hook rule is
NARROWED rather than dropped: a `useMarkput` selector that takes no store is the Vue bridge above
and is allowed; one that takes a parameter is not, which is exactly the destructure the member grep
cannot see. All four of its rules were mutation-checked, each reddening its own case and no other.

### Corrections from the review round (2026-08-28)

- **Its glob could not see a `.vue` file.** `./**/*.{ts,tsx}` scanned the Vue paint by accident of
  spelling — it is written as `.vue.ts` modules — so a single-file component, the ordinary Vue
  spelling, escaped all six rules. Measured: a `notion/ui/Probe.vue` with a deep `@markput/core/src`
  import AND an `s.tokens` reach passed 6/6. Widened to `{ts,tsx,vue}`, where the same file reddens
  two rules.
- **`caret.spec.ts`'s five no-argument mounts moved silently.** `mountControlled`'s
  `value: string = APOLLO_DOC` default turned five uncontrolled mounts into controlled ones and
  moved the echo mirror's baseline from `''` to the whole document. The mode move is kept — a
  controlled caret is the harder path — but the default is gone and every call site names its own
  document, as `Notion.spec.ts` already did.
- **Vue's `RowProps` published `class` and `style`, and declaring them is what breaks them.** Both
  are FALLTHROUGH attributes, and Vue removes a declared key from `$attrs` — so a kind written as
  `defineProps<RowProps>()` painted neither `styles.Row` nor the drag opacity. They are off the
  type; `Base.fixtures.vue.ts` pins the key set against it.
- **`Container.vue` had the same `className`-overwrites-`class` defect `268feab1` fixed in
  `Row.vue`**, plus an undeclared second half: a `slotProps.container.class` key rode through the
  spread and left the host with THAT class alone, dropping `styles.Container`. Both fixed, and
  `Slots.spec.ts` pins the container case for both adapters.
- **The 34 kind-name re-exports came out of both option files** (`export {kinds}`), the React leaves
  stopped forking four vocabulary types, and `Chip`/`Callout` stopped disagreeing about an unknown
  tone. `initialsOf` and the avatar's name hash — byte-identical in the two `Avatar`s — moved to the
  vocabulary as `initialsOf`/`avatarTone`.

**A STATED COST rather than a taken one.** The sixteen leaf PAIRS still hold duplicated lines that
are not types: each keeps its own `TONE_CLASS` map, `CommentThread` its `DEFAULT_ACTIONS`,
`EffortBar` its clamp. Those cannot follow the two avatar readings into `vocabulary.ts`, because
every one of them names a class from `theme/notion.module.css` and the vocabulary's whole property
is that it imports NOTHING — the fence in `boundary.spec.ts` says so and reddens if it ever does. A
`notion/ui/leafShared.ts`, which may import the CSS module, would take them; it is not taken here
because the leaves are paint and the pass's claim is only that the DECLARATIONS are shared.
