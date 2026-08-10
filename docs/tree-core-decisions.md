# Tree Core — Decision Record

The S1 tree-core rewrite turned the token tree into the source of truth and the value
string into its projection. **This document is not an architecture guide.** That lives in
`packages/website/src/content/docs/development/architecture.md` (the system) and
`packages/core/src/features/tokens/README.md` (the token layer), with the public shapes in
the generated `packages/website/src/content/docs/api/`.

What follows is only what those documents and the code comments do _not_ carry: the places
the implementation deliberately diverges from the obvious design, the alternatives that were
measured and dropped, the code that looks dead and is not, the gaps no test can hold, and
what is still open. Everything here was re-verified against the tree at `4d83cad4`.

The design spec, the per-phase implementation plans and the spec review record were removed
from the working tree once the work landed. They are unchanged in history:
`git show 4d83cad4:docs/superpowers/plans/2026-08-08-markput-s1-tree-core-v2.md` (the spec),
and its siblings in the same directory.

## Reading the spec citations left in the code

Around 200 comments across `packages/` cite the spec by decision or section number. The
spec is gone from the tree, so here is the decoder. Full text at the ref above.

**An UNPREFIXED ref is S1's** — `spec D7`, `spec §4.6` and the `AC-*` numbers all point
into the table below. S2 (`docs/superpowers/plans/2026-08-10-markput-s2-core-addressing-v1.md`)
reuses the same numbering for different decisions, so its citations carry an explicit
`S2` (`spec S2 D10`). Where the two could be confused — a comment S2 wrote, or one it
moved into a file it created — the S1 ref is spelled `spec S1 D7` too.

| Ref    | What it says                                                                                                |
| ------ | ----------------------------------------------------------------------------------------------------------- |
| `D1`   | Tree is the source of truth; the string is a computed projection.                                           |
| `D2`   | One identity mechanism — `adopt(tree, window, parsed)`, fed either an exact op window or a gap-derived one. |
| `D3`   | Positions are parser-stamped plain fields, written only by adoption. Not reactive.                          |
| `D5`   | Every mutation is a transaction over the `applyRange(window, text)` primitive.                              |
| `D6`   | Controlled mode is stateless: emit, record `lastEmitted {base, value, window}`, adopt on the echo.          |
| `D7`   | Selection stores `NodeAnchor`s; the numeric range is derived. Capture happens **before** adoption.          |
| `D8`   | No public compat artifact; the internal offset shim keeps its own lifetime (see below).                     |
| `D9`   | `TransactionResult` is the single change feed; one owner per datum; handles read bind-generation state.     |
| `D11`  | One node structure (`TextNode \| MarkNode`), public as-is; its signal fields are the public reactive read.  |
| `§1.2` | Non-goals: raw performance, undo, collab, first-class block rows, composition/IME, parser changes.          |
| `§2.3` | The target public API — now shipped as `MarkputApi` plus the node read/write surface.                       |
| `§4.2` | The adoption walks: window-bounded prefix, window-bounded suffix, same-index middle, slot recursion.        |
| `§4.3` | Transaction mechanics (entry guards, `tx` buffering, hull window).                                          |
| `§4.4` | The string boundary: commit policy and arrival routing.                                                     |
| `§4.5` | Selection swap onto anchors.                                                                                |
| `§4.6` | The mechanism ledger — the six named deletions that gated the cutover. All six are gone.                    |
| `§6`   | Error handling: reject before mutation, `false`/`undefined`, throw only on developer error.                 |
| `§7.1` | The output-equivalence property: after every adopt, `snapshot(tree)` deep-equals the parse.                 |
| `§9`   | Future work.                                                                                                |
| `§11`  | Implementation phases S1.1–S1.10. All executed or rejected; of historical interest only.                    |

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

**The internal offset shim survives the rewrite.** `tree/offsetShim.ts` lowers a global
`{start, end}` range onto `applyRange`, with `end < 0` meaning "to the end of the value".
It is not a leftover: block mode, the keyboard and the block controller still address the
document by offsets, and there are seven whole-value call sites across
`features/keyboard/input.ts`, `features/keyboard/blockEdit.ts` and
`features/block/BlockController.ts` (plus `MarkputApi.setValue`). Its lifetime is tied to
first-class block rows, not to the API work — rewriting `block/operations.ts` onto precise
windows is a caret-semantics change with pinned behaviour, not a cleanup.

The shim also does something non-obvious that must not be "simplified" away: a whole-value
op is re-derived through `gapWindow` instead of being passed through as `{0, length}`. Those
callers synthesize a complete new string and have no real edit span, and a full window makes
both adoption walks inert — every row re-pairs by index, so deleting row 2 of three keeps
row 2's node now holding row 3's content while row 3's node dies, moving `BlockController`'s
per-row store onto the wrong row. Gated in `tree/offsetShim.spec.ts`, together with the case
where the narrowing does _not_ help (rows that repeat the separator).

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

**Moving the adapter render loop off `Token[]`.** This was scheduled as a phase and then
dropped, because its premise was false. The sizing argued that moving the loop onto
`input.nodes()` would drag `bind` and `commit` along — 2,481 production and 3,180 spec lines
in the blast radius. It would not: `bindAndAnnounce` binds the commit pipeline's private
`latest` field, deliberately never `renderTree`, so the two are already decoupled. `Token`
survives the move either way — it is the parser's output type and the correctness oracle the
tree specs assert through — and node-based reads already ship with zero adapter change.
Meanwhile the one measurably wrong thing was never the representation: on a structural edit
the snapshot re-materializes every surviving token with only `position` changed, and React's
`memo` reference-compared that into an O(N) fan-out. A ~13-line comparator in
`packages/react/markput/src/components/Token.tsx` fixed it — 101 Mark renders on a head
insert at 100 marks became 1 — gated by a constant bound in
`packages/storybook/src/pages/renderCount.react.spec.tsx`.

## The trap list — looks dead, is not

Re-verified at `4d83cad4`. Several entries moved during the last phases; the paths below are
current.

- **`tree/findGap.ts`** — reads like a helper of the deleted identity layer. `tree/gapWindow.ts`
  imports it, and gap-derived windows are how every boundary arrival and every whole-value
  op finds its edit span. It used to sit in `utils/` where it looked orphaned; it now lives
  next to its only caller.
- **`parser/utils/filterEmptyText.ts`** — an unported requirement, not a leftover.
  `tree/valueBoundary.ts` applies it to every block-mode parse. Its consequence is
  load-bearing elsewhere: block mode has no `TextNode` between rows, which is why
  between-row addressing uses the `{before}`/`{after}` anchor forms.
- **`features/clipboard/serializeRange.ts`** — looks like it could be a string slice. It is
  not. A text token partially in range is sliced, but a _mark_ partially in range is
  returned whole, so copying half a mention yields the complete markup rather than a broken
  fragment. `ClipboardController` is its production caller. Port it if it ever moves; never
  replace it with a slice.
- **`tree/snapshot.ts`** — `snapshot()` itself has no production caller. It is the
  output-equivalence oracle: the property suites assert `snapshot(tree)` deep-equals the
  parse after every adopt, and it is deliberately unmemoized, because a cache inside it
  would gate adoption against its own cache. `materializeNode`, exported from the same file,
  _is_ production — `tree/snapshotMemo.ts` reuses it per node.
- **`SlotRegistry`** (`shared/types.ts`, exported from `packages/core/index.ts`) — zero
  imports anywhere, and invisible to grep as a dependency, because both adapters extend it
  through `declare module '@markput/core'` in their `src/augment.ts`. Drop the export and
  `Slot` collapses to `unknown`, which fails every slot component as a JSX element. A module
  augmentation is not an import.
- **`Store`'s root export** — neither adapter re-exports it by name, which is not the same as
  unused: it is the only resolution path for both, imported as a value and constructed in
  react `MarkedInput.tsx` and vue `MarkedInput.vue`.

**One entry in the original list was wrong.** It claimed `joinNodes` had zero production
callers and survived only as part of the §7.1 gate. It does not: `joinNodes` is the string
projection. `tree/tree.ts` uses it for the `value` computed and for `MarkNode.slot()`, which
is why slot text is never stored and cannot go stale. Deleting it on the strength of that
entry would have deleted D1. Re-verify before trusting any entry here, including these.

## Recorded gaps — do not "fix" these with a decorative test

Each of these is a place where a mutation survived the whole suite. They are recorded at the
site in the code rather than papered over, because in every case the missing test would pin
a choice rather than detect a defect.

- `SelectionController` — the DOM→anchor sync still round-trips through absolute offsets, so
  `readRaw` resolves against bind-generation positions while `anchorAt` resolves against live
  ones, and the two spaces can disagree during the adopt→bind window. **Ungatable**, not
  merely ungated: that window is exactly when no bound surface answers, so a test can neither
  observe the disagreement nor construct it.
- `TokenModel.markFor` — the throw is unfalsifiable. Returning a bogus node instead survives
  the suite; reaching the error path would take a React interleaving that re-renders a mark
  after its node died, which no test can construct.
- `TokenModel`'s single `(value, parser, isBlock)` watch — splitting it into three watches
  survives. Nothing counts `changed` announcements for a simultaneous props change, so wave
  parity is unobserved. The tuple is kept because the pre-cutover shell behaved that way, not
  because a test would notice.
- `TokenModel.applyText`/`tx` — dropping `#ensureSeeded()` survives, because every fixture
  reaches those verbs through a mounted store. Kept for parity with the verbs whose gates
  _are_ the unmounted-store specs.
- `MarkputApi.value()` and `setValue()` — two measured equivalences. Substituting
  `joinNodes(nodes())` for the delegation, and `{0, length}` for the `-1` sentinel, both
  survive the suite, because props and projection agree at every moment a mounted fixture can
  observe. Closing the first needs an unmounted-store case the spec cannot express.
- `tree/offsetShim.ts`'s sub-range pass-through — a design choice (the exact op window), and
  the first assertion that could tell it apart from narrowing is `map`'s fixed point.
- `seam/treeInput.ts`'s memo reuse and its `patch: false` entry for added nodes — inert at
  pipeline level by construction; the reuse pays off only in renderer-side object identity.

## Open

- **Vue slot-mark render fan-out.** Vue is immune for value-only marks — it diffs the
  resolved `{value, meta}` by value — but fans out O(N) at the leaf for _slot_ marks, which
  means block rows and nesting: 101 row-Mark renders at 100 rows, measured. React's fix does
  not transfer; a ~15-line VNode cache was tried and removed the internal work but not the
  row-Mark count, because Vue's unstable slot closure defeats the child-update check. There
  is deliberately no structural fan-out gate in `renderCount.vue.spec.ts` — the React file
  has one and the Vue file does not, which is the asymmetry to look for. Adapter-sized work,
  worth doing only if block-mode typing is reported as slow.
- **`insertMark('caret')` after blur.** The selection controller clears its stored anchors on
  `focusout`, and the derived range goes with them, so the verb rejects whenever focus has
  left the editor — which is every toolbar button that does not suppress its own mousedown.
  The workaround is the standard `onMouseDown` + `preventDefault` pattern, demonstrated in
  `packages/storybook/src/pages/Api/Api.react.stories.tsx`. Fixing it properly means keeping
  a last-known caret across blur, which is a policy decision about what "the caret" means
  when the editor is not focused. Small, but not mechanical.
- **The internal offset shim.** Blocked on first-class block rows, as above. Sized by that
  work, not by itself.
