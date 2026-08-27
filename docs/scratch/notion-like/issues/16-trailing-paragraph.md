# An atomic row leaves the caret nowhere to go, and nothing can ask for the row after

Type: task
Status: ready-for-human
Blocked by: —

## Problem

`outcome.md`'s item 3, and its top open DECLARED item:

> **An atomic kind leaves the caret nowhere to go.** `choose` turns THIS ROW into the kind and an
> atomic row generates no caret position, so nothing a consumer can write asks for the trailing
> empty paragraph Notion leaves under such a block. On a one-row document the editor has no caret
> target at all. Declared in the showcase's own docblock. **AMENDED 2026-08-26**: what a CLICK on
> such a row does is decided now — nothing moves, and where the editor holds no caret at all the
> DOM selection is dropped and the editing host gives up focus, so the click is inert rather than
> stranding. The hole itself is untouched: there is still no way to ask for the row after.

**Three other open items dissolve into this one and are deliberately not filed separately.**

1. *The dead end at the end of the document.* `outcome.md`'s driving item 5 — *"After `/code` at
   the end, ArrowDown, Enter and clicking below all fail to make a row after it"* — is **half
   closed** (`9c781d4a`): a document ending in a RAW CLOSED BODY grows a blank row while the caret
   is in it (`TokenModel.#keepTailEnterable`). An atomic row that is not a raw body still traps,
   *"and that is item 3 of the list above: it wants the trailing-paragraph decision, not a patch"*.
2. *`Code`'s missing seed.* `insights.md:68-78` measures **24 menu entries, 8 carrying `text:`**,
   with `Code` not among them (`options.tsx:362`), and says the class was misnamed: *"A fence is
   not atomic — its body IS reachable and reads as ordinary content — but its EMPTY body paints a
   `<span></span>` behind the `<select>`, which the round-eleven line-box selector cannot match, so
   nothing gives it a caret line."* `insights.md:350-351` ties it back: *"item 4 of the DX list
   (`Code`'s missing seed) is the same hole seen from the option API's side."*
3. *No verb names a caret.* `map.md:1211-1217`, judged correct as it stands and recorded as the
   option API's gap: the table footer's `+ New` is `node.turnInto(tableLine, {text: '\n|+ ' +
   slot})`, an insert-above expressed through a turn-THIS-row verb, *"`addSibling` opens BELOW,
   there is no insert-above verb, and no published way to say 'put the caret in the row I just
   made'."*

## Why it matters here

It is the decision every repair since has walked around. `outcome.md:550-553`: *"Ranks third
because the driving session's item 5 dissolves into it entirely — the `Empty` story's 'no caret
target at all' is the same hole — and because it is a published-contract change that should be
decided once rather than patched twice."* `insights.md:344-347` re-ranks it fifth only because
three cheaper first-minute defects (tickets 12–15) landed above it, and calls it *"unchanged as
`outcome.md`'s top open DECLARED item"*, surviving four rounds of being walked around.

## The decision, not the task

`outcome.md:551-553` and `insights.md:348-351` state the fork the same way both times: **either the
editor guarantees a trailing empty row, or `choose` gains an insert-after contract beside its
turn-into one.** The closest anything has come to an answer is the click claim's *"a row with no
position is inert"* — which decides what a pointer does and not where a caret may be asked for.

Whatever is chosen has to answer all three faces above, or it is the fourth patch around the hole.
