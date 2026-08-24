# An overlay can only insert its own option's markup, and its data is `string[]`

Type: task
Status: needs-triage
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
