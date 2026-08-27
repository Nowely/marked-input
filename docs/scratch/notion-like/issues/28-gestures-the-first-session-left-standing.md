# Four gestures the first driving session reported that no commit since names

Type: task
Status: needs-triage — 1 and 3 answered, 2 refuted and its neighbour fixed, 4 still open
Blocked by: —

> `outcome.md:491-497` lists what the first session's "thirteen things felt wrong" left standing
> after the amendments. This ticket carries the four that are still open and are not covered by a
> ticket of their own; the fifth on that list — a row selection painted as a text selection — is
> **done** (`36404009`, `.RowSelected::after`), and the sixth and seventh are
> [21](21-table-gestures.md) and [27](27-four-missing-affordances.md).

## Problem

**1. The first Cmd+A selects the entire document** — *"one keystroke from wiping everything"*
(`outcome.md:478`). Verified at `52ef65ae`: `packages/core/src/features/keyboard/input.ts:80-84`
answers Mod+A with `widenRowScope(store)` first and `selection.selectAll()` otherwise, and
`widenRowScope` (`rowKeys.ts:252-257`) only widens *"while a row selection stands inside a NESTED
row"*. From a plain caret — the state a user is in — the first press takes the whole value.

**2. Backspace at the start of the row after an atomic block is a total no-op**
(`outcome.md:479`). Reported, not re-measured here.

**3. Nesting is a one-way door for a root paragraph.** `outcome.md:307-312`: 7 of the showcase's 26
kinds declare `indents`, so Tab never leaves the field there, and *"A ROOT paragraph has no parent
to inherit from, so a paragraph outdented to depth 0 cannot be indented again"* — the key is
consumed and nothing moves, which is [29](29-refusal-is-silent.md)'s shape.

**4. Undo granularity is uneven.** `outcome.md:480-482`: *"57 undos to unwind ~30 gestures,
splitting mid-word"* — while the same session's 57 undos landed byte-exact on the original and 57
redos byte-exact on the driver's version, which is the strongest single result in the record.
Correctness is not in question; the step SIZE is.

## Why it matters here

Each is a first-hour gesture with a known reading and no owner. 1 and 4 are the two a user can lose
work to.

## Shape of a fix, per item

1. A rung below select-all for the plain-caret case — Notion escalates block → document — or a
   deliberate "no, one press takes the value" with the reason written down.
2. Needs re-measuring before it is costed; it is likely the same "a row that holds no editable
   position" class rounds 4–11 chased.
3. Decide what Tab means at depth 0: release the key to the browser (ADR-0002's original bargain,
   which the editor-level `indents` answer took away) or say nothing and stay silent.
4. An undo step wants a policy — per word, per gesture, per commit window — and `HistoryModel` is
   where it would live.

## Re-driven 2026-08-27 (T-D), item by item

Every one was measured against the code as it stands, not taken from the report.

**1. Mod+A — ANSWERED, and by a deletion.** `918735d2`. Esc and Mod+A both ask the tree for one
level wider and each spelled the question itself; the spellings had drifted, which is the whole
defect: Esc entered a row selection from a plain caret and Mod+A did not, so with nothing selected
its rung declined and the first press took the entire value. The two spellings are now ONE function
and the keys differ only in where they stop. Mod+A takes the caret's row, then the row that one is
nested in, then the document. An inline editor is untouched: the rung declines where there are no
rows, and `input.spec`'s own inline case says so. Declared behaviour change; three existing cases
carried the old ladder and now carry the new one.

**2. Backspace after an atomic row — REFUTED as reported, and a neighbour of it was real.**
Measured at `1fa7a6e6~`: `'before⏎@card panel⏎after'` with the caret at the start of `after`,
Backspace emits `'before⏎@card panelafter'` — an ordinary merge, whether or not the card's kind
paints a body surface. It is not a no-op and has not been one for a long time. The report is three
hundred commits old and nothing since names it because nothing since has had to.

What IS a total no-op is the same key across a RAW CLOSED body, which the session could plausibly
have hit and described this way. `'```js⏎code⏎```⏎plain'` with the caret at the start of `plain`
cancelled the key and wrote an EMPTY replacement over an EMPTY span: the boundary's low edge is the
fence's closing literal, which is markup with no anchor on it, so `anchorAt` answered the row's own
end and the pair collapsed. The value never moved, which is right — there is no merge to offer
across such a boundary, and the forward direction already refused it properly — but the write took
an UNDO STEP for an edit nobody made, so the Mod+Z after it appeared to do nothing too. Fixed in
`2cd50c8d`, and the key now reaches the refusal channel and says it declined.

**3. Nesting is a one-way door — ANSWERED by [29](29-refusal-is-silent.md).** The rule is
unchanged and correct: `indents` gates the KEY once per editor (ADR-0002, and it is what makes the
keyboard and the DROP agree), while which row may actually go deeper is the verb's. A root
paragraph under Shift+Tab still consumes the key and does not move — and now paints a refusal
saying so, which is the whole of what "a dead key" meant. Releasing the key to the browser instead
was NOT taken: it is the split ADR-0002 measured as a defect, where Tab indents on one row and
moves focus on the next.

**4. Undo granularity — STILL OPEN, and it now has one measured cause and one honest bound.**
`2cd50c8d` removed a class of step that was pure noise: a refused Backspace at a raw-body boundary
occupied an entry, so a user unwinding that gesture spent two undos where the document moved once.
How much of "57 undos to unwind ~30 gestures" that class accounts for is unmeasured, and the rest
is a POLICY question rather than a defect — the same session's 57 undos landed byte-exact on the
original and 57 redos byte-exact on the driver's version, which is the strongest single result in
the record and is what any coalescing rule has to keep. `HistoryModel` is where a policy would
live; the next step is to re-drive the count against the current stack, not to design one.
