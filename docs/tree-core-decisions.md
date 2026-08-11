# Tree Core — Decision Record

The S1 tree-core rewrite turned the token tree into the source of truth and the value
string into its projection. **This document is not an architecture guide.** That lives in
`packages/website/src/content/docs/development/architecture.md` (the system) and
`packages/core/src/features/tokens/README.md` (the token layer), with the public shapes in
the generated `packages/website/src/content/docs/api/`.

What follows is only what those documents and the code comments do _not_ carry: the places
the implementation deliberately diverges from the obvious design, the alternatives that were
measured and dropped, the code that looks dead and is not, the gaps no test can hold, and
what is still open. Written against `4d83cad4` and re-verified through S2.9; every entry
below that S2 changed says so in place.

The design spec, the per-phase implementation plans and the spec review record were removed
from the working tree once the work landed. They are unchanged in history:
`git show 4d83cad4:docs/superpowers/plans/2026-08-08-markput-s1-tree-core-v2.md` (the spec),
and its siblings in the same directory.

## Reading the spec citations left in the code

Around 200 comments across `packages/` cite the spec by decision or section number. The
spec is gone from the tree, so here is the decoder. Full text at the ref above.

**An UNPREFIXED `D*` REF IS S1's** — every bare `D1`…`D11`, every bare `§n` and every `AC-*`
in the code points into the table below and nowhere else. S2
(`docs/superpowers/plans/2026-08-10-markput-s2-core-addressing-v1.md`) reuses the same
numbering for different decisions, so its citations always carry an explicit `S2`
(`spec S2 D10`). Where the two could be confused — a comment S2 wrote, or one it moved into
a file it created — the S1 ref is spelled `spec S1 D7` too. Two S1 decisions are now
RETIRED; the table says so and the sections below say where.

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

## The trap list — looks dead, is not

Re-verified at S2.9; the paths below are current. Two S1 entries are struck because the code
they described no longer exists — the note is kept so a reader diffing against history knows
it was deleted deliberately.

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
  react `MarkedInput.tsx` and vue `MarkedInput.vue`. It is also why §5's public invariant
  needs its exact wording — see below.
- **`MarkToken`'s root export** (S2.9) — invisible to grep as a dependency, like
  `SlotRegistry`. It is `denote`'s callback parameter, and `denote` is re-exported by both
  published adapters, so dropping the type (S2.8 did, briefly) leaves a shipped signature
  unnameable from outside. `Token` and `TextToken` are genuinely internal and stay out.

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
  "`MarkputApi` neither takes nor returns one", not as a claim about every export.
