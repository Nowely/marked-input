# An overlay can only insert its own option's markup, and its data is `string[]`

Type: task
Status: resolved — P7 puts the menu in core (2026-08-25)
Blocked by: —

## Problem

Two limits in the overlay contract, both hit by the same slash menu.

**One trigger, one markup.** `select()` writes the markup of the option that
carries the trigger:

    this.edit.replace(match.range.anchor, match.range.head, annotate(markup, {value, meta}))
    — packages/core/src/features/overlay/OverlayController.ts:169-176

A block menu offers heading, list, quote, code and table — five markups behind
one `/`. It cannot express any of them through `select()`, so the probe's menu
reaches past it and calls `store.edit.replace` itself
(`packages/storybook/src/pages/Notion/components/SlashMenu.tsx`). That works,
and it means the overlay's own accept path is unusable for the single most
common editor gesture.

**And the span it replaces is the caret's, not the row's.** Both behaviours are
pinned in `packages/storybook/src/pages/Notion/Notion.react.spec.tsx`:

    empty row  → '/' + Heading 1 → 'Intro paragraph\n\n# '        ✅ Notion's gesture
    row with text → same → 'Intro paragraph\n\nplain row# '       ❌ heading mid-row

So "turn this block into a heading" — Notion's other slash gesture, on a row that
already has text — has no expression: the menu can only write where the caret
is. A consumer could reach the row through `store.tokens` and replace its
leading span, but nothing in the overlay contract offers it.

**Suggestions carry no identity.** `overlay.data` is `string[]`
(`packages/react/markput/src/types.ts:33`), and `filterSuggestions(data, search)`
takes and returns strings
(`packages/core/src/features/overlay/filterSuggestions.ts:1-4`). A mention needs
an id beside the label — the `__meta__` half of `@[__value__](__meta__)` — so
any suggestion list with an identity behind it drops the built-in path and
writes its own component.

## Why it matters here

These are the two overlays every Notion-shaped editor has. Neither can use the
machinery as declared, and both fall back to the same escape hatch.

## Sketch, not a decision

For the first: let `select()` take a markup (or an option index) instead of
implying one. For the second: let `data` be `Array<string | {value, meta}>`, so
the built-in list can carry the id it already has to write.

## Answer

Resolved by P7. All three limits, and each one at the layer that owned it.

**One trigger, one markup** → `CoreOption.menu`. An option that declares a `MenuSpec` is in
`overlay.entries`, filtered by what was typed after the trigger; presence is the whole
registration, so no list of kinds exists anywhere and no component filters one. `choose` gained an
`option` arm — `choose({option})` — beside the value arm it already had, so the accept path is
still one path.

**The span it replaces** → the ROW's, not the caret's. `choose({option})` resolves the caret's row,
cuts the trigger span out of that row's body (`tree/slotWithout`, so the arithmetic stays in the
tree layer under ADR-0003) and calls `RowNode.turnInto(option, {text})`. ONE splice: two verbs
cannot compose in controlled mode, where the tree has not moved when the first returns. The pin
this ticket named is inverted rather than deleted —
`Notion.react.spec.tsx`'s "converts a row that already has text into the chosen kind" now asserts
`'Intro paragraph\n\n# plain row'`, and the old `'plain row# '` fails it. `overlay.mode` names
which gesture it is (`'insert'` on a row holding only the trigger, `'turnInto'` on a row with
text) for a menu's own labelling; it changes nothing about what `choose` does, and both readings
come from one private target read so the label and the write cannot disagree.

**Suggestions carry no identity** → `overlay.data` widened from `string[]` to
`readonly Suggestion[]`, where a `Suggestion` is a string or `{value, meta?, label?}`. Filtering
matches the LABEL only, so an id the user cannot see never matches a query, and a bare string
still writes its index as meta.

Measured, not argued: the probe's two hand-written overlays are DELETED. `SlashMenu.tsx` (60
lines, a list of nine markdown strings plus `store.edit.replace`) and `MentionOverlay.tsx` (54
lines, its own filter plus `select({value, meta})`) are gone; `/` is the adapters' new `BlockMenu`
and `@` is the built-in Suggestions over `data`. The showcase's menu component contains no
filtering and no insert logic because there is no showcase menu component.

The sketch is answered in both halves, and the first by neither of its two spellings: `select()`
does not take a markup and does not take an option index — `choose` takes the OPTION, which
`turnInto` resolves to a compiled row kind by markup, and declines when this editor compiled none.
