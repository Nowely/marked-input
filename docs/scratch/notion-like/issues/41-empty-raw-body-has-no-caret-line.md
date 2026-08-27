# A raw body that is empty paints no caret line, so a fence chosen from the menu cannot be typed in

Type: task
Status: needs-triage
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
