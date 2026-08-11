# S2 Core Addressing — Implementation Plan, Phases S2.4–S2.9

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Finish S2 Core Addressing — cut every consumer over to node anchors, delete
the absolute-offset space above `tree/` (Cut B), then delete the `Token` snapshot
layer and render from `TreeNode` (Cut A).

**Architecture:** S2.1–S2.3 built the mechanism without wiring it: `anchorFor`
exists and is property-pinned against the numeric walk; selection state is split
DOM-free; the commit-time channel is anchor-shaped. These six phases spend that
groundwork — S2.4/S2.5 convert consumers, S2.6 deletes the numeric space, S2.7/S2.8
delete the snapshot, S2.9 kills the construction cycle.

**Tech Stack:** TypeScript (no build step in core), Vitest + jsdom, Playwright
browser mode for storybook suites, pnpm workspaces, oxlint + oxfmt.

**Spec:** [2026-08-10-markput-s2-core-addressing-v1.md](./2026-08-10-markput-s2-core-addressing-v1.md)
(Status: Reviewed). §2.2 D1–D12 and §4 are normative.

**Commit protocol (maintainer's):** per-task commits are code only. Spec and plans
stay uncommitted until the work is done, then are **actualized against what was
actually built** and committed last. When implementation contradicts the spec, the
spec changes — record the divergence.

---

## Calibration note — read this before writing task prompts

Across S2.1–S2.3 the implementing agents corrected **eight** errors in hyper-detailed
task text, four of which would have produced wrong or unshippable work: a type
intersection that left the phase's core invariant as prose, an unreachable test
fixture, a fixture that never bound, an "equivalence property mutation" that was an
equivalent mutant, a falsification fixture that could not falsify, and a two-commit
split that required a red commit.

The lesson is not "write more detail". It is: **specify the constraint and the
falsification, not the keystrokes.** Every task below states what must be true, how
to prove it, and what would disprove it. Where a fixture or a mutation is
prescribed, the prompt must also say *"if this cannot be constructed, that is a
finding — report it rather than forcing it."*

---

## Inherited state (verify before starting)

| Fact | Where |
|---|---|
| `anchorFor(node, offset, affinity?)` — no production caller | `TokenModel`, `DomModel`, `domBoundary.ts` |
| Equivalence property `offsetOf(anchorFor(p)) === boundaryFor(p)` over both pinned grids | `seam/TokenModel.facade.spec.ts` |
| `Selection` = `{stored, range, position, isAllSelected, anchors, select, selectNode, selectAll, repair}` | `tree/selection.ts` |
| `SelectionDriver` — listeners, caret, editable policy, `placeAtHandle`, `focusFirst`, `readRaw` | `dom/SelectionDriver.ts` |
| `SelectionController` — 83-line composition shell, pure delegation | `features/selection/` |
| `TransactionResult.selectionAfter` resolved inside `adopt` pre-mutation | `tree/adopt.ts` |
| `Anchors` lives in `tree/types.ts` | |

**Preconditions from the S2.1–S2.3 review** — the cleanup pass must have landed:
the `untracked` guard on `DomModel.anchorFor` is gated; the child-sequence edge
boundary is self-gating (not dependent on the property S2.6 deletes); `Selection`
has `clear()`. If any is missing, do it first — S2.4 and S2.6 depend on all three.

---

# Phase S2.4 — `sync` onto `anchorFor`; `domAnchors`; the guard deleted

Spec §4.4, D4, D5. **First behavior change of the whole subsystem.**

### Task 1: `SelectionSnapshot` carries the live Range

**Files:** `dom/DomModel.ts`, its spec.

Add `range: globalThis.Range | undefined` to `SelectionSnapshot` — the same object
`#rawSelectionFrom` already reads internally. Leave `raw` in place for now; it is
removed in Task 3 once nothing reads it.

**Gate:** suite count unchanged +1 for the new field's assertion.
**Falsify:** the field must be the *live* range, not a clone — assert that mutating
the window selection is visible through a previously-taken snapshot's `range`. If
that is not true, the field is a copy and `sync` cannot rely on it.

### Task 2: Rewrite `sync`

**Files:** `dom/SelectionDriver.ts`, `dom/SelectionDriver.spec.ts`.

```ts
const sync = (): void => {
  const r = deps.domSelection()?.range
  if (!r) { deps.selection.clear(); return }
  const anchor = deps.anchorFor(r.startContainer, r.startOffset, 'after')
  const head   = deps.anchorFor(r.endContainer,   r.endOffset,   'before')
  if (!anchor || !head) return          // D4: leave stored anchors standing
  deps.selection.select(anchor, head)
}
```

Add `anchorFor` to `SelectionDriverDeps`. Delete the numeric-equality guard and both
recorded-gap comments (`SelectionDriver.ts`, the block currently ~`:185-214`).

**The two exits differ deliberately and both are today's behavior:** no DOM selection
**clears**; an unresolvable boundary **leaves the anchors standing**. Getting these
backwards is the likely bug. Write a case for each.

**Gate:** `pnpm test` including browser. The 8 browser assertions across the react
and vue focus specs are the acceptance gate — they are the only thing that has ever
caught this class of regression.
**Falsify:** re-introduce the guard and confirm the new "far side of a shared
boundary survives a round-trip" case turns red. If it does not, the guard was not
what the case is testing.
**Manual:** click into a mark, tab between marks, sweep-select across a mark
boundary in both the react and vue storybooks. Focus must not be dragged onto the
neighbouring text node — that is the exact failure the deleted guard prevented.

### Task 3: `readRaw` → `domAnchors`

**Files:** `dom/SelectionDriver.ts`, `features/selection/SelectionController.ts`,
and the five call sites (`keyboard/input.ts`, `keyboard/inputRange.ts`,
`keyboard/arrowNav.ts`, `keyboard/blockEdit.ts`, `clipboard/ClipboardController.ts` ×2).

`domAnchors(): Anchors | undefined` composes the same two `anchorFor` calls,
normalized. It answers `undefined` whenever `domSelection()` does.

**This phase converts the read but the call sites still need numbers** — they are
converted in S2.5. So `domAnchors` and the numeric `readRaw` coexist for one phase;
`readRaw` is now `offsetOf ∘ domAnchors`, i.e. resolved in **live** space rather than
bind-generation space.

**Gate:** `input.spec`'s "clears the whole value even when the DOM selection is gone"
must pass **unmodified** — that is `readRaw`'s `undefined` contract and it is the sole
discriminator for `handleDeleteKey`'s all-selected branch.
**Falsify:** make `domAnchors` return a non-`undefined` value when the DOM selection
is gone; that named case must turn red.
**Watch for:** this changes `readRaw`'s coordinate space from bind-generation to
live. The 11 pinned `SelectionSnapshot.raw` assertions in `TokenModel.facade.spec.ts`
and `TokenModel.spec.ts` are the free gate on that change — they must still pass. If
one shifts by a constant, that is the window disagreement showing up and it needs
explaining, not renumbering.

**Review tier:** full-review. Behavior change whose only gate is the browser suite.

---

# Phase S2.5 — Offset-free write and read verbs

Spec §4.5, D6. The widest blast radius in the subsystem.

### Task 4: The write verbs

**Files:** `seam/TokenModel.ts`, `features/edit/EditController.ts`, `store/MarkputApi.ts`.

```ts
TokenModel.replaceBetween(from: NodeAnchor, to: NodeAnchor, text): boolean  // was replace(Range, …)
TokenModel.setValue(text): boolean                                          // was replace({0,-1}, …)
EditController.replace(from: NodeAnchor, to: NodeAnchor, text): void
EditController.setValue(text: string, caretOffset?: number): void           // D6 — THE surviving offset
MarkputApi.setValue(text)                                                   // unchanged, public
```

`replaceBetween` lowers to `applyRange` internally using `offsetOfAnchor` — legal,
it is inside `tree/`. `MarkputApi.#offsetOf` is deleted; `#live` stays (it is an
identity check, not a coordinate one).

**D6 is the scope boundary:** `caretOffset` indexes **the string the caller just
supplied**, computed before that string is parsed, so no node exists to name. It is
not reachable from the public export, so the spec's §5 invariant needs no exception.
`block/operations.ts` is **not touched by this phase**.

**Falsify:** the controlled-mode `caretAt` exemption is measured — dropping it made
`Drag.{react,vue}.spec`'s "backspace on empty row › delete the row and reduce count
by 1" fail in both frameworks. Confirm that case still passes and still fails if the
exemption is removed.

### Task 5: The keyboard path

**Files:** `keyboard/input.ts`, `keyboard/inputRange.ts`, `keyboard/arrowNav.ts`.

- `rangeForDelete` / `adjacentMarkRange` re-expressed on nodes: walk `nodes()`
  comparing anchor adjacency instead of comparing `position.start/end` to a number.
- `inputRange.rawRangeFromInputEvent` → `anchorFor` ×2.
- `arrowNav`'s `readRaw()`-vs-`token.position` comparison → anchor identity against
  the handle's node.
- `placeAtHandle` → `selection.selectNode` + caller-side `alive()`.

**This is the hot path.** Gate: the mark-swallow behavior — type into a text token
immediately before a mark, press Backspace, the mark is swallowed.
**Falsify:** that behavior must break if `adjacentMarkRange`'s adjacency test is
inverted. If it does not, the test is not testing adjacency.

### Task 6: Clipboard, overlay, trigger

**Files:** `clipboard/serializeRange.ts`, `overlay/TriggerFinder.ts`,
`overlay/OverlayController.ts`.

- `serializeRange` trims `TreeNode`s by an anchor pair instead of tokens by a range.
- `TriggerFinder.#rawRangeForMatch` → two `anchorFor` calls.
- `OverlayController.#probeTriggerFromCaretRange` slices the caret node's own
  `text()` instead of slicing `value()` at an absolute cursor.

**OPEN QUESTION, resolve by reading not guessing:** `OverlayMatch.range` is part of
the contract both adapters consume for suggestion replacement. The spec assumes they
pass it straight back into a write verb without inspecting it. **Verify that** across
`packages/react/markput/src` and `packages/vue/markput/src` and the storybook
suggestion suites. If an adapter inspects the numbers, say so — that changes this
task's shape and possibly the public contract.

**Gate:** the storybook suggestion suites; copy a partial selection spanning a mark
and paste it back.

**Review tier:** full-review for all three tasks.

---

# Phase S2.6 — Delete the offset space (**Cut B complete**)

### Task 7: Delete

**Delete:** `tree/offsetShim.ts` + its spec, `TokenModel.replace`, `boundaryFor`,
`rawPositionFromBoundary` and its helpers, `textTargetAt`, `markBoundaryAt`,
`DomModel.placeCaret(n)` / `selectRange(n,n)`, `RawSelection`, `readRaw`,
`SelectionSnapshot.raw`, `#rawSelectionFrom`, `#generation`, the derived numeric
`range`, `MarkputApi.selectionRange()`, and S2.1's equivalence property.

**Add:** `DomModel.placeCaret(anchor)` / `selectRange(anchorA, anchorB)` lowered onto
`TokenHandle.placeCaret(localOffset)`.

**Gate — the checkable form of D1:**
```bash
grep -rn '\.position\.' packages/core/src packages/*/markput/src --include='*.ts*' \
  | grep -vE '/(tree|parser|block)/|blockEdit\.ts'
```
must return nothing. That allowlist is the spec's; any addition to it is a spec
violation, not a convenience.

**Before deleting the equivalence property, confirm every branch it was the sole gate
for has since acquired its own.** The review already found one such branch
(`fromChildAnchor`'s `offset >= childCount`); the cleanup pass should have fixed it.
Re-check by mutating each branch of `anchorFromBoundary` in turn *after* deleting the
property and confirming something still turns red. Any branch that goes silent is a
gate lost — restore a case before committing.

**Review tier:** full-review. This is where a missed consumer surfaces.

---

# Phase S2.7 — `bind` and `commit` on `TreeNode`

Spec §4.7, D7, D9.

### Task 8: Re-point `bind`

Same walk, `TreeNode[]` instead of `Token[]`. The `idFor` indirection and the id
pre-pass throw both go — nodes always have ids.

### Task 9: Text writes become per-node effects

Replace the commit pipeline's text branch with, per bound text node at bind time:
```ts
effect(() => { const t = node.text(); if (el.textContent !== t) el.textContent = t })
```
disposed when the binding is replaced or the node dies. In dev, the same effect
asserts alignment — replacing `assertAligned`.

**ONE WRITER, NOT TWO.** `bind.applyMountState`'s `textContent` write is *subsumed*:
`bind` creates the effect and an effect's immediate first run performs that initial
reconciliation. `applyMountState` keeps only its `contentEditable`/`tabindex` half.
Two writers racing on one surface is the failure mode — the manual check is to type
continuously in a mark's slot while a sibling mark is added, watching for caret jumps.

### Task 10: `TokenHandle` loses its token

Delete `#token`, `refresh()`, `token()`. Its five readers are gone by now:
`domBoundary`'s type/position/content (S2.6), the divergence detector (Task 9),
`setEditable`'s type read (→ `node.kind`), `arrowNav`'s position read (S2.5).

**Falsify:** `assertAligned` has caught real bugs — the S1 merge notes record a sweep
finding 12 divergences, some two generations behind. Confirm the replacement dev
assertion fires on a deliberately introduced divergence. If it cannot, you have
deleted a working check and replaced it with a decorative one.

**Review tier:** full-review. Two DOM writers become one and the failure mode is
silent.

---

# Phase S2.8 — Delete the snapshot (**Cut A complete**)

Spec §4.8, D8, D12. **The riskiest phase in the subsystem.**

### Task 11: Delete the snapshot layer

`tree/snapshot.ts`, `tree/snapshotMemo.ts`, `seam/treeInput.ts`, `seam/commitInput.ts`,
`renderTree`, `keyOf`, `handleOf`, `markFor`. `roots` becomes the render signal.
`snapshot`/`stripIds` and their spec move to `tree/__testing__/` — they are S1 §7.1's
output-equivalence oracle and keep that job.

### Task 12: Adapters render `TreeNode`

~15 files across react and vue, mostly type swaps. `TokenContext` carries
`{store, node, depth}`; `useMark()` becomes a context read; `useMarkInfo` computes
`hasNestedMarks` from `node.children()`. Delete `Token.tsx`'s `sameToken` memo in
favour of per-node subscription.

**THE GATE IS A NUMBER, NOT A GREEN SUITE.** Today's suppression is measured: "101
Mark renders on a head insert at 100 marks, 1 with this" (`Token.tsx`). Write a
render-count case in the storybook browser suites and **match or beat 1**. If
per-node subscription cannot match it, that is the spec's D8 tradeoff coming due —
report the number, do not tune the test.

### Task 13: `block/` type swap

`block/operations.ts` reads `token.slot.content` and builds a `Token` literal
(`EMPTY_TEXT_TOKEN`). Neither has a direct `TreeNode` equivalent — `MarkNode.slot()`
is a method and `slotRange` carries the offsets. **Not mechanical.** `block/` keeps
reading `.position` (D6); only the type changes.

**Review tier:** full-review.

---

# Phase S2.9 — Kill the cycle; docs

### Task 14: `TokenModel` owns the selection

`TokenModel` constructs `selection` and the driver; `SelectionPort`, the thunk and
the TS7022 comment are deleted; `Store` and the five controllers rewired;
`KbCtx` drops `'selection'`; `features/selection/` deleted.

`createSelection`'s dep bag is re-pointed at `#tree` directly — that is the one line
the bag exists to make possible.

**THE DECLARATION-ORDER HAZARD IS A REAL TRAP.** Class field initializers run in
declaration order and `#tree` is declared in the internals region. Declaring
`readonly selection = createSelection(…)` up in the consumer-reads region reads
`#tree` **before it is initialized** — `undefined` at runtime, no type error.

**Verify by falsification, not by assumption:** move `selection` above `#tree` and
confirm a mounted store throws or reads `undefined`. **If it does not, the hazard
analysis is wrong and the layout exception must be dropped**, not kept "to be safe".

### Task 15: `TokenModel.selection()` → `domSelection()`

Five production sites (`TriggerFinder` ×2, `OverlayController` ×2, `blockEdit` ×2)
plus ~20 spec lines. Retires the TS2300 collision documented in two places.

### Task 16: Docs and spec actualization

- `packages/core/src/features/tokens/README.md`
- `docs/tree-core-decisions.md` — S1 D8 and D9 now read "retired at S2"
- `docs/conventions.md` — Established Contracts
- Website docs under `packages/website/src/content/docs/` wherever public API or
  settled architecture changed (AGENTS.md requires this)
- **Actualize the spec** against what was built, then commit spec + both plans
- Delete the two banner-marked superseded files

**Gate:** full gate; the baseline is 1345 passed / 7 todo **plus** whatever S2.4–S2.8
legitimately added, minus what they legitimately deleted — every delta explained.

**Review tier:** full-review. Composition phase; wiring bugs hide here.

---

## Dependency graph

```
S2.4 (sync · domAnchors · guard deleted)
 |
S2.5 (offset-free verbs)          ← Tasks 4/5/6 are sequential; 6 has an open question
 |
S2.6 (delete the offset space)    ← CUT B COMPLETE, independently shippable
 |
S2.7 (bind/commit on TreeNode)
 |
S2.8 (delete the snapshot)        ← CUT A COMPLETE
 |
S2.9 (cycle · docs)
```

Nothing parallelizes. Each phase's gate is "the previous mechanism has no callers
left", which cannot be checked out of order.

**Cut B (through S2.6) is independently shippable and revertible.** If Cut A is
abandoned after it, the result is still a strictly simpler core with one address
space; nothing in S2.4–S2.6 is scaffolding for S2.7–S2.8.

## Standing instructions for every task prompt

1. State the constraint and the falsification, not the keystrokes.
2. Every prescribed mutation must be checked for being an *equivalent* mutant — if
   flipping it leaves the suite green, the mutation proves nothing and the real gate
   is elsewhere.
3. "If this fixture/mutation cannot be constructed, that is a finding — report it
   rather than forcing it."
4. Comments in this codebase record measured findings and name their own gates.
   Moving code moves the pointers. Never leave a comment claiming a gate that does
   not exist.
5. Deletions need a grep across **all** packages, adapters and tests before the claim
   "no consumer" is made.
6. `pnpm test` occasionally fails 3 storybook react files with `SyntaxError: Illegal
   return statement` and 0 tests collected — a pre-existing Vite transform race. It
   fails loudly, so it cannot hide a regression. Re-run and report if seen.
