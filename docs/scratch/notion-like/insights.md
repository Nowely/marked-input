# What this effort learned

> Written 2026-08-27 at `272e0d86`, with round eleven's fixes and the coverage audit's two tests
> still in the working tree (13 files, +523/−24, nothing untracked). `outcome.md` says what was
> built and what is open; this says what the record is worth to whoever goes next.
>
> Read for it: `map.md` (1182 lines), `spec.md`, `showcase.md`, `doctrine.md`, `outcome.md`,
> ADRs 0010–0012, and the commits — **301** over `1235da9a..HEAD`, **307 files, +35 508/−5 667**
> across `packages/`, `docs/` and `CONTEXT.md` (measured today; `outcome.md`'s 240 was measured at
> `c6b681ce`). Every number below is measured here unless it is attributed to a record, and where I
> did not measure I say so instead of rounding it into a claim.

---

## DX — what a consumer of this library meets

`boundary.spec.ts` is the best evidence in the repo, and it is a grep. Every time it refused, the
answer was a piece of **published API**, never a workaround — and the scar tissue is visible in the
adapters' own barrels: `packages/react/markput/index.ts` and its Vue twin each carry **four**
re-export comments of the form *"without this a consumer of the published package cannot name X"*
(`watch`, `MarkToken`, `RowSpec`, `MenuSpec`/`OverlayRow`, `Suggestion`, `OverlayPick`,
`RowPlacement`). None of those was designed. Each was extracted by a test that would not let the
showcase reach past the adapter.

What follows is not that list. It is the list of things a consumer must **remember**, where
forgetting is silent. That is what makes it a DX list rather than a bug list.

**1. A row kind's component must render the `rows` prop, or its child rows leave the screen and
stay in the value.** Declared as ADR-0011's cost (d) and repeated in `RowProps.rows`. Measured at
the time: pick Heading 3 on a bulleted parent and both nested bullets go off screen while the value
keeps them, reachable only by undo.
**Honest fix: core, and core now does it.** `TokenModel.#settleRows` (`TokenModel.ts:1443`) finds
the first row whose children have nowhere to be painted and lifts them one level, in the same undo
step as the write that produced the shape. It can only live there — *whether a kind paints child
rows is a DOM fact, and a retype's destination kind has no DOM until the frame after it*, so the
check cannot precede the write. Types cannot help at all: core cannot see whether a component reads
a prop. What is still on the consumer: a value merely HANDED to the editor is left alone, on
purpose, because rewriting a consumer's own bytes on mount emits an edit nobody made.

**2. A row kind's component must spread `ref`, `className` and `style` onto one element.** All
three are declared `?:` optional in `RowProps` (`packages/react/markput/src/types.ts:60-62`), so
dropping any of them type-checks. The doc comment is the whole enforcement. The costs are all
silent and all different: drop `ref` and the row is unbound, so the caret cannot resolve into it;
drop `className` and you lose `.Row`'s `position: relative` — which is the containing block
`.RowSelected::after` needs, so the editor's row-selection overlay stops painting — plus the
`.Row >`-scoped empty-row line-box rule (`styles.module.css:133`) and `outline: none`, which puts
the UA focus ring back.
**Honest fix: core, as a dev diagnostic — not types.** A required prop cannot force a spread onto
an element, and making them non-optional only moves the mistake into `{...props}`. Core already
owns the right channel and the right doctrine for this: `reportBadProp` refuses and carries on at
the props boundary (doctrine A.7, censused over 13 bad prop values), and `bind` already knows that
~~a consigned row id received no element~~. Proposal, not a decision: **one `reportBadProp` when a
mounted row's consignment is never called.** Nothing like it exists today — `console.error` appears
in core exactly once outside a bench, in `reportBadProp` itself.
**Taken 2026-08-27, ticket 23**, for `ref` alone — and NOT from `bind`, which is where the sentence
above is wrong: that walk runs on the COMMIT, a frame before the paint, so a row unconsigned there
is the ordinary case of an element that has not arrived yet. Each adapter calls
`TokenModel.rowPainted` from the hook that runs once refs have attached. `className` and `style`
get no diagnostic: their loss is a row that looks wrong, this one is a row the editor cannot use.

**3. A control a kind paints must call `useControlRef()`, or it is document content.** P11 shipped
believing atomicity was automatic; measured, **four of the seven** atomic kinds had no control root,
and a click or an ArrowDown parked a blinking caret inside a properties grid where every keystroke
was swallowed. The showcase carries **11** `useControlRef()` calls behind one hand-written `Atomic`
wrapper.
**Honest fix: docs — and one shipped component.** Core cannot infer it: a `<select>` inside a
contenteditable is a legitimate thing to edit, which is exactly why `KEYBOARD_OWNERS` exists
(`SelectionDriver.ts:327`). The gap that IS ours is that every consumer writes `Atomic` themselves.
It is six lines and the showcase proved the shape; shipping it beside `useControlRef` costs one
export and deletes a class of "I forgot on one of the seven".
**Shipped 2026-08-27, ticket 24**: `Atomic` from `@markput/react`, with the showcase's own copy
deleted so the shape has one home. No Vue twin — that adapter publishes no `useControlRef` at all,
which is P12's gap (ticket 26).

**4. An option whose body a keystroke cannot reach must seed it, and "atomic" was the wrong word for
that class.** The rule as written is *an atomic kind's `/` entry must carry `menu.text`*, and the
seeding sweep applied it to the seven atomic kinds. Measured today: **24 menu entries, 8 carry
`text:`** — and `Code` is not one of them (`options.tsx:362`, `{label: 'Code', keywords: […],
meta: 'bash'}`). A fence is not atomic — its body IS reachable and reads as ordinary content — but
its EMPTY body paints a `<span></span>` behind the `<select>`, which the round-eleven line-box
selector cannot match, so nothing gives it a caret line. The final driving session hit it as
`/` → Code → type putting the code in a paragraph *below* the fence.
**Honest fix: core.** "An empty body with no caret line" is a state core can detect — it already
detects the neighbouring one (`#keepTailEnterable` grows a blank row after a document-final raw
body). The consumer-side half is a docs line; the class is core's, and calling it *atomic* is what
let one kind out of the sweep.

**5. Two row kinds must not share an opener PREFIX ~~when either has a raw body~~ — and nothing
checks it.** **Corrected 2026-08-27, ticket 15**: the recorded condition was wrong twice over.
Rawness decides nothing (`__slot__` and `__value__` collapse identically), and "either" is too wide
— longest-first already protects the pair whose SHORTER opener is the closed one. The rule that
holds is *no kind whose body closes at its own literal may extend another kind's opener*, and it is
`shadowedRowKinds` (`471d626b`). `usableOptions` (`TokenModel.ts:1928`) rejects a **duplicate**
opener by exact string equality. The standing rule is strictly wider, and the failure is total and silent: the showcase's
`properties` was `'---\n__value__\n---'` against a `'---__slot__'` divider, and one **Divider**
click from the `/` menu took the page from **36 rows to 3**, every row between the two rules
swallowed into one panel the caret could not enter. The text survived in the value; nothing on the
screen did. `spec.md`'s risk 8 records that its own mitigation was falsified twice.
**Honest fix: core.** The rule is decidable from the markup array alone, at the same place the
duplicate check already runs, at the same cost. This is the only item on this list whose failure
mode is unbounded document loss, and it is currently guarded by a browser spec that counts rows
after adding a divider — a pin for one instance of a rule that has none.

**6. The obvious store selector does not compile.** `useMarkput(s => s.rows)` fails with
*"Index signature for type 'string' is missing"*; the working spelling is
`useMarkput(s => ({rows: s.rows}))`, which is what the adapter's own `useOverlay` does. Ticket 10,
filed by the probe on day one, still open.
**Honest fix: types.** Either the selector overload admits a non-reactive value and returns it
as-is, or `ObjectSelector` admits an arbitrary object. The docs option is cheapest and is the wrong
one — it explains the puzzle instead of removing it, and the error message names index signatures
rather than the rule.

**7. `Store` is published from `@markput/core` and from neither adapter.** Measured:
`export {Store}` has exactly one hit, `packages/core/index.ts:4`. A consumer who types a selector
adds a second dependency to name it. Ticket 03's open half.
**Honest fix: one barrel line**, in each adapter, for the same reason the other four re-exports
carry.

**8. Two published types are wrong at the boundary.** `OverlayHandler.ref` is
`RefObject<HTMLElement | null>`, unassignable to any concrete element ref — the repo works around it
in two places and the docs cast in eight. `MarkedInputProps.Span` is `ComponentType<MarkProps>`, but
a Span component is handed a `ref` that `MarkProps` does not declare.
**Honest fix: types, and it is a decision rather than a task** — both are published corrections, so
they want a maintainer's yes rather than an afternoon.

**The pattern under 1–4.** Every one is *core cannot see what a component does with a prop*. Three
different answers were tried across the effort and only one held: a refusal (`indentRows`,
`moveTo` — works, because the would-be parent is on screen to be asked BEFORE anything happens); a
convention (P11's atomic kinds — failed, four of seven); and a **repair after the write, folded into
the same undo step** (`#settleRows` — works, and is the only one that survives a paste and a replay).
That ordering is the transferable part: at a consumer boundary, ask if you can, repair if you
cannot, and never rely on the consumer remembering.

---

## UX — what eleven sessions felt

Only two sessions' unedited text survives in the repo: `outcome.md`'s "What it is like to use" and
the final report. The other nine were distilled into defect lists in `map.md`, so what follows is
what those two said, with the distillations used only to corroborate.

**Three things both surviving reports praised, with their measurements.**

1. **Undo.** Session one: 57 undos took a ~30-gesture document back byte-exact and 57 redos put it
   back byte-exact. The final session, on a different document: **51 steps back from 607 characters
   to `''`, including the `/title` menu keystroke, then 51 redos returning byte-identical.** Two
   independent drivers, two documents, and it is the strongest single number this effort produced.
   It is also the one thing that was designed by measurement before it was designed by argument —
   ADR-0012 measured that a `setValue`-shaped undo re-pairs rows by index and hands row `a`'s node
   the text `b` had, before `invertWindow` existed.
2. **Keyboard-first authoring.** *"Writing the page from an empty row was genuinely pleasant"* —
   the `/` menu, nesting, mentions, carved cells. Note what that sentence is: a verdict on the
   gestures that were fixed by DRIVING (rounds one through eleven), not on the ones that were
   specified.
3. **The document model.** Both reports reach it from different directions — session one's
   "the document model is good and the editing experience is not", the final one's ship-as-a-
   keyboard-editor verdict. One value string is the truth, and drag, copy, undo and round-trip all
   fall out of it rather than being implemented.

**Four rough edges nobody filed and everybody felt.**

1. **Refusal is silent.** The editor has exactly one visible refusal: the drop indicator, which
   *promises rather than predicts* — a depth the mover would refuse is never painted. Everything
   else refuses without saying so. A typed character over a row that holds no editable position is
   *"CONSUMED AND REFUSED"* (round nine, and it is the right call — `false` falls through to the
   text path and deletes the row by another door). Shift+Enter inside a carved cell is *"consumed
   and doing nothing"*. Tab is consumed by every row in an editor where any kind declares `indents`
   — **7 of the showcase's 26** — so a root paragraph outdented to depth 0 presses a dead key. And
   the final session's sharpest line is this edge in its strongest form: *"Painted highlight ≠ what
   a keystroke replaces, in both directions"* — a sweep into a fence paints 20 characters that
   survive typing (a correct clamp, an incomprehensible paint), and a sweep across a collapsed
   toggle eats two hidden lines that were never painted at all.
2. **One gesture, answers that depend on markup the user cannot see.** Round eleven measured a
   click across a button decoration, frozen presentation and a `<select>`, with and without a prior
   caret, and found **three** answers where there should be two; it fixed the odd one and the
   remaining two are still consumer-dependent by design (a control that took the focus answered the
   pointer itself; presentation that took nothing did not). That is defensible as a rule and
   undiscoverable as a user: whether a click moves your caret, selects a block, or does nothing
   depends on whether the consumer called `useControlRef` on the thing under the pointer.
3. **Drop bands are addressed in pixels.** The depth a drop offers is chosen by the pointer's X in
   MEASURED indent units — 24px between two bullets, 48px under a toggle, the shallowest band
   unbounded to the left. Round four checked the reported "12px band" and it did not reproduce, so
   the complaint was never about the size; it was about a structural choice made with a mouse
   position. Its cost is stated where nothing else states one: **~1.5 ms per `dragover` at 4000
   rows, 9% of a frame.**
4. **Popups opened downward only** — measured at top 836, height 196, in a 900px viewport. Fixed
   (`b92a8db0`), and the fix is the best small story in the record: needing the popup's measured
   size forced both positions onto the popup's own element signal, which uncovered that **both**
   adapters read `overlay.position()` non-reactively, so the popup had been frozen where it opened
   and never followed the caret. One visible defect was hiding one invisible one.

**And two the sessions reported as surprises that are correct as they stand**, kept here because
re-filing them is a wasted round: typing `- [ ] pack` inside a bullet gives `- - [ ] pack` (a row is
typed by the bytes at its START; converting means the scan re-reads a body as an opener, which is
the shape `token-born-edit/issues/08` rejected), and Home/End inside a carved table row are
row-scoped rather than cell-scoped (End from `Task` lands in `Effort` — self-consistent, and
undocumented).

---

## Process — the part with the most transferable value

### Yield, in order

Counted from the record; where a round left no count of its own I say so rather than estimating.

| Method | Defects it found | What it cannot find |
| --- | --- | --- |
| **Hand-driving** | **42 nameable.** Sessions 4/5/8/9/10/11 = 6+5+6+5+5+4 = **31** in `map.md`; session 1 = **7** in `outcome.md`; the final session = **4**. Sessions 2, 3, 6 and 7 left no count of their own — their findings are folded into P11.5/P11.6 and into the "round seven" rules rounds eight and nine cite. | Anything below the gesture: it reports symptoms, and **two of its diagnoses were false** (below). |
| **Adversarial review** | **~33 reproduced.** P4 4, P5 1-in-3-faces, P6 2, P8 2, P9 1, P10 5, P11 7, P11.5 1 (from 2 filed), P11.6 13 findings / **10** reproduced. | Only the code that was just written, and only what a reader can hold: every one of these rounds read a diff. |
| **Mutation** | **0 new defects — and it is the only thing that tells a real pin from a decorative one.** P4: 4 load-bearing mechanisms survived deletion green. P10: 4 more. `36a621c8`: 28 mutants, 27 red, one silently ungated fallthrough. The coverage audit: **44 mutations, 49 covered / 2 decorative / 0 uncovered.** | New behaviour. It audits the net, never the fish. |
| **The suite (2240 tests)** | **Near zero, by construction.** Three named catches in the whole record, and the good one is cross-adapter: `history` arrived `false` in Vue because Vue casts an absent Boolean prop, so undo shipped working in React and dead in Vue. Also the keymap's own browser spec finding a two-keystroke data-loss bug that predated it. | Everything the driving sessions found. P11's own summary: **seven defects the phase's suite reported as green**, every failing gesture pinned by the VALUE and by nothing else, and the value was right in all seven. |

The ordering is the finding. **A green suite is a ratchet, not a detector** — its measured value is
refusing a regression once a defect is known, and catching adapter divergence. It found roughly one
defect per fifty a person found by using the thing.

### What the effort got wrong and corrected by measuring

- **The withdrawn performance claim.** The scan-first inversion *"was once sold on"* 12×. Measured,
  its own margin is **about 1.2×**; the 12× belonged to a defect in the old pass's two quadratic
  loops and was fixed separately, before the inversion landed. ADR-0010 states this in its own body
  and re-states the cost in bold: **net +418 production lines, not a code reduction.** An
  architecture sold on a number it did not own would have been unfalsifiable a year later.
- **Mechanisms that died when deleted.** Two verdicts of "irreducible" fell to a deletion and a test
  run (doctrine A.1). `#ensureSeeded`, `#applyDepth` (−11 lines), `overlay.mode`,
  `MenuSpec.section`/`icon`, `MenuEntry.section`, `choose`'s `meta` arm, `tx()` and its whole
  Batch/overlap/hull machinery (16 callers, all its own spec, **+19/−263**).
  **And the counter-example matters as much:** `#enterRow`'s `into === 0` fork was measured green
  and **kept**, because a probe found the two arms name different positions for a mark entry — every
  existing case asserted an OFFSET and stayed green while a caret moved out of a mark's slot. A
  green suite is not a proof in either direction.
- **Decorative pins, in six places.** `isAllSelected`'s collapsed case (its fixture was a caret
  mid-`'hello'`, which the equalities already refuse); `invertWindow`'s first pin (the swap it used
  is its own inverse — a **rotation** is what reddens a pairing read forwards); P11's two freeze
  pins (one asserts structure, the other dispatches `beforeinput` on the outer host); the
  click-on-frozen-presentation pin, which **asserted the defect itself as the contract**; and the
  audit's two — a board drag whose `preventDefault` can be deleted with the suite 2232 green, and a
  CSS selector whose tightening no pin could reach because the fixtures paint no furniture.
- **Briefs a repair pass refuted, by measuring them.** Round nine was told
  `store.rows.selected()` came back EMPTY while nine rows painted blue; measured three ways on the
  running page it answers `[3]` every time, and the likeliest source of the `[]` is that it was read
  in devtools — **focusing devtools is a `focusout`, which clears the stored pair by design**. The
  defect was real; the cause was somewhere else. Round ten found the rule round nine had just
  written **half backwards** and inverted it, keeping the half that was measured. Round eleven was
  handed *"that one clamp closes breaks 1 and 2 together"* and found half of it already shipped and
  the other half was two clauses, not one. The End-key dismissal (*"checked and NOT filed"*) rested
  on a premise nobody ever measured and is false on macOS. The 12px drop band did not reproduce.
  Round ten's `#settleCaret` was *"NOT the total trap the brief described: ArrowDown always
  escaped"*. **Five briefs, five corrections, and every one of them made the fix smaller.**
- **Records that were themselves wrong.** P11.5's own commit body had three false claims, one of
  them false for three of its four items. `map.md`'s "the Enter-then-Tab direction has no pin" was
  stale — `caret.react.spec` drives exactly that gesture. The showcase's own comment repeated a
  false grep about `white-space`. **A record is evidence about the day it was written**, which is
  doctrine A.13 read from the writing side rather than the reading side.

### The pattern that cost the most: fixing a shape instead of its class

Two classes ate eleven repair rounds between them, and in both the effort fixed the reported gesture
each time and named the class only at the end.

**A. "A row that holds no editable position."** Session 1 → `9c781d4a` (caret out of the control
root; destination wrong). Rounds 4-5 → `9ef80374` (destination is the row the pointer landed in),
`41963933` (the click consumes the claim). Round 8 → `b313c566` (a selection edge on frozen
presentation names its row). Round 9 → `290864c9` (a pointer claim outranks readings its gesture
could not produce), `7d9227d4` (a typed character is refused, not answered by taking the row).
Round 10 → the same rule inverted, `0af75dd9`, `112741bb`. Round 11 → `#claimLanding`'s
`KEYBOARD_OWNERS` arm and its `active !== container` ordering. **Six rounds, one class.**

**B. "A selection edge that lands on structural bytes."** Round 7 taught the row selection one shape
(a sibling row). Round 8 found three more faces at once and replaced `namesBoundary` + `stepOver`
with `contentSpan` — *"the whole suite was green at the swap, so those two functions were a special
case of this one all along"*. Round 9 added `frozenBoundary`. Round 10 added the structural-run arm
and `#offFrozen` and took the triple-click off the platform. Round 11 added the no-content arm,
renamed the clamp `#offBlockInterior`, and found the clamp **had never owned the delete path at
all**. **Five rounds, one class.**

**The tell is available every time and was used only at the end**: when a fix's own commit says the
suite stayed green at the swap, the thing being replaced was a special case, and the general case is
still out there wearing another face.

**And the class has a third instance, still open.** The final session's four defects reduce to one
sentence — *the editor answering a pointer with "place a caret" when the user meant "extend a
selection"* — and the one that matters is an upward mouse drag on a two-paragraph document, nothing
to do with Notion. **PROVEN, cheaply:** the whole test corpus dispatches `mousemove` exactly twice
(`RowController.spec.ts:128`, a hover/drop tick, and `Notion.react.spec.tsx:1651`, a drop test), and
neither begins a text selection. Every backward selection in 2240 tests is a `setBaseAndExtent`, a
Shift+click or a Shift+Arrow. **A gesture the suite has no vocabulary for is a gesture the suite
cannot regress-test, and eleven sessions of driving did not reach it either** — because a driver
reaches for the mouse to click, and reaches for the keyboard to select.

### The one methodological rule this record would add

**Measure the mirror gesture.** Four instances, all costing a round or more:

- Round 8: Enter at a row's START had the rule of Enter at its END. *"NO PIN ANYWHERE COVERED THE
  INVERSION: the whole suite stayed green with the swap in."*
- Round 10: round nine's precedence rule was half backwards; the half that was measured survived.
- Round 11 → the final session: the empty-row line box was measured against the reported gesture
  (ArrowUp visited 7, 6, 4, 2, 0) and fixed it. ArrowDown still skips, because the fix is an
  `inline-block` with a height and **no width**.
- `invertWindow`'s first pin was decorative precisely because its fixture was its own inverse.

A rule with a direction that is tested in one direction only is half a rule, and the record shows
this repo cannot tell the halves apart by reading.

---

## Next steps, ranked

Ranked by (breaks a first-hour gesture) × (cheap) × (nothing is blocked on it first), which is
`outcome.md`'s own rubric. Costs are honest, including where I could not cost something.

**1. The upward mouse selection, and the harness that makes it pinnable.** A drag that crosses a row
boundary upward collapses to a caret — measured on a two-paragraph document on `Notion/Empty`, with
`draggable: false`, with downward drags, leftward drags, Shift+click and Shift+ArrowUp all passing.
Sweep up over five rows, release, Backspace: one character dies.
**Reason:** it is the first minute of use for a mouse-driven editor, it is unrelated to any of the
block sophistication above it, and it is the third instance of the class rounds 4–11 have been
chasing.
**Cost, honestly:** two pieces, and the second is the larger. The fix has a named starting point
(`SelectionDriver.ts`'s `pointerdown` latch, `RowController.ts:178`'s container `mousemove`) but no
owner I have proven — **hypothesis only, I did not drive it.** The harness is the real cost: nothing
in the repo sweeps text with the button down, so the pin is a new capability, not a new test. Build
the harness first and drive the reduced two-paragraph case before touching an owner.

**2. `#visibleEnd` has one call site and the wrong one is unguarded.** **PROVEN by grep:**
`#visibleEnd` is called only from `rowSelectionText` (`TokenModel.ts:496`), which is the TEXT write
path. `replaceRows` (`TokenModel.ts:306`) — the exact-row-cover path that Backspace, Delete, paste
and a typed character over a row selection all reach — never asks it. So a sweep that covers a
collapsed toggle's row WHOLE takes its hidden subtree, which is exactly what the final session
measured (`\tWho owns the status page?` and `\tDo we page on p95 or p99?` gone to one keystroke).
**Reason:** silent data loss, and it is the same "one rule, two doors" shape round eleven fixed on
the delete path and P11.6 fixed on the paste path — the third door of the same rule.
**Cost:** one call, plus the declaration it forces. It IS a behaviour change: a Backspace over a
sweep covering a collapsed toggle would then leave the hidden body behind, which is a strict
improvement and still observable, so it is declared per AGENTS.md rather than filed as a fix.

**3. ArrowDown over an empty row.** ~~The round-eleven line box exists and is zero-width
(`display: inline-block, height: 16px, 1 client rect`), so upward traversal finds it and downward
traversal falls through.~~ **Refuted 2026-08-27, ticket 14**: measured false in both halves. The box
works in both directions and its width is irrelevant; the cause was the editor's own appended
zero-length `Text`, which the caret's visit left in the surface (`87ea7472`).
**Cost:** a CSS measurement with no editor in the page, both directions, and a pin per direction.
Cheap, and it closes the last of the four "arrows skip empty rows" reports that has survived three
attempts.

**4. Make the opener-prefix rule checkable.** `usableOptions` rejects an identical opener
(`TokenModel.ts:1928`); the standing rule is ~~*no shared opener prefix where either kind has a raw
body*~~ — **corrected 2026-08-27, ticket 15**, to *no kind that closes its own body may extend
another kind's opener* — and its one measured failure took the showcase from 36 rows to 3 on a
single menu click.
**Reason:** it is the only unbounded document-loss class on the open list, and it is currently
guarded by one browser spec that counts rows after adding a divider — a pin for one instance of an
unwritten rule.
**Cost:** a prefix comparison beside the equality already there, one `reportBadProp` message, and a
decision about whether it drops the later kind (what duplicates do today) or reports and keeps both.
Doctrine A.15 applies exactly: make the invariant checkable, not a paragraph.

**5. Decide the trailing paragraph.** Unchanged as `outcome.md`'s top open DECLARED item and it has
survived four rounds of being walked around. An atomic row generates no caret position, so `choose`
can leave a document with no caret target at all; the click claim's "a row with no position is
inert" is the closest anything has come to an answer.
**Cost:** it is a published-contract decision, not a task — either the editor guarantees a trailing
empty row, or `choose` gains an insert-after contract beside its turn-into one. Decide once; every
round since has patched around it, and item 4 of the DX list (`Code`'s missing seed) is the same
hole seen from the option API's side.

**6. P12 — the Vue showcase.** ~800 lines of `options.tsx` vocabulary plus sixteen presentational
leaves re-declared as Vue components, plus Vue's `useControlRef`.
**Reason:** the showcase's net is still three React-only files (`Notion.react.spec.tsx`,
`caret.react.spec.tsx`, `structure.react.spec.tsx`), and the rules those pin — caret, focus,
claim ordering — are exactly where an adapter can differ. Every fix from round eight on ships
half-measured.
**Cost:** the largest single item on this list, and it is a second implementation rather than a
rename. The mitigation already taken is real and bounds the exposure: the three core rules whose
only pin was that file now have core unit pins, and rounds 8–11 put most new pins in specs both
projects run. **It jumps to rank 1 the moment one adapter defect escapes** — and note that the one
adapter defect this effort DID find (Vue's `history` boolean cast) was found by a shared spec on its
first run, which is the argument for this item, not against it.

**7. The cheap DX items, as one afternoon.** `Store` re-exported from both adapters (ticket 03's
open half, one barrel line each), the `useMarkput` selector overload or `ObjectSelector` widening
(ticket 10), and a decision on `OverlayHandler.ref` / `MarkedInputProps.Span`.
**Cost:** two lines, one overload, two decisions. Ranked here rather than higher only because
nothing is blocked on them today; they are what a real consumer meets in their first hour, so they
rank above everything below this line.

**8. Delete `rowSelectionText`'s original-vs-clamped distinction, or pin it.** The coverage audit's
one unexercised claim: line 489 feeds `contentSpan` the clamped pair, line 491 asks `rowSelection`
the ORIGINAL pair, and the comment says that is what keeps round nine's refusal. Feeding it the
clamped pair is **2232/2232 green** and identical on the running page across six gestures. Round
eleven flagged it itself and the audit reproduced it.
**Cost:** one line, and a maintainer's word — doctrine A.8's "zero callers is not dead code" does
not apply (this is internal, not published), but doctrine E.6's "does your pin redden" says a
distinction nothing can exercise is not a distinction. Two reads with no measurable difference are
a deletion candidate, not a pin.

### What I would not do yet, and why

- **A real published `@markput/notion` package.** `boundary.spec.ts` already proves the showcase is
  options and components, so the package is a MOVE and not a build — which is exactly why it is not
  urgent, and it is why doing it now is a mistake. Publishing freezes an API around gestures that
  are still moving: rounds 8, 9, 10 and 11 each carried a `!` on a selection or caret rule, and item
  1 above is unowned. Also, the move is not free of API: `Store` and the selector type (item 7) must
  land first or the package's consumers add `@markput/core` as a second dependency — which is the
  door `boundary.spec.ts` exists to keep shut.
- **A selection toolbar, "Turn into" in the row menu, grouping and icons in the `/` menu, the
  gutter `+`.** All real gaps. The doctrine's own first test asks what a proposal deletes, and none
  of these delete anything; every one adds published surface over gestures items 1–3 say are not
  finished. `ROW_MENU_ITEMS` being three entries is a symptom of that, not a reason to add a fourth.
- **`RowSpec.group`.** Three wants are blocked on it (column alignment, table semantics, header
  runs) and `map.md` records the threshold honestly: *when a fourth turns up, it stops being a
  feature and becomes the missing primitive.* No fourth has turned up. Re-check when one does.
- **A per-kind drag axis** — and therefore the nested-row board and the metric cards beside the
  callout. It is cross-axis hit-testing, which P10 put out of scope with a measurement rather than a
  preference (a board's columns share one Y span, so a card dragged between them lands in an
  arbitrary one). Reopening it is a phase, not a follow-up.
- **`softBreak`.** ADR-0011's amendment declared four costs and the two the P6 review found were
  both repairable inside the continuation-row reading, in one expression each. Nothing since has
  produced a case the continuation cannot carry. It stays not-built until one does.

---

## Where these items live now

Filed as tickets 2026-08-27 (`docs/scratch/notion-like/issues/`, indexed by its `README.md`), so this
record stays the evidence and the tracker carries the queue. The line numbers cited above and
throughout the tickets are this file as of `52ef65ae`.

**Next steps, ranked** — 1 → [12](issues/12-upward-mouse-selection.md), 2 →
[13](issues/13-collapsed-body-lost-on-a-row-cover.md), 3 →
[14](issues/14-arrowdown-skips-an-empty-row.md), 4 → [15](issues/15-opener-prefix-is-unchecked.md),
5 → [16](issues/16-trailing-paragraph.md), 6 → [26](issues/26-vue-showcase-p12.md), 7 → the probe's
[03](issues/03-row-node-not-nameable.md) and [10](issues/10-controllers-are-not-selectable.md) plus
[25](issues/25-published-type-corrections.md), 8 → [35](issues/35-unexercised-clamp-distinction.md).

**What I would not do yet** — the package is
[39](issues/39-notion-package.md), the four affordances are
[27](issues/27-four-missing-affordances.md), `RowSpec.group` is [20](issues/20-rowspec-group.md),
the per-kind drag axis is [38](issues/38-per-kind-drag-axis.md), and `softBreak` is
[37](issues/37-softbreak-stays-unbuilt.md).
