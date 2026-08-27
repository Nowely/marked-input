# Four gestures the first driving session reported that no commit since names

Type: task
Status: resolved — 1 and 3 answered, 2 refuted and its neighbour fixed, 4 re-driven, narrowed to deletions and then paid
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

**4. Undo granularity — RE-DRIVEN 2026-08-27 in review, and the reported symptom is REFUTED.**
The re-drive the section below said was the next step was not done in the pass itself; it is done
now, against the current stack, driving real `beforeinput` and `keydown` through a mounted store:

```
type 'hello'                                   → 1 undo
type 'undoubtedly'  (eleven characters)        → 1 undo
type 'hello', move the caret, type 'xy'        → 2 undos
type 'hello', Backspace, Backspace, type 'p'   → 4 undos
```

*"Splitting mid-word"* does NOT reproduce. A typing run of ANY length is one entry — the
eleven-character shape that used to come off in six presses is the defect `HistoryModel`'s
run-openness state already fixed, and a caret move correctly closes the run.

What is left is the fourth line: a DELETION does not coalesce. Each Backspace is its own entry, and
a typing run after one starts fresh — four gestures, four undos, where the same four as pure typing
would be one. That is the most plausible remaining source of *"57 undos to unwind ~30 gestures"*,
and it is a POLICY question with a name now rather than an unmeasured complaint.

The old text follows, and its first paragraph still holds:


`2cd50c8d` removed a class of step that was pure noise: a refused Backspace at a raw-body boundary
occupied an entry, so a user unwinding that gesture spent two undos where the document moved once.
How much of "57 undos to unwind ~30 gestures" that class accounts for is unmeasured, and the rest
is a POLICY question rather than a defect — the same session's 57 undos landed byte-exact on the
original and 57 redos byte-exact on the driver's version, which is the strongest single result in
the record and is what any coalescing rule has to keep. `HistoryModel` is where a policy would
live; the next step is to re-drive the count against the current stack, not to design one.


## Item 4, closed 2026-08-27 (T-E)

The residual — *"a DELETION does not coalesce"* — was ADR-0012's own cost (f), which named the shape
of the answer and declined to build it: *"a deletion run is a rule of its own if someone wants it,
not a bug in this one."* Somebody wanted it. `HistoryModel.deletedTogether` is that rule, written to
the same shape as the typing one and recognised from the records the same way: two pure deletions,
the second one character wide, adjoining the first's span in a document the first left behind.

Both keys are ONE arithmetic rather than a direction flag. Backspace grows the span down from its
low edge (`next.end === previous.start`); Delete holds the caret still and grows it up from its high
edge, which is the same start offset every time (`next.start === previous.start`). Exactly one of
the two can hold, since both would need a zero-width deletion.

Two things the rule has to refuse, and both are pinned:

- **a whole-span delete does not open a run.** A selection delete IS a pure removal of a span, which
  is what a growing run looks like — the timestamp gate is what tells them apart, and it is the same
  guard that keeps a keystroke out of the paste before it. Without it, one Backspace after deleting
  a selection would take the selection back with it.
- **a delete run and a typing run never join.** Their composition is a REPLACEMENT rather than a
  splice of one shape, and a person fixing a word means two presses by "undo that": give me back the
  letters I removed, and take away the ones I typed.

The re-driven table at the top of this section now reads:

```
type 'hello'                                   → 1 undo
type 'undoubtedly'  (eleven characters)        → 1 undo
type 'hello', move the caret, type 'xy'        → 2 undos
type 'hello', Backspace, Backspace, type 'p'   → 3 undos   (was 4)
```

The last line is the whole of what changed: the two Backspaces are one entry now. It does not go to
2, and that is the second refusal above rather than an unfinished job.

ADR-0012's cost (f) is struck through and answered in place. `HistoryModel.spec`'s
'gives every Backspace its own step' pinned the OLD behaviour and is replaced by four cases; every
one of them was seen to redden against a mutant of the clause it pins.
