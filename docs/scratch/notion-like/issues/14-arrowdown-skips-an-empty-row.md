# ArrowDown still skips an empty row, because the line box has a height and no width

Type: task
Status: ready-for-agent
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
