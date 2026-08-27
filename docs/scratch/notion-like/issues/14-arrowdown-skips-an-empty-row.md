# ArrowDown still skips an empty row, because the line box has a height and no width

Type: task
Status: resolved — the caret's own visit was the cause, not the direction (2026-08-27)
Blocked by: —

## Problem

Round eleven gave an empty row a line box so the arrow keys would stop on it, and measured the fix
in one direction only. `insights.md:327-329`:

> **3. ArrowDown over an empty row.** The round-eleven line box exists and is zero-width
> (`display: inline-block, height: 16px, 1 client rect`), so upward traversal finds it and
> downward traversal falls through.

The reported gesture was upward and is fixed: `map.md:1180-1181`, *"With rows `one`, ``, `three`,
``, `# head`, ``, `six`, `end`, ArrowUp visited 7, 6, 4, 2, 0"* — measured with no editor in the
page, so it is the platform's rule and not one this editor introduced.

Verified at `52ef65ae`, `packages/core/styles.module.css:133-136`:

    .Row > span:first-child:empty:not([contenteditable]):is(:last-child, :has(+ span:last-child:empty)) {
    	display: inline-block;
    	min-height: 1em;
    }

`min-height` and no width, exactly as the record says.

`insights.md:284-293` files this under the one methodological rule the effort would add —
**measure the mirror gesture** — with three other instances that each cost a round or more.

Also flagged in the CSS's own comment (`styles.module.css:128-132`) and NOT part of this ticket: a
kind that paints furniture ahead of an empty body — the showcase's divider — keeps the platform's
answer deliberately, because giving it the caret's line would grow a shipped kind by a whole line
without its consumer asking.

## Why it matters here

A blank line a user just made with two Enters can be clicked into and not arrowed into. It is the
last of the four "arrows skip empty rows" reports that has survived three attempts
(`insights.md:331-332`).

## Cost

`insights.md:330-331`: *"a CSS measurement with no editor in the page, both directions, and a pin
per direction. Cheap."*

## Answer

The measurement the cost line asked for was taken first, and it **refuted the diagnosis**. With no
editor in the page, a plain `contenteditable` of `one`, ``, `three`, ``, `five` where the empty row's
span carries the round-eleven rule:

    display: inline-block; min-height: 1em    ArrowDown 1,2,3,4    ArrowUp 3,2,1,0
    no rule at all                            ArrowDown 2,4        ArrowUp 2,0
    the rule plus min-width: 1px              ArrowDown 1,2,3,4    ArrowUp 3,2,1,0

The line box is not direction-asymmetric and never was: it works both ways, and width has nothing to
do with it. So the record's *"upward traversal finds it and downward traversal falls through"* is
wrong about the mechanism, though the report it came from was real.

**What is real:** the same markup with ONE zero-length `Text` node inside the span gives ArrowDown
2, 4 and ArrowUp 2, 0 — the unstyled answer — while the box is still `0x16`, the computed `display`
is still `inline-block` and `:empty` still matches it. And the editor put that node there.
`findTextBoundary` (`packages/core/src/features/tokens/dom/caret.ts`) appended an empty `Text` to any
surface it was asked to place a caret in, *"so freshly-mounted empty surfaces still accept a caret"*.

So the rule was never about direction. **A blank row is reachable until the caret has been in it,
and unreachable afterwards.** Driven in the editor, that is exactly what separates the two reports:
on `'one⏎⏎three'` parsed from a value, ArrowDown visits 1, 2 — but make the same document with Enter
and ArrowDown visits 2, 2, skipping the row the user just made. The two rows' DOM serialises
identically; the difference is a `Text` node of length 0 that no serialisation shows.

The fix is at the cause: an empty surface answers ITSELF as the caret boundary and stays childless.
`caretBoundary` already answered element boundaries for a token with no surface at all, so the
shape is not new. The whole suite is green with the append gone — 2247 tests, one of which had to be
rewritten because it pinned the append (`caret.spec.ts`, *"creates a fallback text node when the
surface is empty"*).

Pins in `Base/caret.spec.ts`, framework-free so both adapters run them:

- *"is reached by the arrow key that walks DOWN past it"* — the mirror of the round-eleven ladder,
  which was pinned upward only. It reddens when the CSS rule is removed:
  `expected [ 2, 4, 6, 7, 7, 7, 7 ] to deeply equal [ 1, 2, 3, 4, 5, 6, 7 ]`.
- *"is reached by an arrow after the caret has already been in it"* — the defect itself. Restoring
  the append reddens it in both frameworks with `expected 2 to be 1`.

The platform measurement is NOT shipped as a test: it measures Chromium rather than markput, which
is the reason `258e2149` deleted the atomicity probe. It lives in the CSS rule's own comment, beside
the constraint it creates — the surface has to stay childless for the line box to hold.

**Behaviour change:** a caret placed in an empty surface no longer adds a `Text` node to the DOM, so
an empty row stays arrow-reachable after being visited. The caret's DOM boundary in an empty surface
is now `(surface, 0)` rather than `(a fresh empty Text, 0)`, which is observable to a consumer
reading `window.getSelection()` and to anything comparing the painted DOM.

Still not reached, unchanged and still flagged in the CSS: a kind that paints furniture ahead of an
empty body — the showcase's divider — keeps the platform's answer deliberately.
