# A raw body that is empty paints no caret line, so a fence chosen from the menu cannot be typed in

Type: task
Status: needs-triage — measured 2026-08-27; HALF the premise is refuted and the owner is the theme
Blocked by: —

## Problem

Split out of [16](16-trailing-paragraph.md) on 2026-08-27. It was one of that ticket's "three items
that hang off this one", was explicitly judged NOT dissolved, and was then carried inside a record
marked `resolved` — so it left the tracker. `grep -rln "missing seed" docs/scratch/notion-like/issues/`
found it in exactly one file, ticket 16's own. Neither 27 (four missing affordances) nor 21 (table
gestures) covers it.

`insights.md:68-78` measured the showcase's menu: **24 entries, 8 carrying `text:`**, with `Code`
not among them (`options.tsx:362`). The class was misnamed there and the correction is the ticket:

> A fence is not atomic — its body IS reachable and reads as ordinary content — but its EMPTY body
> paints a `<span></span>` behind the `<select>`, which the round-eleven line-box selector cannot
> match, so nothing gives it a caret line.

`insights.md:350-351` ties it to the option API: *"item 4 of the DX list (`Code`'s missing seed) is
the same hole seen from the option API's side."*

## Why 16 cannot answer it

Measured at `9b3d6ee8`: the row IS painted and its entry IS reachable, so `#settleTail` sees a tail
that needs no door and `#settleCaret` sees a caret position it is happy with. Nothing in the caret
invariant is wrong here. The row has a position; the BROWSER has no line box to put it on.

That makes it a paint question, and the two candidate owners are different layers:

- the showcase's own theme, which could give an empty raw body a zero-width line box; or
- the option API, which could let a kind declare a body SEED so `Code` is never chosen empty — the
  same fix as the 8 entries that already carry `text:`.

## What it is not

Not the trailing-row rule (16, resolved), and not the atomic-row class: an atomic kind paints none
of its text on purpose, while a fence paints all of it and happens to have none.


## Measured, 2026-08-27 (T-E)

Driven on the showcase, controlled, value `'intro⏎```bash⏎⏎```⏎tail'` — the empty fence the `/`
menu produces, written out — with a click at the centre of the fence's own box, which is where a
user aims:

```
the fence row's box            38px tall
its body surface               1 client rect, height 0
after the click                the caret is inside the row
after typing one character     'intro⏎```bash⏎Z⏎```⏎tail'
```

**Half the ticket is refuted.** The body is not unreachable and the click is not dead: the caret
lands in the row, the typed character goes into the fence's body, and the value is exactly right.
Whatever else is wrong here, nothing is lost and no gesture fails.

**The other half stands, and it is a paint.** The body surface has a client rect of ZERO HEIGHT, so
the browser draws a zero-height caret — there is nothing on screen saying where the next character
will go, inside a 38px box whose height comes entirely from the language `<select>` beside it. That
is what "paints no caret line" is: not an unreachable position, an invisible one.

## Which owner, decided by the measurement

**The theme's**, and the option API's `text:` seed is not the answer. A seed makes the fence
non-empty at the moment the menu creates it and does nothing the first time the user clears it,
which is the same state one Backspace away. The zero height comes from the row's own box: the
surface is an inline child beside a `<select>`, and an empty inline child of that layout takes no
line height from it.

So the fix is a rule in `packages/storybook/src/pages/Notion/notion/theme/` giving an empty raw
body a line box of its own — `min-height: 1lh` on the surface, or `::after {content: ''}` — and this
pass may not touch that directory. It is a two-line change with no core involvement, and the pin it
wants is `getClientRects()[0].height > 0` on the body surface of an empty fence, which is the
reading above with the assertion turned round.

Worth checking when it is taken: whether any other kind in the showcase lays its body out beside a
control the same way, since the rule is about the LAYOUT and not about `code`.
