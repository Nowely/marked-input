# An atomic row leaves the caret nowhere to go, and nothing can ask for the row after

Type: task
Status: resolved — the invariant moved off the caret and onto the document's last row (2026-08-27)
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

## Answer

**The editor guarantees the trailing row**, and the rule moved off the caret. `#keepTailEnterable`
asked its question of the CARET'S row, which is why it could only ever answer the raw-body half: an
atomic row holds no position at all, so no caret can be in one to provoke it. `#settleTail` asks the
DOCUMENT'S LAST row instead, and both traps answer the same test — a raw closed body, and a row
whose entry no caret may reach.

`#recoverCaret`'s own opening arm came out with it. The two were one rule written twice, and the
second copy fired only for a caret already stranded. Measured rather than argued (doctrine A.1):
removed alone at `94ecfd19`'s parent it reddens three browser pins — *"opens a row after an atomic
block that ends the document"*, *"opens a row after a raw-bodied block that ends the document"* and
*"undoes and redoes the whole gesture that made a code block and typed in it"*; removed beside
`#settleTail` it reddens nothing.

### The three questions the decision was bounded by

- **When does it fire?** On the caret invariant's own clock, one microtask past a commit or an
  element registration, and only while the document's last row is PAINTED. `'absent'` is a frame
  that has not reached the row and stands down; `'boxless'` is a collapsed room, where the door
  would be one nobody can see and the value would grow on every pass.
- **Does a value merely HANDED to the editor get rewritten on mount?** No, and deliberately — the
  existing rule is kept. It fires only while someone is IN the document, which is `#settleRows`'
  gate and its reason. A SELECTION counts and not only a caret, which is what closes the one-row
  document: the only gesture such a document takes is a click, and a click on frozen presentation
  writes a row selection. Pinned by *"leaves a document nobody is standing in alone"*.
- **Does the row survive an undo as one step?** It is not a step at all. Every write the invariant
  makes carries `EditRecord.repair`, so the row folds into the edit that provoked it and ONE press
  takes back both — the rule `HistoryModel.spec` already pins for the fence, now pinned for the
  atomic row too (*"folds the row it opens into the edit that provoked it"*).

### The three items that hang off this one

1. **The dead end at the end of the document** — DISSOLVED. Both halves are now one rule, and the
   atomic half no longer needs a caret to be stranded in the trap first.
2. **`Code`'s missing seed** — NOT dissolved, and it is a different hole. A fence's body IS
   reachable; what it lacks is a caret LINE when its body is empty, because an empty body paints a
   `<span></span>` the showcase's line-box selector cannot match. That is a paint question in the
   showcase's own theme, not a tree one, and this rule cannot see it: the row is painted and its
   entry is reachable, so there is nothing for the invariant to repair.
3. **No verb names a caret** — NOT dissolved, and it is now smaller rather than gone. The trailing
   row removes the reason `choose` needed an insert-after contract, which is what the fork was
   about; what stays open is the option API's own gap — there is still no insert-ABOVE verb, and
   `addSibling` still names no caret. `RowNode.writeRows` now names one (see
   [19](19-mid-body-split-loses-the-caret.md)), so the primitive exists where a verb wants it.

**Behaviour change:** a document ending in an atomic row grows a blank row under it as soon as
anyone is in the document; a one-row atomic document gains a caret target where it had none at all.
The raw-body arm writes the same bytes it always did but no longer waits for the caret to be inside
the trap.
