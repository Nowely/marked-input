# Tree Core — Decision Record

**Two subsystems, one record.** S1 turned the token tree into the source of truth and the
value string into its projection. **S2 Core Addressing** finished that inversion by deleting
the three compat layers S1 left behind — the internal offset shim, the bind-generation token
and the `Token` snapshot — in two cuts: **Cut B**, one address space (above
`features/tokens/tree/` every position is a `NodeAnchor`), and **Cut A**, one node
representation (`TreeNode` travels from adoption to the rendered element).

**This document is not an architecture guide.** That lives in
`packages/website/src/content/docs/development/architecture.md` (the system) and
`packages/core/src/features/tokens/README.md` (the token layer), with the public shapes in
the generated `packages/website/src/content/docs/api/`.

What follows is only what those documents and the code comments do _not_ carry: the places
the implementation deliberately diverges from the obvious design, the design decisions that
were wrong and got corrected by measurement, the behaviour that moved, the alternatives that
were measured and dropped, the code that looks dead and is not, the gaps no test can hold,
and what is still open. Written against `4d83cad4`, re-verified through S2.9 and through the
two commits that landed after the S2 spec was actualized (`a47182cc`, `0835cd07`); every S1
entry that S2 changed says so in place.

Each subsystem's design spec, per-phase implementation plans and spec review record were
removed from the working tree once its work landed. They are unchanged in history:

- **S1** — `git show 4d83cad4:docs/superpowers/plans/2026-08-08-markput-s1-tree-core-v2.md`
  (the spec) and its siblings in the same directory.
- **S2** — `git show 74160c19:docs/superpowers/plans/2026-08-10-markput-s2-core-addressing-v1.md`
  (the spec, v1.1, actualized against what was built), plus `…-s2-phases-1-3-plan.md` and
  `…-s2-phases-4-9-plan.md` in the same tree.

**One S2 pointer does not resolve, and the S2 spec claims it does.** Its header says the
superseded S2 Selection draft and its S2.1–S2.2 plan were "deleted from the working tree at
S2.9" and are "retrievable from history". They were never committed:
`git log --all --diff-filter=A --name-only -- docs/superpowers/` shows `74160c19` adding
exactly the three files above and nothing else. That draft is gone for good. Nothing below
depends on it; where its numbering leaked into the S2 documents, the decoder says so.

## Reading the spec citations left in the code

Around 200 comments across `packages/` cite a spec by decision or section number. Both specs
are gone from the tree, so here is the decoder. Full text at the two refs above.

**AN UNPREFIXED `D*` REF IS USUALLY S1's** — nearly every bare `D1`…`D11`, every bare `§n`
and every `AC-*` in the code points into the S1 table below. S2 reuses the same numbering for
different decisions, so its citations were meant to carry an explicit `S2` (`spec S2 D10`),
and where the two could be confused — a comment S2 wrote, or one it moved into a file it
created — the S1 ref is spelled `spec S1 D7` too. Two S1 decisions are now RETIRED; the table
says so and the sections below say where.

**Four bare refs escaped the rule and mean S2's.** Checked by reading each, not assumed:
`EditController.ts:39` (`spec D6` = S2's one surviving offset verb, not S1's controlled-mode
policy), and `spec D8` at `slots/resolveSlot.ts:60`, `tokens/dom/commit.ts:74` and
`tokens/seam/TokenModel.ts:135` — all three mean S2's per-node render subscription, not S1's
offset shim. Every other bare `D6`/`D8`/`D9` in the tree is genuinely S1's, including
`TokenModel.ts:228`'s `spec D8`, which is the shim rule inlined into `replaceBetween`.

| Ref    | What it says                                                                                                                                                |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `D1`   | Tree is the source of truth; the string is a computed projection.                                                                                           |
| `D2`   | One identity mechanism — `adopt(tree, window, parsed)`, fed either an exact op window or a gap-derived one.                                                 |
| `D3`   | Positions are parser-stamped plain fields, written only by adoption. Not reactive.                                                                          |
| `D5`   | Every mutation is a transaction over the `applyRange(window, text)` primitive.                                                                              |
| `D6`   | Controlled mode is stateless: emit, record `lastEmitted {base, value, window}`, adopt on the echo.                                                          |
| `D7`   | Selection stores `NodeAnchor`s; the numeric range is derived. Capture happens **before** adoption.                                                          |
| `D8`   | No public compat artifact; the internal offset shim keeps its own lifetime. **RETIRED at S2.6** (below).                                                    |
| `D9`   | `TransactionResult` is the single change feed; one owner per datum. Its third clause — handles read bind-generation state — is **RETIRED at S2.7** (below). |
| `D11`  | One node structure (`TextNode \| MarkNode`), public as-is; its signal fields are the public reactive read.                                                  |
| `§1.2` | Non-goals: raw performance, undo, collab, first-class block rows, composition/IME, parser changes.                                                          |
| `§2.3` | The target public API — now shipped as `MarkputApi` plus the node read/write surface.                                                                       |
| `§4.2` | The adoption walks: window-bounded prefix, window-bounded suffix, same-index middle, slot recursion.                                                        |
| `§4.3` | Transaction mechanics (entry guards, `tx` buffering, hull window).                                                                                          |
| `§4.4` | The string boundary: commit policy and arrival routing.                                                                                                     |
| `§4.5` | Selection swap onto anchors.                                                                                                                                |
| `§4.6` | The mechanism ledger — the six named deletions that gated the cutover. All six are gone.                                                                    |
| `§6`   | Error handling: reject before mutation, `false`/`undefined`, throw only on developer error.                                                                 |
| `§7.1` | The output-equivalence property: after every adopt, `snapshot(tree)` deep-equals the parse.                                                                 |
| `§9`   | Future work.                                                                                                                                                |
| `§11`  | Implementation phases S1.1–S1.10. All executed or rejected; of historical interest only.                                                                    |

Comments also carry `plan decision D-a`…`D-h` tags. Those point into the per-phase plans,
and unlike the spec citations they are provenance only — each such comment states its own
reasoning in place, so nothing is lost by not chasing the tag.

### S2's numbering

| Ref         | What it says                                                                                                                                                         |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `S2 D1`     | Offsets STOP at the `tree/` boundary; they are not deleted. `anchorAt`/`offsetOfAnchor` survive as adoption's internals. The checkable form is the `.position` grep. |
| `S2 D2`     | One walk, one projection: `anchorFor` replaces `boundaryFor`, bridging to the live tree through the generation-independent `handle.id`.                              |
| `S2 D3`     | The selection channel becomes anchor-shaped; `map` does not change; the resolution moves inside `adopt`.                                                             |
| `S2 D4`     | `anchorFor` fails closed in exactly two new cases — id absent from the live tree, text-local offset past the live node's text — and NOT on the adopt→bind window.    |
| `S2 D5`     | The DOM-truth read survives in anchor form as `domAnchors()`. `dom*` = "what the DOM says now"; `selection.anchors()` = "what the model believes".                   |
| `S2 D6`     | Exactly one verb keeps an absolute offset: `EditController.setValue(text, caretOffset?)` — internal, whole-value, for `block/`'s string rewriter.                    |
| `S2 D7`     | Text-surface content stays core-written; the commit-time text branch becomes one effect per bound text surface.                                                      |
| `S2 D8`     | Per-node subscription replaces snapshot identity as the render gate.                                                                                                 |
| `S2 D9`     | `TokenHandle` becomes a pure DOM binding: id, element bindings, caret commands.                                                                                      |
| `S2 D10`    | Selection splits tree-half (`tree/selection.ts`) / DOM-half (`dom/SelectionDriver.ts`), both inside the token layer.                                                 |
| `S2 D11`    | `#generation` and the derived numeric `range` die together; `MarkputApi.selectionRange()` goes with them.                                                            |
| `S2 D12`    | `Token` leaves the public API and reverts to the parser's output type.                                                                                               |
| `S2 §4.5`   | The consumer conversion table — which call site moved from which numeric form to which anchor form. The most-cited S2 ref by far.                                    |
| `S2 §6`     | The fail-closed answer table: which condition answers `undefined`, which returns `false`, what still throws.                                                         |
| `S2 AC-4.4` | Typing before a mark and pressing Backspace still swallows the mark.                                                                                                 |
| `S2 AC-5.1` | `tree/selection.ts` is exercisable with no mounted container.                                                                                                        |

The table states these AS SHIPPED, not as designed. Several were overturned during
implementation — D3 lost `selectionBefore`, D8 could not use `roots`, §2.3's `replaceBetween`
is not a boolean — and the next section says why.

## Where S2's design was wrong

The highest-value thing in the deleted S2 documents. Each of these is a decision that was
argued, written down, implemented, and then measured to be wrong; a reader who does not know
that will re-derive the same reasoning and land in the same place.

**`roots` cannot be the render signal — `renderEpoch` is.** D8 and §4.7 both said `roots`
carries structure and `renderTree` is deleted outright. It is not deletable, only
replaceable: adoption writes `roots` only when the root list changes BY REFERENCE
(`adopt.ts`'s `sameNodes` gate), so a mark whose value changed and a structural change inside
a slot both leave it equal. A container subscribed to `nodes` alone never re-renders for
either, so `rendered()` never fires, `bind` never runs and the paint latch never opens.
`renderTree` became `renderEpoch`, a counter carrying the same `render` bit with the payload
dropped. The gap had ZERO coverage — dropping the `renderEpoch` entry from either container's
selector left the whole suite green — which is why the two "a mark value change announces
changed" cases exist in the render-count specs now. Restated at `dom/commit.ts:71` and in
both `Container`s.

**`selectionBefore` was designed onto `TransactionResult`, built, and then deleted as
write-only.** D3 grew the result two fields; nothing ever read the capture back off it —
`repair` applies `selectionAfter` and nothing else. Falsified rather than assumed: replacing
it with `undefined` in `adopt`'s return reddened only `valueBoundary.spec`'s three capture
cases, which now assert through `selectionAfter` instead and gate the same three entry points
(commit, arrival, reparse) more tightly, because a resolved anchor proves more than a carried
one. `adopt` keeps `selectionBefore` as a PARAMETER — that is its real input, and adoption is
the only code on the pre-mutation side of the coordinate line.

**`map` keeps its numeric signature; `map(anchor) → NodeAnchor` is the obvious move and is
wrong.** `map` is called lazily by its consumer, i.e. after `adopt` has rewritten node
`position` fields in place, so an anchor handed to it would be converted against
POST-adoption positions and shifted a second time. That is the double-shift S1 already paid
for. `map` has no production caller now and stays anyway: its six spec call sites are the
property gates on the mapping semantics (right affinity, no affinity parameter).

**`replaceBetween` returns `NodeAnchor | undefined`, not `boolean`.** §2.3 specified a
boolean. It answers with the caret the edit's natural post-state wants — an anchor at the END
of what was inserted, resolved against the POST-splice tree — because only the token layer
may form the offset `min(from, to) + text.length` needs, and nothing above `tree/` may form a
number at all (D1). So it answers rather than side-effects. `EditController.replace` applies
it; `MarkputApi.replaceRange` reads it only as a success flag; in controlled mode the tree
has not moved, so the anchor describes the pre-edit tree and `EditController` discards it.

**The declaration-order hazard does not reach `selection`, and the layout exception was
dropped rather than kept "to be safe".** §4.6 predicted that `readonly selection =
createSelection(…)` declared in `TokenModel`'s consumer-reads region would read `#tree`
before its initializer ran. The MECHANISM is real and was probed in place — a field
initializer reading `this.#tree` from up there answers `undefined` silently, no throw and no
type error — but `createSelection` takes a dep BAG whose entries are closures, evaluated at
the first verb call, long after every initializer. Measured with `selection` declared first:
suite unchanged, and a mounted store answers `isAllSelected` correctly. The DRIVER does have
a constraint and it is a different one: `SelectionDriverDeps` takes `host` and `changed` as
VALUES, so an initializer would read a constructor parameter property — `tsc` rejects that
outright with TS2729 — and `#pipeline`, which answers `undefined` silently. It is built in
the constructor body, last, which also preserves the `onMounted` registration order `Store`
used to produce.

**`changed` did not fire after the caret was placed.** `0835cd07`, the newest commit here,
landed after the S2 spec was actualized and appears in NONE of the three documents. `changed`
is an event, so emitted at batch depth 0 it flushed its subscribers INSIDE `pipeline.apply`,
ahead of `#committed` and of `selection.repair`. Depth 0 is not exotic — it is the whole
controlled path, where adoption runs from the props watch and adoption's own batch has
already closed; the uncontrolled path was correct only incidentally, because
`EditController.replace` wraps its edit in a batch of its own. Every consumer of the
announcement therefore saw the new tree against the previous generation's selection: measured
as typing `@` at offset 3 announcing with the stored caret still at 3 while the tree already
read `@` with the caret at 4. `TokenModel`'s `onResult` now commits in one `batch`, which is
what makes the documented write order observable rather than merely written. Any comment or
document that says "`changed` fires once the DOM and the selection agree" was aspirational
before this commit and is true after it.

**One hypothesis raised against the design was itself wrong, and re-raising it is likely.**
A `useMarkput` object selector — `s => ({nodes: s.tokens.nodes})` — reads as malformed if you
assume the selector's RETURN is the target, so a reactive entry would have to be a thunk.
`shared/readSelected.ts` branches on the target instead: a function is called, an object has
each `isReactive` entry called for it. Both shipped containers use the object form.

## Gates that turned out not to be gates

Every phase of S2 specified its own falsification step. Several could not falsify anything,
and finding that out was worth more than the step. Recorded because the shape recurs.

- **The prescribed S2.3 fixture could not see the ordering it existed to prove.** A caret in
  a single-root `'hello'` reads offset 2 before and after adoption, because its node never
  moves — both orderings agree. What actually reddens when the pre-mutation offset reads are
  moved below `adopt.ts`'s batch is a rewritten `adopt.spec` case (11 instead of 10) plus
  `tree/selection.spec`'s "keeps node and offset when the edit is outside the anchor" and
  "captures an 'end' anchor in TREE space".
- **A comment named a gate that did not exist.** `childBoundaryAnchor`'s inverted-affinity
  fallback claimed the pinned boundary table gated it; flipping it left ~900 core cases
  passing. Reaching it needs an interior child boundary whose two neighbours do not both
  resolve to live nodes, which needs a DEAD neighbour — a structural edit with no repaint.
  Gated now, with the fixture named at the site.
- **A mutation that only the doomed gate could see.** Changing the child-sequence edge from
  `offset >= childCount` to `>` reddened only S2.1's equivalence property, which S2.6
  deletes; the dedicated case stayed green because the fallback coincidentally agrees under
  the default affinity. A `'before'` probe at the same offset separates them.
- **`domAnchors`' `undefined` contract has only an indirect gate.** Making it answer a value
  when the window selection is gone leaves the whole repo green — `handleDeleteKey`'s
  all-selected branch masks it. `input.spec`'s "clears the whole value even when the DOM
  selection is gone" discriminates only once that branch is also deleted; that combination
  was run and is red/green as claimed.
- **The numeric read had no unit gate at all.** Shifting `readRaw` by +1 left all 11 pinned
  `SelectionSnapshot.raw` assertions green — they pinned `boundaryFor`, which the anchor path
  no longer goes through — and reddened ~30 storybook assertions instead. The browser suite
  was the real gate for the whole of Cut B's selection work.

Because S2.1's equivalence property was the sole gate for at least one branch, S2.6 mutated
every branch of `anchorFromBoundary` in turn after deleting it: 28 mutants, 26 red, and both
survivors accounted for — one is a TYPE narrow (`owner.kind !== 'text'`, deleting it fails
`tsc`), the other was a genuinely ungated fallthrough that gained a case.

## Deliberate deviations from the obvious design

**Slot recursion carries no window bound.** The two top-level adoption walks are bounded by
the edit window, and that bound is load-bearing: without it, content that repeats with the
deleted span's own period keeps matching past the edit, and the removal lands on the wrong
repeat. Spec §4.2 specified the same protection one level down — a gap-derived, slot-local
window for the recursion into a mark's children. It was **not implemented**. In-slot pairing
is therefore unbounded same-index pairing, and it fails in exactly the way the outer walks
were protected from: in `#[@[a](m) @[a](m) tail]`, deleting the _first_ inner mark retains
that mark and reports the _second_ one removed, dragging ` tail` — a node entirely past
`window.end` — into `removed` with it. This is measured and pinned in `tree/adopt.spec.ts`,
and restated at the recursion site in `tree/adopt.ts`. Anyone diffing that file against the
spec must read the omission as scoped, not as an oversight. Closing it means deriving a
slot-local window from the two slot contents and threading it through `adoptSiblings`.

**`map` has right affinity and no affinity parameter.** A pre-adoption offset sitting _at_
the window start maps to the end of the inserted text, so typing `X` at offset 5 of `abcde`
moves a caret at 5 to 6, and an overtyped selection collapses onto the replacement. Left
affinity — which is what a _foreign_ selection anchor at someone else's insertion point
would want — is what the first implementation shipped, back when `map` had no consumer.
Nothing in this codebase is that consumer, so there is one `map` and no parameter. Adding
the parameter later is cheap; adding it speculatively was not worth the second code path.

**No composition/IME handling, by decision.** The input path handles `insertText`,
`insertFromPaste`, `insertReplacementText` and the `delete*` family and nothing else; there
is no composition latch, no deferred arrival, no `compositionend` absorption. This was a
maintainer descope, not an omission — the rewrite left composition behaviour exactly where
it was, neither better nor worse, and `insertCompositionText` is non-cancelable, so getting
it right is a project of its own. A design sketch (commit latch, latest-wins deferred
arrival, compositionend as one transaction) exists in the deleted review record if it is
ever picked up.

**D8 IS RETIRED: the internal offset shim is gone (S2.6).** `tree/offsetShim.ts` lowered a
global `{start, end}` range onto `applyRange`, with `end < 0` meaning "to the end of the
value". S2 replaced its CALLERS rather than its implementation: every write above `tree/`
names NODE ANCHORS now (`TokenModel.replaceBetween(from, to, text)`), and the document edges
are the `'start'` / `'end'` anchors, so the `-1` sentinel has nothing left to express. The
block work the shim's lifetime was tied to did not have to happen first, which is the part
worth knowing: `block/operations.ts` still computes offsets, but it hands them to
`EditController.setValue(text, caretOffset?)`, which is not a public export.

One thing the shim did must not be "simplified" away, and it lives on inside
`TokenModel.replaceBetween`: a WHOLE-VALUE op is re-derived through `gapWindow` instead of
being passed through as `{0, length}`. Those callers synthesize a complete new string and
have no real edit span, and a full window makes both adoption walks inert — every row
re-pairs by index, so deleting row 2 of three keeps row 2's node now holding row 3's content
while row 3's node dies, moving `BlockController`'s per-row store onto the wrong row. The
rule is restated at the site and its gate moved with it.

**D9'S BIND-GENERATION CLAUSE IS RETIRED (S2.7).** `TokenHandle#token` carried "the
generation the DOM is showing" — a second representation of data the tree already owns.
S2.6 took its three positional readers; of the two left, `setEditable`'s kind test was DEAD
(`bind` gives a `textElement` to text nodes and to nothing else, so `!textElement` already
means "mark") and `commit.ts`'s divergence detector now compares against the live
`TextNode.text()`. What replaced it is one per-surface text effect armed by `bind`, which is
the single writer of a bound text surface. The rest of D9 stands: `TransactionResult` is
still the single change feed, and `handle(id)` still fails closed inside the paint latch.

**`createSelection` takes a dep bag, and the reason it exists is not the reason it stays.**
It was phasing: at S2.2 `Store` still built the selection and `TokenModel` kept `#tree`
private, so `{tree: TokenTree}` was unreachable. S2.9 could have re-pointed it at `#tree`
and did not, for two reasons that outlived the phasing. Two of the closures are NOT bare tree
reads and cannot become them: `anchorAt` SEEDS (substituting `anchorAt(this.#tree.roots(),
n)` fails two `tree/selection.spec` cases), and `value` is PROPS-first. The bag is also what
keeps the module unit-testable over a bare `createTokenTree`, which is AC-5.1.

**`sync` does not call `domAnchors()`, though it composes the same two `anchorFor` calls.**
They share `#anchorsIn` instead. `domAnchors` folds both `undefined` reasons into one, and
`sync`'s two exits differ deliberately: **no DOM selection clears** the stored anchors, an
**unresolvable boundary leaves them standing** (D4). Two `focusin` cases discriminate them —
swapping the exits turns both red. Collapsing the two into one call is the plausible cleanup
and it is a behaviour change.

**Two DOM writers became one, and the check that guards it is neither of the obvious
placements.** `dom/commit.ts:210-248` states it in full and should be read before anything is
moved: the divergence detector sweeps the WHOLE tree from a `changed` subscriber, not from
inside the per-surface effect (an effect that was never armed never runs, and never-armed is
the primary bug class) and not inline at the end of `apply` (`EditController.replace` wraps
the write in a batch, so the effects adoption queued have not flushed when `apply` returns).
Both rejections are measured and both placements are gated.

**`block/operations.ts`'s `EMPTY_TEXT_TOKEN` was not ported to a node, and that is right.**
Cut A's type swap was mechanical everywhere except here. With no rows to address both of its
answers are constants — the row content twice, and a caret at 0 — so `applyDragAction` states
them instead of threading a forged stand-in row through two helpers. A `TreeNode` literal
would have been a node with no identity in any tree.

**`blockEdit`'s row-emptiness test is `valueBetween({before}, {after})`, not `node.text()`.**
The pre-Cut-A code read `Token.content`, which for a MARK row is the whole markup; the
obvious swap to `node.text()` would have made plain Backspace delete every mark row. The
row's own projection is the equivalent, and the near-miss is why the line reads the way it
does.

## Behaviour S2 changed

S2 was specified as behaviour-preserving. Eight things moved anyway, each deliberately.
AGENTS.md forbids burying these; the ones whose reasoning is already at the site get a
pointer rather than a copy.

1. **`stepAnchor` fails closed on an unanchorable neighbour.** A position inside a mark's
   markup (the `{` of `#[v]{inner}`, a block row's trailing `\n\n`) has no anchor; the old
   numeric step spliced it anyway and re-parsed the mark into plain text. Backspace/Delete at
   those two positions is now a no-op. No test covered the old behaviour in either direction.
   Full reasoning at `tree/anchors.ts`'s `stepAnchor`.
2. **`EditController.replace` normalizes a reversed pair instead of rejecting it.** The
   numeric verb refused `{start: 4, end: 2}`. Pinned by `EditController.spec`'s "normalizes a
   reversed anchor pair instead of rejecting it", and it is why `TokenModel.value.spec`'s
   "rejects invalid ranges without calling onChange" was deleted rather than converted: with
   anchors there is no out-of-range pair left to refuse.
3. **A caret that crosses a shared boundary without moving its offset now updates the stored
   anchor.** The deleted numeric-equality guard short-circuited before the write, so the model
   kept believing the caret was in the text where the user had moved it to `{before: mark}`.
   Gated by "rewrites the stored anchor when the caret crosses a shared boundary at the same
   offset"; re-introducing the guard turns exactly that red.
4. **Anchor-shaped `placeCaret` fails closed where the numeric one guessed.** The old form
   searched every bound surface and fell back to the nearest, reading bind-generation
   coordinates for a layout the adapter had not painted. A node with no live handle now
   declines and the `tokens.changed` re-apply places the caret once the bind lands. Measured:
   the whole suite stays green either way, so no test ever observed the fallback.
5. **The pending-window fold is announcement-only.** An edit landing while a structural apply
   is unpainted still folds into that pass's single `changed`, but it now reaches the DOM
   immediately, where `commitText` withheld it. Separately, before the merge two structural
   applies before a single bind dropped the first one's removals, so a consumer pruning off
   `removed` could miss a wave.
6. **Self-heal escalation is gone.** `commitText` abandoned its branch on a missing handle or
   surface and re-bound the current DOM at once. There is no branch to abandon: `bind` arms
   one conditional-write effect per surface whose immediate first run is both the mount-time
   reconciliation and the corruption heal. A misaligned node layer now recovers at the NEXT
   PAINT instead of immediately.
7. **The overlay's `OverlayMatch.span` is the caret node's own text, not the whole value**,
   and its probe now runs on `tokens.changed` rather than `tokens.value` — per commit instead
   of per string change, which is a superset: measured 0/0 for a controlled edit no parent
   echoes, 0/0 for a parent that transforms the value back, 0/1 for an uncontrolled no-op
   commit. A probe is idempotent, so the one added firing is free.
8. **A surviving text node's `Span` slot no longer re-renders when its text changes on a
   structural commit.** Reasoned from the code, not from a failing test, and still true:
   adoption keeps the node OBJECT and writes its `text` signal in place, so `memo`'s reference
   compare suppresses, and both `Token` components deliberately do NOT subscribe to `text()`
   (doing so would repaint the Span on every keystroke, which is the one thing the text path
   exists to avoid). The DOM text is correct either way — the per-surface effect writes it —
   but `resolveSlot.ts:70`'s `{value: node.text()}` prop goes stale until something else
   re-renders that component. This is the sharp edge of the pre-existing "`Span` slot vs
   core-written text" item under **Open**, and `resolveSlot.ts` does not say so.

Two smaller ones, listed so a diff against the old behaviour is explainable:
`MarkputApi.selectionRange()` is **removed** — the only public break Cut B makes — and
`sliceNodes` emits an EMPTY slot where `clipboard/serializeRange.ts` emitted a mark's full
slot text for a window covering the markup but none of the slot children (unreachable from a
selection, and an accident of `toString`'s fallback rather than a stated rule; stated at the
site).

## Investigated and rejected

**A public compat artifact.** The original plan built `@markput/core/compat` plus mirrored
entry points in both adapters, frozen at cutover and removed "next major". Three facts
killed it. `@markput/core` is not published — `npm view @markput/core version` returns 404
while `@markput/react` and `@markput/vue` ship at 0.14.3 — so a core subpath is unreachable
by any user; only adapter mirrors would be public at all. Those mirrors are new build
machinery in two packages: each adapter has one vite lib entry, one rolldown DTS bundle
with code splitting off, and a CSS hook keyed on the entry filename, while core's `exports`
map has two entries and no subpath support. And "next major" has no date in a 0.x repo
configured with `bump-minor-pre-major`. Building a migration path for an audience that
cannot reach it, to delete it one phase later, is pure cost. The export table was executed
directly against the root export instead.

**The windowed re-tokenizer.** The pre-rewrite `incrementalParse` reparsed only a window
around the edit and spliced it between an untouched prefix and a position-shifted suffix,
and the first version of the spec proposed porting it. It cannot meet its own O(window)
claim. Segment pairing is non-local — the matcher pairs a close with the nearest unmatched
open, which may sit arbitrarily far outside any bounded window — so the algorithm needs an
"inert-outside" guard, and that guard scans _every_ token outside the window for markup
segments on every edit. That is O(document), which is the cost the windowing existed to
avoid. Worse, coverage collapses on ordinary prose: the segments of `@[__value__](__meta__)`
are `@[`, `](` and `)`, so a single closing parenthesis anywhere else in the document sends
the edit to the full parse. Against a full parse that costs single-digit microseconds on
realistic content, this bought nothing. Retrievable at
`git show 8685bc69^:packages/core/src/features/tokens/incrementalParse.ts` if the tradeoff
ever changes.

**Moving the adapter render loop off `Token[]` — rejected at S1, then DONE at S2.8.** S1
dropped it as a phase because its sizing was false (it argued the move would drag `bind` and
`commit` along; the pipeline bound its own private field, never the render tree, so the two
were already decoupled). What S1 got right is that the representation was never the
measurably wrong thing: on a structural edit the snapshot re-materialized every surviving
token with only `position` changed, and React's `memo` reference-compared that into an O(N)
fan-out, fixed by a ~13-line comparator in `Token.tsx`.

S2.8 did the move anyway, for a different reason — one representation instead of two — and
that comparator is gone with it: both adapters render `TreeNode`, each token component
subscribes to its OWN node, and reference compare does the rest, because adoption keeps a
node object for as long as it keeps its id. The render-count bound is now an exact number in
both frameworks (`renderCount.react.spec.tsx` / `renderCount.vue.spec.ts`): 1 Mark render
for a head insert at 100 marks, 1 for a single mark's value change. `Token` survived exactly
as S1 predicted — as the parser's output type and the §7.1 oracle.

**A shared `BoundaryTarget` intermediate feeding two projections (S2).** The superseded S2
Selection draft's answer to the near-duplicate fork AGENTS.md warns about: extract the walk's
decision into one type, then project it numerically and as an anchor. Right if and only if
BOTH projections are permanent. Here the numeric one is deleted at S2.6, so the intermediate
would have been scaffolding built to be torn down and threaded through five phases — more
churn than the fork. The fork was bounded instead: `anchorFor` and `rawPositionFromBoundary`
coexisted for five phases with an equivalence property holding them in agreement over every
probe in both pinned grids, and the property retired with `boundaryFor`. If this shape comes
up again, the question to ask first is how long the second projection lives.

**Zipping the common prefix instead of dropping a whole frame in `bind`'s walk.** The walk
bails an entire frame — and every descendant frame — on a child-count mismatch, which reads
like over-caution. It is not: the realistic competing design, zip the common prefix and stop,
binds the wrong child and the wrong grandchild in the case `bind.spec`'s "drops a frame AND
every descendant frame on a count mismatch" constructs, and that mutant is killed by 7 cases
suite-wide. Deleting the bail outright kills 93. Worth re-reading before the deferred Cut C
touches this walk.

## The trap list — looks dead, is not

Re-verified through S2.9 and `0835cd07`; the paths below are current. Two S1 entries are
struck because the code they described no longer exists — the note is kept so a reader
diffing against history knows it was deleted deliberately.

- **`tree/findGap.ts`** — reads like a helper of the deleted identity layer. `tree/gapWindow.ts`
  imports it, and gap-derived windows are how every boundary arrival and every whole-value
  op finds its edit span. It used to sit in `utils/` where it looked orphaned; it now lives
  next to its only caller.
- **`parser/utils/filterEmptyText.ts`** — an unported requirement, not a leftover.
  `tree/valueBoundary.ts` applies it to every block-mode parse. Its consequence is
  load-bearing elsewhere: block mode has no `TextNode` between rows, which is why
  between-row addressing uses the `{before}`/`{after}` anchor forms.
- **`serializeRange.ts` is GONE (S2.5).** It trimmed tokens by a numeric range, and the
  clipboard now asks the tree instead: `TokenModel.valueBetween(from, to)` slices by ANCHOR
  (`tree/tree.ts`'s `sliceNodes`) and `DomModel.selectedContent()` serializes the live DOM
  selection. The behaviour it protected survives there: a text node partially in range is
  sliced, a MARK partially in range is returned whole, so copying half a mention still
  yields the complete markup. Never replace `sliceNodes` with a string slice.
- **`tree/__testing__/snapshot.ts`** — `snapshot()` has no production caller and has not had
  one since S2.8, when both adapters moved onto `TreeNode`. It is the §7.1
  output-equivalence ORACLE: the property suites assert `stripIds(snapshot(tree))`
  deep-equals a fresh parse after every adopt, and it is deliberately unmemoized, because a
  cache inside it would gate adoption against its own cache. `tree/snapshotMemo.ts` and
  `materializeNode`'s separate export went with the production use.
- **`SlotRegistry`** (`shared/types.ts`, exported from `packages/core/index.ts`) — zero
  imports anywhere, and invisible to grep as a dependency, because both adapters extend it
  through `declare module '@markput/core'` in their `src/augment.ts`. Drop the export and
  `Slot` collapses to `unknown`, which fails every slot component as a JSX element. A module
  augmentation is not an import.
- **`Store`'s root export** — neither adapter re-exports it by name, which is not the same as
  unused: it is the only resolution path for both, imported as a value and constructed in
  react `MarkedInput.tsx` and vue `MarkedInput.vue`. It is also why the public-invariant
  wording under **Open** has to be exact.
- **`MarkToken`'s root export** (S2.9) — invisible to grep as a dependency, like
  `SlotRegistry`. It is `denote`'s callback parameter, and `denote` is re-exported by both
  published adapters, so dropping the type (S2.8 did, briefly) leaves a shipped signature
  unnameable from outside. `Token` and `TextToken` are genuinely internal and stay out.
- **`Anchors`' root export** — added by S2 and not anticipated by its own export table.
  `OverlayMatch.range` became an `Anchors` at S2.5, and the overlay contract is carried by
  both adapters, so the type must be nameable outside core.
- **`SelectionAnchor` in `features/tokens/index.ts`** — its one importer,
  `overlay/TriggerFinder.ts`, was deleted at `0835cd07`, so grep now shows the export with no
  consumer. It is still load-bearing: it is `SelectionSnapshot.anchor`'s type, and
  `SelectionSnapshot` is what `TokenModel.domSelection()` returns. Dropping it makes
  `snapshot.anchor` unnameable — the `MarkToken` argument again, one layer down.
- **`TransactionResult.map`** — no production caller since S2.3 moved the resolution inside
  `adopt`. Its six spec call sites ARE the property gates on the mapping semantics (right
  affinity, no affinity parameter). Deleting it deletes the only thing that pins them.
- **Four things S2.9's own deletion checklist listed and could not delete.** Recorded here
  rather than left as an unexplained gap between the checklist and the tree.
  `TokenModel.placeAtHandle` has a production caller — `keyboard/blockEdit.ts:156`'s row
  focus, which needs a handle's own start/end to disambiguate a shared boundary and not a
  node anchor. `isUserSelecting` has no production caller outside the driver, but 15 spec
  references across four files drive the editable policy through it, so deleting it means
  rewriting them onto a synthesized mouse sweep — a testing change, not a cleanup. `TokenHandle` and `SelectionSnapshot` cannot leave `features/tokens/index.ts`:
  `keyboard/blockEdit.ts` types on the first and `TokenModel.domSelection()` returns the
  second, so removing either export makes a shipped return type unnameable.

**One entry in the original list was wrong.** It claimed `joinNodes` had zero production
callers and survived only as part of the §7.1 gate. It does not: `joinNodes` is the string
projection. `tree/tree.ts` uses it for the `value` computed and for `MarkNode.slot()`, which
is why slot text is never stored and cannot go stale. Deleting it on the strength of that
entry would have deleted D1. Re-verify before trusting any entry here, including these.

## Recorded gaps — do not "fix" these with a decorative test

Each of these is a place where a mutation survived the whole suite. They are recorded at the
site in the code rather than papered over, because in every case the missing test would pin
a choice rather than detect a defect.

- ~~`SelectionController`'s `#trackSelection.sync` round-tripping through absolute
  offsets~~ — **CLOSED BY CONSTRUCTION at S2.4**, exactly as predicted: `anchorFor`
  (`dom/domBoundary.ts`) forms no absolute coordinate at all, so `anchorAt(offsetOf(a)) != a`
  at a shared boundary is no longer a premise anyone can hold. The numeric-equality guard
  that existed only for it went with it, and the module moved to
  `tokens/dom/SelectionDriver.ts` at S2.2.
- ~~`TokenModel.markFor`'s unfalsifiable throw~~ — **DELETED at S2.8**: the adapters render
  `TreeNode` directly, so there is no projection to look BACK from, and `useMark()` is a
  context read.
- `TokenModel`'s single `(value, parser, isBlock)` watch — splitting it into three watches
  survives. Nothing counts `changed` announcements for a simultaneous props change, so wave
  parity is unobserved. The tuple is kept because the pre-cutover shell behaved that way, not
  because a test would notice.
- `TokenModel.applyText`/`tx` — dropping `#ensureSeeded()` survives, because every fixture
  reaches those verbs through a mounted store. Kept for parity with the verbs whose gates
  _are_ the unmounted-store specs.
- `MarkputApi.value()` — substituting `joinNodes(nodes())` for the delegation survives the
  suite, because props and projection agree at every moment a mounted fixture can observe.
  Closing it needs an unmounted-store case the spec cannot express. (Its sibling, `{0,
length}` for the `-1` sentinel, stopped being expressible when S2.6 deleted the sentinel.)
- `TokenModel.selection`'s `value` dep (S2.9) — it is the PROPS-first `value()`, and
  substituting the tree's own `#tree.value()` survives the whole suite. `isAllSelected` is
  the only consumer and no fixture reads it mid-flight, between a controlled emission and
  its echo. Kept props-first because that is what the pre-S2.9 wiring did.
- ~~`tree/offsetShim.ts`'s sub-range pass-through~~ and ~~`seam/treeInput.ts`'s memo
  reuse~~ — both modules were deleted (S2.6, S2.8), so the gaps went with them.
- **The `#generation` case (S2.6)** — the one gate S2 deliberately gave up. It asserted that
  a derived numeric range refreshes when adoption shifts positions under an unchanged anchor.
  With no derived numeric range the assertion has no subject. Its surviving half is
  `adopt.property.spec`'s "answers a resolvable, in-range anchor for every pre-edit offset" —
  the mapping still lands on a live node or a document edge, never on a dead one. Do not
  reconstruct the deleted case; it would need the mechanism back first.
- **`Selection.clear()`'s boolean return has no reader** (noticed at S2.6, left alone
  deliberately). It matches the shape of its neighbours (`select`, `selectNode`) and changing
  it is a one-line API decision, not a discovery.
- **The `Span` slot's stale `value` prop** has no test and cannot get a cheap one — see
  behaviour change 8. Every fixture that would notice repaints the component for another
  reason. It needs a decision about who owns text-slot content before it needs a test.

## Open

- **Vue slot-mark render fan-out.** Vue is immune for value-only marks — it diffs the
  resolved `{value, meta}` by value — but fans out O(N) at the leaf for _slot_ marks, which
  means block rows and nesting: 101 row-Mark renders at 100 rows, measured. React's fix does
  not transfer; a ~15-line VNode cache was tried and removed the internal work but not the
  row-Mark count, because Vue's unstable slot closure defeats the child-update check. There
  is deliberately no structural fan-out gate in `renderCount.vue.spec.ts` — the React file
  has one and the Vue file does not, which is the asymmetry to look for. Adapter-sized work,
  worth doing only if block-mode typing is reported as slow.
- **`insertMark('caret')` after blur.** The selection driver clears the stored anchors on
  `focusout`, so the verb rejects whenever focus has left the editor — which is every toolbar
  button that does not suppress its own mousedown.
  The workaround is the standard `onMouseDown` + `preventDefault` pattern, demonstrated in
  `packages/storybook/src/pages/Api/Api.react.stories.tsx`. Fixing it properly means keeping
  a last-known caret across blur, which is a policy decision about what "the caret" means
  when the editor is not focused. Small, but not mechanical.
- **First-class block rows.** No longer blocking anything (D8 retired without it), but
  `block/operations.ts` is still the one module that synthesizes a whole new value string
  from row positions and computes a caret against it before it is parsed. That is why
  `EditController.setValue` keeps a `caretOffset` parameter, and why it keeps its
  controlled-mode exemption. Rewriting it onto precise windows is a caret-semantics change
  with pinned behaviour, not a cleanup.
- **The public-invariant wording.** "No export of `@markput/core` takes or returns an
  absolute offset" is true of `MarkputApi`, which is the API proper, and NOT literally true
  of the whole export list: `Store` is a value export, so `store.edit.setValue(text,
caretOffset?)` and `store.tokens.anchorAt` / `offsetOf` are reachable from it. The two
  `tokens` verbs are the tree layer's own coordinate boundary and are deliberately kept;
  `EditController` is internal wiring an adapter is not meant to call. State it as
  "`MarkputApi` neither takes nor returns one", not as a claim about every export. The
  invariant is about ABSOLUTE offsets specifically: `MarkputApi.replaceText({node, start,
end}, text)` takes numbers and always did, and they are NODE-LOCAL (S1 D5). Anyone
  re-checking the claim by grepping for `: number` will hit that one first.
- **Declared DOM identity — the deferred "Cut C", and the next worthwhile change.** Give each
  token element a ref keyed by node id so `element ↔ node` is a map instead of `bind.ts`'s
  positional walk. That deletes `walkDom`'s all-or-nothing frame alignment,
  `computeControlRoots`' per-commit ancestor sweep, and the paint latch's last reason to
  exist. S2 named it a non-goal by maintainer decision, not by analysis; it is independent of
  everything S2 did.
- **`map`'s short-circuit.** Skip the offset round trip when the adoption window does not
  overlap the anchor's node. `map` has no production caller, so this only pays once one
  exists.
- **Selection direction across repair — and the S2 spec is wrong about its starting point.**
  Its future-work list says `direction` "is computed today and not preserved by `remap`". It
  is not computed
  anywhere any more: it was a field of `SelectionSnapshot.raw`, grep found no reader across
  every package and test, and it went with the numeric space at S2.6. Whoever wants it is
  re-introducing it, on `domAnchors`' return, not restoring a preserved value.
- **`Span` slot vs core-written text.** `resolveSlot.ts:70` hands a user `Span` component
  `{value: node.text()}` while core also writes `textContent` into the same element. This was
  pre-existing and cosmetic before Cut A; behaviour change 8 made it sharp, because the prop
  can now be stale where the DOM is not. Two owners of one surface is the actual problem, and
  picking one is a public-API decision.
