# Tree Core S1.5 (View Contract) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the commit pipeline consume `TransactionResult` instead of
`ReconcileResult`; give the `changed` event its payload and merge it across a
fold; migrate `BlockController` off the `removedIds()` side channel; add the
D9 compat snapshot memo; pin the bind-generation read semantics — per spec
`2026-08-08-markput-s1-tree-core-v2.md` (v2.2) D9, §4.4, §5 and §11's S1.5
entry.

**Architecture:** ONE pipeline, TWO input lowerings. `commit.ts` stops taking
`ReconcileResult` and takes a new producer-agnostic `CommitInput`; the live
path lowers through `fromReconcile` (deleted at S1.6a with `tokenIdentity`)
and the tree core lowers through `fromTransaction` (unwired in this phase).
See decision **D-a** for why this beats a second pipeline. `bind.ts` and the
rest of the eight-file contenteditable adapter are **not** duplicated and not
deleted — only the pipeline's input changes.

**Tech stack:** TypeScript, the shipped `tree/` modules, the existing
`model/` pipeline, Vitest (core suite runs in Chromium via
`@vitest/browser-playwright` — see `vite.config.ts`).

**Prerequisites:** S1.1–S1.4 complete and committed on `b0`
(`12ead317..4f84cb5c`).

**Plan status:** written 2026-08-09 against a completed S1.4, then
**adversarially verified by implementation**: a throwaway pass implemented
this plan end-to-end and ran it. Every measured claim in the decisions below
was produced against the shipped `tree/` modules in this repo; the transcripts
are reproduced inline.

**Verification status:** the live path is green at every task boundary **only
after the fixes now folded into this document**. Tasks 2, 3, 5 and 6 each
failed as originally written:

- Task 3's first memo test could not pass and asserted a stale-position bug
  (fixed: tail-edit fixture; see the test's own note).
- Task 2 broke `commitInput.spec.ts` and never listed it (fixed: it is in the
  file list and the `git add`).
- Task 5's harness failed `typecheck` (`string[]` vs `Markup[]`) and its
  `paintNested` placeholder was both a lint hard stop and the wrong shape
  (fixed: `Markup[]`; `renderNested()` declared inside `createHarness`).
- Task 6's reversal test was lint-rejected by `unicorn(no-array-reverse)`
  (fixed: `toReversed()`).

With those applied, the full gate after Task 6 measured: `pnpm test` — **73
files, 1267 tests passed**; `typecheck`, `lint:check`, `format:check` and
`build` clean; the **react and vue browser projects actually ran** (not
skipped).

**Decision audit outcome:** all eight decisions (D-a…D-h) hold. **D-d holds
with caveats** — its first memo fixture was wrong (C1) and its `dirty.clear()`
was an ungated guard (M1); both are corrected in Task 3 and Task 6.

Per-task gates include `pnpm run lint:check` from Task 1 onward, because the
pre-commit hook runs `oxlint` with `denyWarnings: true` and a tests-only gate
just defers the failure to `git commit`. **Formatting is a gate too:** every
per-task gate now LEADS with `pnpm run format`, and every commit block repeats
it before staging. It is not optional — `oxfmt --check` rejects the import
order this plan prescribes in `commit.ts` (`./commitInput` sorts before
`./bind`) and rejects the trailing blank line on a freshly created file, and
the pre-commit hook runs it.

---

## Decisions taken before writing this plan (do not re-litigate)

### D-a. Transition mechanics: ONE pipeline with two input lowerings (option b), not two pipelines (option a)

Spec §11's preamble is binding: S1.2–S1.5 build **alongside** the live path,
"no dual pipeline" means no dual *live wiring*, and nothing is deleted before
S1.6a. Two honest options were on the table. **Option (b) is chosen**, in the
specific form "one pipeline, two lowerings":

```
ReconcileResult --fromReconcile--\
                                  >--> CommitInput --> createCommitPipeline.apply
TransactionResult --fromTransaction--/
```

Why, with evidence:

1. **`bind.ts` needs zero changes, so option (a) would duplicate 257 lines
   for nothing.** `bind` consumes `{tokens: readonly Token[], idFor}` and
   throws when `idFor(token)` is `undefined` (`bind.ts:126-128`).
   `tree/snapshot.ts` stamps `id: node.id` on **every** materialized token
   (`snapshot.ts:16`, `:33`), so a memoized snapshot tree satisfies bind's
   contract with `idFor: token => token.id`. `applyMountState` reads
   `token.content`, which snapshot also always fills. Verified by reading
   both files: there is no field bind touches that snapshot does not produce.
2. **The behaviors §11 lists as "must survive intact" (fold guard, self-heal
   escalation, `assertAligned`, mount/editable seeding, control roots, block
   rows) live in exactly one place today.** Forking them means two copies
   that can drift silently between S1.5 and S1.6a; the reviewers would have
   to diff 680 lines by eye. With one pipeline they are structurally
   identical by construction.
3. **It buys a real cutover gate.** The same harness can be driven through
   both lowerings and asserted to produce identical DOM, handle identity and
   event counts. Option (a) offers no such proof.
4. **AGENTS.md** forbids forking a near-duplicate ("Upgrade a close existing
   abstraction instead of forking a near-duplicate") and requires each task
   to be green — which option (b) satisfies because the live path keeps
   running through `fromReconcile` at every commit boundary.

**The awkward case named in the brief — `commit.ts`'s live text branch calls
`handle.update()` — dissolves under (b):** both lowerings feed the same
branch, and the branch's call becomes `handle.refresh(token)` (see D-c). No
handle class is forked.

**What S1.5 touches on the LIVE path, deliberately and with a call-out:**
exactly two things — the `changed` event gains a payload (additive; the two
production subscribers are `SelectionController.ts:44`, which ignores the
argument, and `BlockController.ts:40`), and `BlockController` switches to
that payload. Both are behavior-preserving and gated by existing specs
(`BlockController.spec.ts:110-140`, `TokenModel.changed.spec.ts`). Everything
tree-side (`snapshotMemo`, `treeInput`) has no live caller until S1.6a.

### D-b. `TokenHandle` is NOT node-backed in S1.5 — a deliberate deviation from the roadmap's scope line

Spec §11's S1.5 line says "`TokenHandle` as node-backed view **with
bind-generation position cache**". The second half is the requirement; the
first half has no caller in this phase and would be mirrored state.

**Proven:** the bind-generation read semantics D9 demands are *already*
delivered by the existing `#token` field, and they come for free once the
pipeline is fed memoized snapshots.

- The whole DOM boundary layer resolves positions through
  `BoundaryContext.tokenOf(view)` → `handle.token()` (`DomModel.ts:93-95`),
  and reads `token.position.start` (`tokens/boundary.ts:55`, `:69`, `:73`,
  `:85-90`, `:102`, `:111`, `:115`, `:134`, `:150` — the DOM boundary layer,
  **not** `tokens/tree/boundary.ts`). `SelectionController.ts:78,121` reads
  the same field.
- A handle's `#token` is written only by `bind` (`bind.ts:87`) and by the
  text branch (`commit.ts:149`). The text branch patches the DOM in the same
  `batch`, and the structural branch writes nothing until its bind. So
  `handle.token().position` is, by construction, the generation currently
  painted.
- If the handle instead held the live `TreeNode`, `node.position` would be
  adoption-fresh during the adopt→bind window and every caret/boundary read
  would resolve against a layout the DOM has not painted. Task 6 pins this
  with a measurement, not a comment.

**Consequences, stated so S1.6a does not rediscover them:** the id→node
lookup the write path needs belongs on the tree (`input.find(id)`, §2.3), not
mirrored on every handle; `MarkController` onto `applyStructural` and
`useMark()` returning a `MarkNode` are the phases that gain the caller
(S1.6a/S1.7). `#token`/`update()` still die in S1.6d exactly as D9 says, at
which point the bind-generation cache narrows to a `{start, end}` stamp.
**This is a deliberate choice, not an oversight** — flag it in the S1.5
review.

### D-c. The text branch stops refreshing `#path`, and that is provably safe

Today `commit.ts:149` calls `handle.update(token, path)` on the text branch.
S1.5 replaces it with `handle.refresh(token)` (token only).

**Proof that paths cannot move on a text-routed commit:** the text branch
runs only when the routing bit is false. On the tree path that bit is
`render = structural || updated.some(node => node.kind === 'mark')` and
`structural = added.length > 0 || removed.length > 0` (`adopt.ts:197-198`),
so `!render` ⇒ no node was added or removed anywhere ⇒ every sibling list
keeps its length and order ⇒ every path is unchanged. On the live path
`ReconcileResult.structural` is set by an add (`tokenIdentity.ts:318`), a
removal (`:325`) or a refused-descend mark (`:153`), so `!structural` ⇒ no
add/remove ⇒ same conclusion.

**Interaction with the S1.6d latent bug (`#path`'s three surviving readers —
`keyboard/blockEdit.ts:32`, `keyboard/arrowNav.ts:35`,
`model/commit.ts:211`):** this change *reduces* `update()`'s callers from two
to one (`bind.ts:87`), which is the correct writer — bind is the only moment
a path can legitimately move. It does **not** freeze `#path`, and it does not
change what the three readers see. S1.6d's obligation (retire the readers
with the writer) is unchanged.

**Honest gap:** no test can discriminate this change, precisely because the
paths are equal either way. Task 6 records it as an ungated-by-construction
mutation rather than shipping a decorative test.

### D-d. Snapshot memoization (D9): dirty-set + child-reference comparison, in a new `tree/snapshotMemo.ts`, applied eagerly at adoption

**Where.** A new module `tree/snapshotMemo.ts`. `tree/snapshot.ts` stays a
pure, unmemoized function because it **is** the §7.1 output-equivalence gate
(`adopt.property.spec.ts`, `snapshot.spec.ts`); a memo inside it would gate
adoption against its own cache. `snapshot.ts` is split so both share one
serializer: `materializeNode(node, children)` becomes exported and `snapshot`
becomes its recursive, allocating caller.

**How it is invalidated from the delta.** Two mechanisms, both load-bearing,
each with a measured fixture:

1. **Explicit dirty ids** from `updated`, plus `shifted` **walked
   subtree-inclusively**, plus cache eviction for `removed` (which is already
   flattened). `added` needs nothing — a fresh node has no cache entry.
   *Why the subtree walk:* `shifted` carries subtree ROOTS only
   (`types.ts:74-81`), and a root's delta is **not** its descendants'.
   Measured on `@[__value__](__slot__)`, `'@[x](ab)t'` → `'@[xy](ab)t'`:

   ```
   BEFORE  text#1@[0,0]  mark#2@[0,8]  ( text#3@[5,7] )  text#4@[8,9]
   AFTER   text#1@[0,0]  mark#2@[0,9]  ( text#3@[6,8] )  text#4@[9,10]
   shifted [text#4, mark#2]        updated [mark#2]
   ```

   `mark#2`'s start delta is 0 while `text#3`'s is +1, and `text#3` appears
   in neither feed. A memo that dirties only the listed ids returns `text#3`
   cached at `[5,7]`.
2. **Child-reference comparison** at materialization: a cached mark token is
   reused only if every child token came back reference-identical. This is
   what invalidates ANCESTORS, and it is not optional — `TreeNode` has no
   parent link (`types.ts:26-40`), so there is nothing to walk upward.
   Measured on `#[__slot__]`, `'#[ab]t'` → `'#[cb]t'` (length-preserving):

   ```
   window {"start":2,"end":3,"insertedLength":1}
   updated text#3        shifted (empty)        structural false render false
   after: mark content '#[cb]'  slot {"content":"cb","start":2,"end":4}  position {0,5}
   ```

   The mark is in NEITHER feed and did not move, yet its `content` and
   `slot.content` both changed. Only the reference comparison catches it.

**Why synchronously at adoption.** Spec §4.4 requires `tokens.current()` to
stay consistent with `value.current()`, and the live code depends on it:
`BlockController.ts:31-35` reads `this.value.current()` and
`this.tokens.current()` in the same breath and slices the value by token
positions ("*tokens() is the reconciled tree consistent with value.current()
at drop time*"); `keyboard/blockEdit.ts:24,71,123,159,185`,
`keyboard/input.ts:100`, `keyboard/arrowNav.ts:51`,
`clipboard/ClipboardController.ts:43` and `SelectionController.ts:66,130` do
the same. `value.current()` is `join(tree)` and moves the instant adoption
mutates the nodes, so a lazily-refreshed snapshot would let those seven call
sites slice a new string with old offsets. `fromTransaction` therefore
invalidates and materializes inside the `onResult` callback, which
`parseAndAdopt` fires immediately after `adopt` (`adopt.ts:26-29`).

**The renderer claim in D9 is only partly true — see the Contradictions
section.** The memo is still worth building, for the reason recorded there.

### D-e. `shifted` is UNORDERED; the DOM refresh does not depend on order

**Measured ordering** (matching the roadmap): the suffix run arrives in
reverse-document order, then middle-region entries in document order.
`'a@[x](m)b@[y](m)c@[z](m)d'` → `'ZZa@…'`:
`shifted = [text#10, mark#8, text#7, mark#5, text#4, mark#2, text#1]`.
Whole-value re-splice, suffix walk inert:
`shifted = [text#1, mark#2, text#4, mark#5, text#7, mark#8, text#10]` — pure
document order, all **seven** roots.

(Both id runs skip 3, 6 and 9: those are the marks' slot children, which are
not roots and are never pushed into `shifted` themselves. An earlier draft of
this decision numbered the roots consecutively and reported the re-splice as
five entries — the *ordering* claims were right, the ids and the count were
not.)

**The refresh does not depend on it.** `commit.ts`'s text branch performs, per
entry, one `handle.refresh(token)` and one conditional
`surface.textContent = token.content` (`commit.ts:147-152`). Both are
absolute assignments to per-node-disjoint targets: `adopt` pushes each node
into `shifted` at most once (`adoptPosition`, `adopt.ts:102-108`), the
`covered` flag suppresses descendants of an entry, and the root-level suffix
walk only ever pushes top-level nodes. Nothing accumulates.

**Decision: document it as unordered, and pin it with a reversal test.** The
test cannot fail against the implementation this plan specifies — it exists to
fail against a *future* stateful refresher (one that applies a delta rather
than re-reading absolute positions). Task 6 says so in the test's own comment
rather than pretending it is a defect gate. The genuinely discriminating
guard for the delta-vs-absolute question is D-d's `'@[x](ab)t'` fixture,
which is a real assertion.

### D-f. The result feed stays on the boundary; do NOT hoist it to the dispatcher

The roadmap says the feed "currently hangs off `createUncontrolledSink`'s
`onResult`" and suggests hoisting to the dispatcher. **Both halves are stale
as of S1.4.** `createUncontrolledSink` no longer exists — grep
`transactions.ts`; adoption moved into `parseAndAdopt` (`adopt.ts:18-30`) and
the feed onto `createBoundary({onResult})` (`tokens/tree/boundary.ts:36-37`).
**Every `boundary.ts` citation in this decision is `tokens/tree/boundary.ts`,
the S1.4 string boundary — not the same-named DOM boundary layer at
`tokens/boundary.ts`, which this plan does not touch.**

**The boundary feed already covers both paths, and the dispatcher cannot.**
`tree/boundary.ts` routes every adoption through one `fold` helper (`:46-47`), so
`onResult` fires for the uncontrolled commit (`:64`), the controlled echo at
`arrive` (`:90`) and `reparse` (`:105`). The dispatcher
(`transactions.ts:85-92`) only ever sees `sink.commit`; a controlled echo
arrives through props, never through a verb, so a dispatcher-level feed would
miss exactly the controlled path — the one the roadmap was worried about.

**Decision: keep `onResult` where it is.** S1.5's consumer subscribes once, at
the boundary. Two notes for S1.6a: `onResult` is a single optional callback,
not a multicast event — that is sufficient, because the pipeline is the one
consumer and it fans out internally; and the uncontrolled sink calls
`fold(next, window)` *before* `onChange(next)` (`tree/boundary.ts:64-65`), so the
DOM patch and the `changed` announcement precede the parent's `onChange`.
S1.6a owns whether that ordering matches today's.

### D-g. `render` is the routing bit for BOTH branches; `structural` routes nothing in S1.5

`adopt.ts:197-198`:

```ts
const structural = added.length > 0 || removed.length > 0
const render = structural || updated.some(node => node.kind === 'mark')
```

Exhaustively mapped against today's `ReconcileResult.structural`, which is set
by an add (`tokenIdentity.ts:318`), a removal (`:325`), or a refused-descend
MARK (`:153`) — i.e. exactly `render`, not `structural`. Measured, with the
matching live-path spec:

| edit | `structural` | `render` | today's routing | pinned by |
| --- | --- | --- | --- | --- |
| interior text edit `he@[x]llo` → `…llo!` | false | false | text branch | `commit.spec.ts:107` |
| prepend shifting every root | false | false | text branch | `commit.spec.ts:160` |
| in-slot edit `#[ab]tail` → `#[aXb]tail` | false | false | text branch | `commit.spec.ts:611` |
| **mark value `@[x]` → `@[y]`** | **false** | **true** | **structural** | `commit.spec.ts:389` |
| mark removal | true | true | structural | `commit.spec.ts:259` |
| no-op | false | false | text branch | `commit.spec.ts:185` |

Routing on `structural` would send row 4 down the text branch, where the mark
has no text surface, `commitText` would `return false` and self-heal — a
different event/latch shape than `commit.spec.ts:389-426` pins. `adopt.spec.ts:452`
already records the same conclusion in a comment ("*reconcile forced
`structural` for a refused descend; the routing datum is now `render`*").

The same bit drives everything the old `structural` drove: the text/structural
fork, the `pendingStructural` latch, and the `renderTree` publication (D9:
"the renderTree reference changes iff `render` is set" — true by construction,
since only `commitStructural` writes it).

**`TransactionResult.structural` therefore has no consumer in S1.5.** Say so
in the review rather than inventing one. It stays in the type: it is asserted
by `adopt.spec.ts:26,79,158` and `adopt.property.spec.ts:232`, and S1.6a/S1.7
may want the narrower bit. Do not "clean it up" here.

### D-h. `map()` is NOT composed into the fold in S1.5

D9 says the fold should "merge `added`/`removed`/`updated` and compose `map()`
for the single deferred `changed`". The `changed` payload §2.3 actually
specifies is `{added: Id[]; removed: Id[]; updated: Id[]}` — no `map`. `map`'s
consumer is caret repair, which needs `selectionBefore` (hardcoded
`undefined`, `types.ts:83-94`) and lands in S1.6c. Composing `map` now would
be public surface with no caller, which AGENTS.md forbids, and it cannot be
tested end-to-end without S1.6a's capture hook. **S1.5 merges the three id
lists and nothing else; S1.6c composes `map` when it gains the consumer.**

---

## File structure

**Create:**

- `packages/core/src/features/tokens/model/commitInput.ts` — `CommitInput`,
  `CommitChange`, `TokenDelta`, `fromReconcile`. The seam D-a introduces.
- `packages/core/src/features/tokens/model/commitInput.spec.ts`
- `packages/core/src/features/tokens/tree/snapshotMemo.ts` — D-d's memo.
- `packages/core/src/features/tokens/tree/snapshotMemo.spec.ts`
- `packages/core/src/features/tokens/model/treeInput.ts` — `fromTransaction`.
- `packages/core/src/features/tokens/model/treeInput.spec.ts`
- `packages/core/src/features/tokens/model/treePipeline.spec.ts` — the
  parity suite driving the SAME pipeline through the tree lowering.

**Modify:**

- `model/commit.ts` (227) — input type, `render` routing, payload + fold.
- `model/TokenHandle.ts` (196) — add `refresh(token)`; `update` delegates.
- `model/TokenModel.ts` (293) — wrap `#reparse`'s call, retype `changed`.
- `tree/snapshot.ts` (56) — export `materializeNode`; `snapshot` calls it.
- `features/block/BlockController.ts` (54) — subscribe to the payload.
- Specs: `model/commit.spec.ts` (681), `model/TokenHandle.spec.ts` (305),
  `tokens/TokenModel.changed.spec.ts` (167),
  `block/BlockController.spec.ts` (139),
  **`model/commitInput.spec.ts`** — created in Task 1 and **edited again in
  Task 2**, because Task 2 replaces `CommitInput.removedIds` with
  `delta: TokenDelta` (see Task 2's file list; an earlier draft omitted it and
  the task failed both Vitest and `typecheck`).

**Stale docs this plan must update as it goes** (schedule, not optional — they
assert things that stop being true in this phase):

- `commit.ts:120-121`, `commitText`'s JSDoc: "*Reconcile already resolved every
  change to (id, token, path) and decided routing — `result.structural` was
  false*". After Task 1 the pipeline has no idea a reconcile ran and there is
  no `path` on a change. Rewritten in **Task 1 Step 5**.
- `TokenModel.changed.spec.ts:45`, `:66`, `:85` — "*the event is payloadless
  (Phase 2)*". False after Task 2. Rewritten in **Task 2 Step 5**.

**Do NOT touch:** `model/bind.ts` and `model/bind.spec.ts` (D-a §1 — input
compatible, zero changes), `tokens/boundary.ts` (the DOM boundary layer;
`tokens/tree/boundary.ts` is also unmodified, but Task 5's parity harness
imports it), `DomModel.ts`, `caret.ts`,
`textOffsets.ts`, `editableState.ts`, `tokenIdentity.ts`, `ValueModel.ts`,
`Store.ts`, any adapter, or `features/tokens/index.ts` (no barrel change —
every new symbol is internal).

**Size (touch surface, per the spec's instruction — the net-new number has
been under-called twice):**

| | lines |
| --- | --- |
| Production read + verified | 1,027 (`commit` 227 + `bind` 257 + `TokenHandle` 196 + `TokenModel` 293 + `BlockController` 54) |
| Specs read + verified | 2,364 (`commit.spec` 681 + `bind.spec` 684 + `TokenHandle.spec` 305 + `TokenModel.spec` 388 + `TokenModel.changed.spec` 167 + `BlockController.spec` 139) |
| Production **edited** | ~110 |
| Production **net-new** | ~225 |
| Spec **written** | ~1,010 |

Correction to the spec's estimate, with evidence: it budgets "~1,670 lines of
`model/*` specs to `TransactionResult` shapes". Measured, the four files are
2,058 lines — but **`bind.spec.ts` (684) needs no migration at all** (it
drives `bind` with plain `Token[]` and its own id map, which is exactly a
memoized snapshot's shape), and **`TokenModel.spec.ts` (388) needs none
either** (it exercises the live shell, which keeps working through
`fromReconcile`; its `watch(model.changed, changeset => …)` at `:166` already
takes an argument). The real migration is ~40 mechanical lines in
`commit.spec.ts` plus new suites.

---

### Task 1: `CommitInput` — one seam, two lowerings (live path only)

**Files:**
- Create: `model/commitInput.ts`, `model/commitInput.spec.ts`
- Modify: `model/commit.ts`, `model/TokenHandle.ts`, `model/TokenModel.ts`,
  `model/commit.spec.ts`, `model/TokenHandle.spec.ts`

This task is a **pure refactor**: the live suite must stay green with no
assertion changes beyond the three `pipeline.apply(...)` call sites.

- [ ] **Step 1: Write the failing test**

```ts
// packages/core/src/features/tokens/model/commitInput.spec.ts
import {describe, expect, it} from 'vitest'

import {markToken, textToken} from '../__testing__/tokenFactories'
import {fromReconcile} from './commitInput'

describe('fromReconcile', () => {
	it('lowers reconcile `structural` to the `render` routing bit', () => {
		// The names differ on purpose: the tree core reserves `structural` for
		// add/remove only, while reconcile's flag also covers a refused-descend
		// mark. `render` is the union — the bit the pipeline has always routed on.
		const token = markToken('y', '@[y]', 2)
		const input = fromReconcile({
			tokens: [token],
			structural: true,
			changes: [{id: 4, token, path: [0], kind: 'text'}],
			removedIds: [],
		})
		expect(input.render).toBe(true)
		expect(input.tokens).toEqual([token])
	})

	it("maps kind 'update' to a refresh-only change and everything else to a patch", () => {
		const a = textToken('a', 0)
		const b = textToken('b', 1)
		const c = textToken('c', 2)
		const input = fromReconcile({
			tokens: [a, b, c],
			structural: true,
			changes: [
				{id: 1, token: a, path: [0], kind: 'text'},
				{id: 2, token: b, path: [1], kind: 'update'},
				{id: 3, token: c, path: [2], kind: 'add'},
			],
			removedIds: [9],
		})
		expect(input.changes).toEqual([
			{id: 1, token: a, patch: true},
			{id: 2, token: b, patch: false},
			{id: 3, token: c, patch: true},
		])
		expect(input.removedIds).toEqual([9])
	})
})
```

Hand-traced: `patch: change.kind !== 'update'` reproduces `commit.ts:132-144`
exactly — `'update'` entries are skipped-not-missed when unbound, everything
else escalates on a missing handle.

- [ ] **Step 2: Run to verify failure**

Run: `pnpm -w exec vitest run packages/core/src/features/tokens/model/commitInput.spec.ts`
Expected: FAIL — `./commitInput` not found.

- [ ] **Step 3: Create `commitInput.ts`**

```ts
// packages/core/src/features/tokens/model/commitInput.ts
import type {Token} from '../parser/types'
import type {ReconcileResult} from '../tokenIdentity'

/**
 * One handle refresh the text branch performs. `patch` also writes the DOM
 * surface; without it the entry is a position-only refresh (reconcile's
 * `kind: 'update'`), which is SKIPPED rather than escalated when the id has no
 * handle yet — an unrendered token has no surface to patch.
 */
export type CommitChange = {readonly id: number; readonly token: Token; readonly patch: boolean}

/**
 * What {@link CommitPipeline.apply} consumes — deliberately producer-agnostic
 * (spec §11 transition mechanics). The live path lowers a `ReconcileResult`
 * here; the tree core lowers a `TransactionResult` in `treeInput.ts`. S1.6a
 * deletes the first lowering along with `tokenIdentity`, and the pipeline never
 * learns which one ran.
 */
export type CommitInput = {
	/** The tree bind projects onto the node layer and the renderer paints. */
	tokens: Token[]
	/**
	 * THE routing bit (spec D9). Not `TransactionResult.structural`, which is
	 * add/remove ONLY: a mark whose value or meta changed adds and removes
	 * nothing, yet must reach the renderer because mark components render those
	 * as framework props. `render` is that union.
	 */
	render: boolean
	/**
	 * Handle/DOM refreshes for the text branch. ORDER IS NOT SIGNIFICANT: every
	 * entry is an absolute write to a distinct node (see treeInput.ts).
	 */
	changes: readonly CommitChange[]
	/** Ids gone from the tree, subtree-inclusive. */
	removedIds: readonly number[]
}

/**
 * The live path's lowering. Deleted with `tokenIdentity` at S1.6a.
 *
 * `result.structural` already IS the render bit: reconcile sets it for an add
 * (tokenIdentity.ts:318), a removal (:325) and a refused-descend MARK (:153).
 */
export function fromReconcile(result: ReconcileResult): CommitInput {
	return {
		tokens: result.tokens,
		render: result.structural,
		changes: result.changes.map(change => ({
			id: change.id,
			token: change.token,
			patch: change.kind !== 'update',
		})),
		removedIds: result.removedIds,
	}
}
```

- [ ] **Step 4: Add `TokenHandle.refresh` and delegate `update`**

Replace `TokenHandle.ts:162-167` with:

```ts
	/**
	 * @internal Refresh the BIND-GENERATION token: the content and positions that
	 * describe what the DOM currently shows (spec D9). Written by the text branch,
	 * which patches the surface in the same batch, and by bind. Between a
	 * structural apply and its bind nothing writes it — that is the property every
	 * DOM-boundary read depends on (tokens/boundary.ts resolves offsets against
	 * `token.position`). Inert on a dead handle.
	 */
	refresh(token: Token): void {
		if (this.#dead) return
		this.#token = token
	}

	/**
	 * @internal Refresh token AND path. Bind is the only caller: a path can only
	 * move when a node is added or removed, and such a commit never reaches the
	 * text branch (spec D9's `render` bit is set for both).
	 */
	update(token: Token, path: TokenPath): void {
		if (this.#dead) return
		this.refresh(token)
		this.#path = [...path]
	}
```

Append to `TokenHandle.spec.ts`'s `describe('update', …)`:

```ts
		it('refresh() moves the token without touching the path', () => {
			const handle = new TokenHandle(1, textToken('hello', 0), [0])

			const next = textToken('hello!', 0)
			handle.refresh(next)

			expect(handle.token()).toBe(next)
			expect(handle.path()).toEqual([0])
		})

		it('refresh() is inert on a dead handle', () => {
			const token = textToken('hello', 0)
			const handle = new TokenHandle(1, token, [0])
			handle.kill()

			handle.refresh(textToken('zombie', 0))

			expect(handle.token()).toBe(token)
		})
```

- [ ] **Step 5: Retarget the pipeline**

In `commit.ts`, replace the `tokenIdentity` import with
`import type {CommitChange, CommitInput} from './commitInput'`, retype
`CommitPipeline.apply(input: CommitInput): void`, and rewrite the two
functions:

```ts
	function apply(input: CommitInput): void {
		if (committing) throw new Error('TokenModel commit re-entry')
		committing = true
		try {
			const {tokens, render, changes, removedIds} = input
			latest = tokens
			// Routing decided by the producer (spec D9's `render` bit). The one
			// commit-side override is the fold guard: while a structural apply
			// awaits its bind the node layer is one generation stale, so EVERY
			// apply folds into the pending structural pass (fail-closed — no
			// half-patch against a tree the DOM never showed).
			if (!pendingStructural && !render) {
				if (commitText(changes, removedIds)) return
				commitStructural(tokens, removedIds, true)
				return
			}
			commitStructural(tokens, removedIds, false)
		} finally {
			committing = false
		}
	}
```

Rewrite `commitText`'s JSDoc while you are in it — the shipped one
(`commit.ts:118-125`) asserts two things this task falsifies: that "*Reconcile
already resolved every change to (id, token, path)*" (there is no `path` on a
`CommitChange`, and the producer is now unknown to the pipeline) and that
"*`result.structural` was false*" (the bit is `input.render`, and the producer
may be either lowering):

```ts
	/**
	 * Text branch: the adapter never re-renders (tree keeps its reference), so
	 * bound elements and paths stay live. The PRODUCER resolved every change to
	 * (id, token, patch) and decided routing — `input.render` was false, so no
	 * node was added or removed anywhere and every path is unchanged (spec D9;
	 * plan D-c). Two passes: resolve every change to a live handle/surface PURELY
	 * first; ANY miss abandons the branch before a single mutation and the caller
	 * escalates structurally.
	 */
	function commitText(changes: readonly CommitChange[], removedIds: readonly number[]): boolean {
		// surface is set only for patch entries; absent → refresh-only (no DOM write).
		const updates: {handle: TokenHandle; token: Token; surface?: HTMLElement}[] = []
		for (const change of changes) {
			const handle = deps.nodes.get(change.id)
			if (!change.patch) {
				// Never bound yet (a handle materializes on the next bind) — skip, not a
				// miss: an unrendered token has no surface to patch.
				if (handle) updates.push({handle, token: change.token})
				continue
			}
			if (!handle) return false
			const surface = handle.node()?.textElement
			if (!surface) return false
			updates.push({handle, token: change.token, surface})
		}

		batch(() => {
			for (const {handle, token, surface} of updates) {
				// Token only: paths cannot move on a text-routed commit, because the
				// routing bit is set by every add and every removal.
				handle.refresh(token)
				if (surface && surface.textContent !== token.content) surface.textContent = token.content
			}
		})
		if (VERIFY_DOM) assertAligned()
		lastRemovedIds = removedIds
		changed()
		return true
	}
```

Note the deleted `path` field on `updates` and the deleted `TokenPath` usage
there — `TokenPath` is still imported for `CommitDeps.childSequenceHostsFor`,
so **do not** remove that import (`eslint/no-unused-vars` is error-level and
`denyWarnings: true` makes an over-eager removal a hard stop the other way).

**Import order:** `./commitInput` sorts *before* `./bind`, so dropping the new
import next to the old `tokenIdentity` one fails `oxfmt --check`. Do not
hand-place it — Step 8's `pnpm run format` fixes it, and
`pnpm run format:check` in the gate surfaces it before the commit hook does.

In `TokenModel.ts`, wrap the call at `:208`:

```ts
		this.#pipeline.apply(fromReconcile(this.#identity.reconcile(tokens, hint)))
```

with `import {fromReconcile} from './commitInput'`.

- [ ] **Step 6: Migrate `commit.spec.ts`'s three apply sites**

Add `import {fromReconcile} from './commitInput'`; in `createHarness` and
`createSlotHarness` change `pipeline.apply(result)` to
`pipeline.apply(fromReconcile(result))`; and at `:498` wrap the synthesized
literal:

```ts
			pipeline.apply(
				fromReconcile({
					tokens,
					structural: false,
					changes: [{id: 99999, token: tokens[0], path: [0], kind: 'text'}],
					removedIds: [],
				})
			)
```

No other assertion in the file changes — including `:133`
`expect(tail.path()).toEqual([2])` and `:653`
`expect(tailHandle.path()).toEqual([2])`, which stay green under D-c because
those commits add and remove nothing.

- [ ] **Step 7: Gate**

Run: `pnpm run format && pnpm -w exec vitest run packages/core && pnpm run typecheck && pnpm run lint:check`
Expected: PASS, with **zero** behavioral assertions changed.

(`pnpm run format` leads every gate in this plan. The import order above and
the trailing newline on the two new files both fail `oxfmt --check`, and the
pre-commit hook runs it — a gate that formats first never defers that failure
to `git commit`.)

- [ ] **Step 8: Commit**

```bash
pnpm run format
git add packages/core/src/features/tokens/model/commitInput.ts \
        packages/core/src/features/tokens/model/commitInput.spec.ts \
        packages/core/src/features/tokens/model/commit.ts \
        packages/core/src/features/tokens/model/commit.spec.ts \
        packages/core/src/features/tokens/model/TokenHandle.ts \
        packages/core/src/features/tokens/model/TokenHandle.spec.ts \
        packages/core/src/features/tokens/model/TokenModel.ts
git commit -m "refactor(tokens): S1.5 CommitInput seam — pipeline routes on the render bit"
```

---

### Task 2: `changed` gains its payload, the fold merges it, BlockController migrates

**Files:** modify `model/commitInput.ts`, **`model/commitInput.spec.ts`**,
`model/commit.ts`, `model/TokenModel.ts`, `block/BlockController.ts`,
`model/commit.spec.ts`, `tokens/TokenModel.changed.spec.ts`.

**`commitInput.spec.ts` is not optional.** Task 1 wrote
`expect(input.removedIds).toEqual([9])` into it; this task deletes
`CommitInput.removedIds`, so that spec fails at runtime *and* at `typecheck`
until it is migrated (Step 3 below). It is also the **only** gate on the
lowering's delta mapping — mutating `fromReconcile`'s `updated` to `[]` leaves
the entire rest of the suite green.

**This task changes live behavior twice — both must be in the commit body per
AGENTS.md:** (1) `changed` carries `{added, removed, updated}`; (2) the
pending window now MERGES deltas instead of overwriting, which fixes a real
leak — **a reproduced bug, not a hypothesis**; see the trace in Step 1.

- [ ] **Step 1: Write the failing tests**

```ts
// append to commit.spec.ts — needs `import type {TokenDelta} from './commitInput'`
	describe('changed payload (spec §2.3) and fold merging (D9)', () => {
		it('merges the removals of every apply folded into one pending structural pass', () => {
			// 'a@[x]b@[y]c' → text 'a'[0,1], mark '@[x]'[1,5], text 'b'[5,6],
			// mark '@[y]'[6,10], text 'c'[10,11] — five spans, byPath '0'..'4'.
			const harness = createHarness()
			const {pipeline} = harness
			harness.apply('a@[x]b@[y]c')
			harness.render()
			const markX = pipeline.byPath().get('1')
			const markY = pipeline.byPath().get('3')
			if (!markX || !markY) throw new Error('expected both mark handles')
			let payload: TokenDelta | undefined
			watch(pipeline.changed, delta => {
				payload = delta
			})

			// Two structural applies, ONE bind. The overwrite this replaces
			// (`pendingRemovedIds = removedIds`) dropped the FIRST removal, so
			// BlockController never pruned that row's drag state — a real leak.
			harness.apply('ab@[y]c') // drops @[x]
			harness.apply('abc') // drops @[y]
			harness.render()

			expect(payload?.removed).toContain(markX.id)
			expect(payload?.removed).toContain(markY.id)
		})

		it('a node added and removed inside one pending window is announced as neither', () => {
			const harness = createHarness()
			const {pipeline} = harness
			mountValue(harness)
			let payload: TokenDelta | undefined
			watch(pipeline.changed, delta => {
				payload = delta
			})

			harness.apply('he@[x]llo@[y]') // adds the mark and its trailing empty text
			const addedId = pipeline.renderTree()[3]?.id
			harness.apply('he@[x]llo') // takes them straight back out
			harness.render()

			// Ids are never reused, so composition is exact: a consumer that never
			// saw the node must not be told to prune it either.
			expect(addedId).toBeDefined()
			expect(payload?.added).not.toContain(addedId)
			expect(payload?.removed).not.toContain(addedId)
		})

		it('announces the edited id as updated on the text branch and nothing on a bare re-bind', () => {
			const harness = createHarness()
			const {pipeline} = harness
			mountValue(harness)
			const tail = pipeline.byPath().get('2')
			if (!tail) throw new Error('expected tail handle')
			const seen: TokenDelta[] = []
			watch(pipeline.changed, delta => {
				seen.push(delta)
			})

			harness.apply('he@[x]llo!')
			pipeline.onRendered()

			expect(seen[0].updated).toContain(tail.id)
			expect(seen[0].added).toEqual([])
			expect(seen[0].removed).toEqual([])
			// A re-bind with no pending change announces an empty delta.
			expect(seen[1]).toEqual({added: [], removed: [], updated: []})
		})

		it('removedIds() still answers, now off the payload', () => {
			const harness = createHarness()
			const {pipeline} = harness
			mountValue(harness)
			const markId = pipeline.byPath().get('1')?.id
			harness.apply('hello')
			harness.render()
			expect(pipeline.removedIds()).toContain(markId)
		})
	})
```

**The leak is REPRODUCED, not hypothetical.** Run against the shipped
pipeline, before any change in this task:

```
apply 'a@[x]b@[y]c'; render          → ids: text#1 markX#2 text#3 markY#4 text#5
apply 'ab@[y]c'                      → reconcile removedIds [2, 3]   (pendingRemovedIds = [2,3])
apply 'abc'                          → reconcile removedIds [4, 5]   (pendingRemovedIds = [4,5])  ← overwrite
render                               → pipeline.removedIds() === [4, 5]
```

markX (id 2) is never announced to anyone. `BlockController`'s
`watch(this.tokens.changed, …)` prunes `#stores` off exactly that list, so
that row's `BlockStore` is leaked for the lifetime of the input. `foldDelta`
fixes it, and MUT 4 in Task 6 (assign instead of merge) kills the new test —
so the fix is gated, not merely applied.

Hand-traced against `tokenIdentity.reconcile`:
`'a@[x]b@[y]c'` → `'ab@[y]c'` gives window `{1,5,0}`; the suffix walk claims
`c`, `@[y]` and stops at `b`; the middle pairs `'a'`→`'ab'`; `@[x]` is
unmatched ⇒ `removedIds` contains `markX`. Then `'ab@[y]c'` → `'abc'` gives
window `{2,6,0}`; the suffix walk is inert; `@[y]` and `c` are unmatched ⇒
`removedIds` contains `markY`. Under today's overwrite the announce carries
only the second set.
`'he@[x]llo'` → `'he@[x]llo@[y]'` gives window `{9,9,4}`; the prefix walk
claims all three, and indices 3 and 4 are `kind: 'add'`, so
`renderTree()[3].id` is the new mark's id. The reverse edit gives window
`{9,13,0}`, whose unmatched previous tokens are exactly those two.

- [ ] **Step 2: Run — the new tests fail**

Measured red bar for the appended `describe`: **3 failed | 24 passed**. Only
three of the four new tests fail — "*removedIds() still answers, now off the
payload*" **passes before the change**, because `removedIds()` already
answers off `lastRemovedIds` and this task only re-derives it. It is a
regression guard for Step 4's rewiring, not a red-bar test; do not go hunting
when it comes up green.

The three genuine failures: the merge test (the removals are overwritten, so
`markX` is missing) and the two payload tests (`changed` takes no argument
yet, so `delta` is `undefined`).

- [ ] **Step 3: Extend `commitInput.ts`**

```ts
/**
 * The `changed` payload (spec §2.3) and the pipeline's delta carrier — one
 * type, because they are the same three id lists. Subtree-inclusive.
 */
export type TokenDelta = {
	readonly added: readonly number[]
	readonly removed: readonly number[]
	readonly updated: readonly number[]
}
```

Replace `CommitInput.removedIds` with `delta: TokenDelta`, and in
`fromReconcile`:

```ts
		delta: {
			// `kind: 'add'` is reconcile's only add signal; `'text'` is its content
			// signal (a refused-descend MARK included); `'update'` is position-only
			// and is NOT a content change.
			added: result.changes.filter(change => change.kind === 'add').map(change => change.id),
			removed: result.removedIds,
			updated: result.changes.filter(change => change.kind === 'text').map(change => change.id),
		},
```

**Then fix `commitInput.spec.ts` in the same step** — Task 1's second test
asserts the field you just deleted, so the file fails both Vitest and
`typecheck` until you do. Replace its last line:

```ts
		expect(input.removedIds).toEqual([9])
```

with the full delta, which pins all three mappings at once:

```ts
		expect(input.delta).toEqual({added: [3], removed: [9], updated: [1]})
```

(The fixture already has one `'text'` entry `id: 1`, one `'update'` entry
`id: 2` — deliberately absent from every list — and one `'add'` entry
`id: 3`.) **This assertion is the only gate on the lowering's delta mapping**:
mutating `updated` to `[]` in `fromReconcile` leaves the whole rest of the
suite green, because the live `changed` consumers only read `removed`.

- [ ] **Step 4: Merge in the pipeline**

In `commit.ts`, replace `pendingRemovedIds`/`lastRemovedIds` with:

```ts
type DeltaAccumulator = {added: Set<number>; removed: Set<number>; updated: Set<number>}

const EMPTY_DELTA: TokenDelta = {added: [], removed: [], updated: []}

/**
 * Compose one commit's delta into the pending window's (spec D9's fold).
 * Exact, because ids are never reused within an input instance: a node added
 * and then removed before the paint never existed for a consumer, and an
 * update to a node that then died is moot.
 */
function foldDelta(into: DeltaAccumulator, delta: TokenDelta): void {
	for (const id of delta.added) into.added.add(id)
	for (const id of delta.updated) {
		if (!into.added.has(id)) into.updated.add(id)
	}
	for (const id of delta.removed) {
		into.updated.delete(id)
		if (!into.added.delete(id)) into.removed.add(id)
	}
}

function drainDelta(into: DeltaAccumulator): TokenDelta {
	const delta: TokenDelta = {added: [...into.added], removed: [...into.removed], updated: [...into.updated]}
	into.added.clear()
	into.removed.clear()
	into.updated.clear()
	return delta
}
```

Inside `createCommitPipeline`:

```ts
	const changed = event<TokenDelta>()
	// Accumulates across the pending window and is drained by whichever branch
	// announces. It is empty whenever pendingStructural is false — the drain is
	// what makes that true — so the old `pendingStructural ? … : []` guard on the
	// bind path is gone rather than duplicated.
	const pendingDelta: DeltaAccumulator = {added: new Set(), removed: new Set(), updated: new Set()}
	let lastDelta: TokenDelta = EMPTY_DELTA
```

- `commitText(changes, delta)`: after `if (VERIFY_DOM) assertAligned()`, do
  `foldDelta(pendingDelta, delta); lastDelta = drainDelta(pendingDelta); changed(lastDelta); return true`.
- `commitStructural(tokens, delta, selfHeal)`: replace
  `pendingRemovedIds = removedIds` with `foldDelta(pendingDelta, delta)`.
- `bindAndAnnounce`: replace the two `lastRemovedIds`/`pendingStructural`
  lines with
  `lastDelta = drainDelta(pendingDelta); pendingStructural = false`, keep
  `if (VERIFY_DOM) assertAligned()`, then `changed(lastDelta)`.
- Returned object: `changed`, and
  `removedIds: () => lastDelta.removed` — retype `CommitPipeline.changed` to
  `Event<TokenDelta>` and re-document `removedIds()` as derived, scheduled
  for deletion with §4.6 item 6 in S1.6d.

The ordering `assertAligned()` → announce is unchanged: a divergence throw
must still suppress the event.

- [ ] **Step 5: Migrate the consumers**

`TokenModel.ts`: `get changed(): Event<TokenDelta>`; update the doc comment
("payloadless — consumers re-read" is now false) and `removedIds`'s comment.

`BlockController.ts:38-42`:

```ts
		// The `changed` payload (spec §2.3) replaces the wave-scoped removedIds()
		// side channel: the ids arrive WITH the event instead of from a field that
		// is valid only for the duration of that wave, and the pipeline now merges
		// every commit folded into one paint rather than keeping the last one.
		watch(this.tokens.changed, delta => {
			for (const id of delta.removed) this.#stores.delete(id)
		})
```

In `TokenModel.changed.spec.ts`, replace the **three**
`expect(store.tokens.removedIds()).toEqual([])` assertions — at `:69`, `:89`
and `:106`, not four — with payload reads so S1.6d's deletion is a pure
delete. Capture the payload in the existing `changedSpy` (`vi.fn()` already
records arguments, so `changedSpy.mock.lastCall?.[0]` is the delta) and assert
`toEqual({added: [], removed: [], updated: expect.anything()})`-shaped facts
per case. Hand-check each: the text-edit cases at `:56`, `:72` and `:96`
report the edited token in `updated` and nothing in `added`/`removed`.

While in the file, fix the three now-false comments that call the event
"payloadless (Phase 2)" — `:45`, `:66` and `:85`. They assert exactly what
this task changes.

**Call this out at review:** once `BlockController` is migrated,
`TokenModel.removedIds()` has **zero production consumers** — it is read only
by specs. That is deliberate (§4.6 item 6 / S1.6d delete it together with the
`#path` readers, and keeping the accessor alive one phase longer keeps this
task a pure behavior-preserving migration), but AGENTS.md's
no-surface-without-a-caller rule means it cannot pass silently. State it in
the S1.5 review with the deletion phase named.

- [ ] **Step 6: Gate — including `build`**

Run: `pnpm run format && pnpm -w exec vitest run packages/core && pnpm run typecheck && pnpm run lint:check && pnpm run build`

`build` is in this gate specifically: `TokenModel` is a root export and its
`changed` getter's type changed, so the rolldown DTS bundle
(`codeSplitting: false`) must be proven to resolve `TokenDelta`. If it does
not, export the type from `model/commitInput.ts` only — do **not** add it to
`features/tokens/index.ts`, which would widen the public surface S1.7 is
about to narrow.

- [ ] **Step 7: Commit**

```bash
pnpm run format
git add packages/core/src/features/tokens/model/commitInput.ts \
        packages/core/src/features/tokens/model/commitInput.spec.ts \
        packages/core/src/features/tokens/model/commit.ts \
        packages/core/src/features/tokens/model/commit.spec.ts \
        packages/core/src/features/tokens/model/TokenModel.ts \
        packages/core/src/features/tokens/TokenModel.changed.spec.ts \
        packages/core/src/features/block/BlockController.ts
git commit -m "feat(tokens): S1.5 changed payload with fold merging; BlockController off removedIds

BEHAVIOR CHANGE (two, both intentional):
- changed now carries {added, removed, updated} (spec §2.3). Existing
  subscribers that ignore the argument are unaffected.
- Deltas accumulated between a structural apply and its bind are now MERGED,
  not overwritten. Two structural applies before one paint used to drop the
  first one's removed ids, so BlockController leaked those rows' per-row UI
  state. Pinned in commit.spec.ts."
```

---

### Task 3: the compat snapshot memo

**Files:** modify `tree/snapshot.ts`; create `tree/snapshotMemo.ts`,
`tree/snapshotMemo.spec.ts`.

- [ ] **Step 1: Write the failing tests**

```ts
// packages/core/src/features/tokens/tree/snapshotMemo.spec.ts
import {describe, expect, it} from 'vitest'

import {Parser} from '../parser/Parser'
import type {MarkToken, Token} from '../parser/types'
import {adopt} from './adopt'
import {gapWindow} from './gapWindow'
import {stripIds} from './snapshot'
import {createSnapshotMemo} from './snapshotMemo'
import {createTokenTree} from './tree'

const parser = new Parser(['@[__value__](__slot__)', '#[__slot__]', '!__value__!'])

function setup(source: string) {
	const tree = createTokenTree(parser.parse(source))
	const memo = createSnapshotMemo()
	return {tree, memo, first: memo.roots(tree.roots())}
}

function edit(tree: ReturnType<typeof createTokenTree>, memo: ReturnType<typeof createSnapshotMemo>, next: string) {
	const current = tree.value()
	const result = adopt(tree, gapWindow(current, next), parser.parse(next))
	memo.invalidate(result)
	return memo.roots(tree.roots())
}

const asMark = (token: Token): MarkToken => {
	if (token.type !== 'mark') throw new Error('expected a mark token')
	return token
}

describe('createSnapshotMemo', () => {
	it('reuses the token of every untouched node, and KEEPS reusing across a second edit', () => {
		// A TAIL edit, deliberately: it is the only shape that leaves earlier roots
		// out of both feeds. Measured on '!__value__!' with 'a!x!b!y!c' →
		// 'a!x!b!y!cc': window {9,9,1}, `updated` = [text#5], `shifted` = [text#5].
		//
		// An earlier draft used the HEAD insert 'a!x!b!y!c' → 'aa!x!b!y!c' and
		// asserted the four later roots were reused. That is not just unmeasured,
		// it is BACKWARDS: measured, the head insert gives `shifted` =
		// [text#5, mark#4, text#3, mark#2, text#1] — every root moved, so every
		// root is dirty, and a memo that handed the old objects back would be
		// serving STALE POSITIONS. Do not restore it.
		const {tree, memo, first} = setup('a!x!b!y!c')
		const after = edit(tree, memo, 'a!x!b!y!cc')

		expect(after[4]).not.toBe(first[4]) // the edited tail
		expect(after[0]).toBe(first[0])
		expect(after[1]).toBe(first[1])
		expect(after[2]).toBe(first[2])
		expect(after[3]).toBe(first[3])

		// SECOND edit, and this half is what makes `dirty.clear()` load-bearing.
		// Measured on 'a!x!b!y!cc' → 'a!x!B!y!cc' (length-preserving, so the suffix
		// walk shifts nothing): window {4,5,1}, `updated` = [text#3], `shifted` =
		// empty. With the clear, text#5 is clean and is reused. WITHOUT it, `dirty`
		// still holds text#5 from the first edit and text#5 re-materializes — the
		// memo stays CORRECT but stops reusing anything it has ever touched, which
		// is precisely the regression it exists to prevent (block layout's
		// memo(Block) keys on token identity). Every other test here does at most
		// one edit or compares deep equality, so this assertion is the only gate.
		const third = edit(tree, memo, 'a!x!B!y!cc')

		expect(third[2]).not.toBe(after[2]) // the newly edited text
		expect(third[4]).toBe(after[4]) // dirtied by edit 1, untouched by edit 2
		expect(third[0]).toBe(after[0])
		expect(third[1]).toBe(after[1])
		expect(third[3]).toBe(after[3])
	})

	it('re-reads DESCENDANT positions of a shifted root instead of applying its delta', () => {
		// Measured on '@[x](ab)t' → '@[xy](ab)t': the mark moves [0,8]→[0,9]
		// (start delta 0) while its slot child moves [5,7]→[6,8] (start delta +1),
		// and the child appears in NEITHER `updated` nor `shifted`. Dirtying only
		// the listed ids returns the child cached at [5,7].
		const {tree, memo} = setup('@[x](ab)t')
		const after = edit(tree, memo, '@[xy](ab)t')

		const mark = asMark(after[1])
		expect(mark.position).toEqual({start: 0, end: 9})
		expect(mark.children[0].position).toEqual({start: 6, end: 8})
	})

	it('re-materializes an ANCESTOR whose own fields never changed', () => {
		// Measured on '#[ab]t' → '#[cb]t': `updated` is the CHILD only, `shifted`
		// is empty, the mark's position is unchanged at [0,5] — yet its `content`
		// and `slot.content` both changed. TreeNode has no parent link, so only
		// child-reference comparison can invalidate it.
		const {tree, memo, first} = setup('#[ab]t')
		const after = edit(tree, memo, '#[cb]t')

		const mark = asMark(after[1])
		expect(mark).not.toBe(first[1])
		expect(mark.content).toBe('#[cb]')
		expect(mark.slot?.content).toBe('cb')
		expect(mark.position).toEqual({start: 0, end: 5})
	})

	it('stays deep-equal to a fresh parse after a run of edits (the §7.1 invariant, memoized)', () => {
		const {tree, memo} = setup('a#[bc]d@[x](e)f')
		for (const next of ['a#[bc]d@[x](e)ff', 'a#[bXc]d@[x](e)ff', 'a#[bXc]d@[y](e)ff', 'a#[bXc]dff']) {
			const tokens = edit(tree, memo, next)
			expect(stripIds(tokens)).toEqual(parser.parse(next))
		}
	})

	it('evicts removed ids so a long-lived memo does not grow without bound', () => {
		const {tree, memo} = setup('a#[bc]d')
		const markId = tree.roots()[1].id
		expect(memo.tokenFor(markId)).toBeDefined()

		edit(tree, memo, 'ad')

		expect(memo.tokenFor(markId)).toBeUndefined()
	})

	it('tokenFor answers for every live node after roots()', () => {
		const {tree, memo, first} = setup('a#[bc]d')
		const mark = asMark(first[1])
		expect(memo.tokenFor(tree.roots()[1].id)).toBe(mark)
		expect(memo.tokenFor(mark.children[0].id!)).toBe(mark.children[0])
	})
})
```

`'a!x!b!y!c'` with markup `'!__value__!'` parses to five roots — measured,
`text#1 mark#2 text#3 mark#4 text#5`, value-only marks with no slot children —
so the first test's index assertions are exact and the ids in its comments are
the real ones.

- [ ] **Step 2: Run — FAIL** (`./snapshotMemo` not found).

- [ ] **Step 3: Split `snapshot.ts` (pure move, no behavior change)**

```ts
/** Materialize plain Token snapshots (compat read shape). Ids included. */
export function snapshot(nodes: readonly TreeNode[]): Token[] {
	return nodes.map(node => materializeNode(node, node.kind === 'mark' ? snapshot(node.children()) : NO_CHILDREN))
}

const NO_CHILDREN: Token[] = []

/**
 * One node → one Token, given its children's tokens. Split out of `snapshot` so
 * `snapshotMemo` can feed CACHED child tokens instead of re-projecting them;
 * `snapshot` itself stays the pure, unmemoized §7.1 output-equivalence gate.
 * `children` is ignored for text nodes.
 */
export function materializeNode(node: TreeNode, children: Token[]): Token {
	if (node.kind === 'text') {
		const token: TextToken = {type: 'text', content: node.text(), position: {...node.position}, id: node.id}
		return token
	}
	// … the existing mark body verbatim, with `const children = snapshot(...)`
	// deleted and the parameter used in its place.
}
```

`snapshot.spec.ts` must stay green **unchanged** — including `:104-105`
(`token.position` and `token.slot` are not aliased to the node's), which the
`{...node.position}` copies still satisfy.

- [ ] **Step 4: Implement the memo**

```ts
// packages/core/src/features/tokens/tree/snapshotMemo.ts
import {untracked} from '../../../shared/signals'
import type {Token} from '../parser/types'
import {materializeNode} from './snapshot'
import type {Id, TransactionResult, TreeNode} from './types'

/**
 * Spec D9's compat snapshot memo: `tokens.current()` re-materializes only what
 * the adoption actually changed, so an unchanged subtree keeps its Token object
 * and identity-keyed consumers can skip it.
 *
 * Invalidation is two mechanisms, and BOTH are load-bearing (see
 * snapshotMemo.spec.ts for the measured fixtures):
 *
 * - explicit dirty ids from `updated`, plus `shifted` walked SUBTREE-INCLUSIVELY,
 *   because `shifted` carries subtree roots only and a root's delta is NOT its
 *   descendants' ('@[x](ab)t' → '@[xy](ab)t' moves the mark's start by 0 and its
 *   slot child's by 1, and lists the child in neither feed);
 * - child-REFERENCE comparison at materialization, which is what invalidates
 *   ancestors: `TreeNode` has no parent link, and a length-preserving in-slot
 *   edit ('#[ab]t' → '#[cb]t') changes a mark's `content` and `slot.content`
 *   while the mark itself appears in no feed and does not move.
 *
 * `added` needs nothing: a fresh node has no cache entry, and its ancestors
 * re-materialize because their children array is no longer element-identical.
 */
export interface SnapshotMemo {
	/** Materialize the roots, reusing every token whose node did not change. */
	roots(nodes: readonly TreeNode[]): Token[]
	/** Mark what one adoption touched. Call once per result, BEFORE `roots`. */
	invalidate(result: TransactionResult): void
	/** The cached token for an id, or undefined (never materialized, or evicted). */
	tokenFor(id: Id): Token | undefined
}

const NO_CHILDREN: Token[] = []

export function createSnapshotMemo(): SnapshotMemo {
	const cache = new Map<Id, Token>()
	const dirty = new Set<Id>()

	const materialize = (node: TreeNode): Token => {
		const children = node.kind === 'mark' ? node.children().map(materialize) : NO_CHILDREN
		const cached = cache.get(node.id)
		if (cached && !dirty.has(node.id) && sameChildren(cached, children)) return cached
		const token = materializeNode(node, children)
		cache.set(node.id, token)
		return token
	}

	return {
		// `untracked` for the reason adoption documents: the whole recursion reads
		// node signals, and a caller inside an effect must not subscribe to every
		// node it happened to walk.
		roots: nodes =>
			untracked(() => {
				const tokens = nodes.map(materialize)
				// LOAD-BEARING, and cheap to lose: without it `dirty` only ever grows,
				// so every node the memo has ever touched re-materializes forever
				// after. The memo stays CORRECT — the whole suite passes — so the
				// only gate is the second-edit half of the first test above.
				dirty.clear()
				return tokens
			}),

		invalidate(result) {
			// `removed` is already flattened (types.ts:72-73), so one pass evicts the
			// whole dead subtree; ids are never reused, so an evicted entry can never
			// be resurrected by a later node.
			for (const id of result.removed) cache.delete(id)
			for (const node of result.updated) dirty.add(node.id)
			for (const node of result.shifted) markSubtree(node, dirty)
		},

		tokenFor: id => cache.get(id),
	}
}

function markSubtree(node: TreeNode, dirty: Set<Id>): void {
	dirty.add(node.id)
	if (node.kind === 'mark') {
		for (const child of untracked(() => node.children())) markSubtree(child, dirty)
	}
}

function sameChildren(cached: Token, children: readonly Token[]): boolean {
	// A cached TEXT token has no children to compare, and a node never changes
	// kind, so the cache can never disagree with the node about it.
	if (cached.type !== 'mark') return true
	return cached.children.length === children.length && cached.children.every((child, i) => child === children[i])
}
```

- [ ] **Step 5: Gate**

Run: `pnpm run format && pnpm -w exec vitest run packages/core/src/features/tokens && pnpm run typecheck && pnpm run lint:check`

- [ ] **Step 6: Commit**

```bash
pnpm run format
git add packages/core/src/features/tokens/tree/snapshot.ts \
        packages/core/src/features/tokens/tree/snapshotMemo.ts \
        packages/core/src/features/tokens/tree/snapshotMemo.spec.ts
git commit -m "feat(tree): S1.5 compat snapshot memo — per-node reuse invalidated from the transaction delta"
```

---

### Task 4: `fromTransaction` — the tree lowering

**Files:** create `model/treeInput.ts`, `model/treeInput.spec.ts`.

- [ ] **Step 1: Write the failing tests**

```ts
// packages/core/src/features/tokens/model/treeInput.spec.ts
import {describe, expect, it} from 'vitest'

import {adopt} from '../tree/adopt'
import {gapWindow} from '../tree/gapWindow'
import {createSnapshotMemo} from '../tree/snapshotMemo'
import {createTokenTree} from '../tree/tree'
import {Parser} from '../parser/Parser'
import {fromTransaction} from './treeInput'

const parser = new Parser(['@[__value__](__slot__)', '#[__slot__]'])

function setup(source: string) {
	const tree = createTokenTree(parser.parse(source))
	const memo = createSnapshotMemo()
	memo.roots(tree.roots())
	return {tree, memo}
}

function lower(tree: ReturnType<typeof createTokenTree>, memo: ReturnType<typeof createSnapshotMemo>, next: string) {
	const current = tree.value()
	const result = adopt(tree, gapWindow(current, next), parser.parse(next))
	return {result, input: fromTransaction(result, memo, tree.roots())}
}

describe('fromTransaction', () => {
	it('routes an interior text edit to the text branch', () => {
		const {tree, memo} = setup('he#[x]llo')
		const {input} = lower(tree, memo, 'he#[x]llo!')

		expect(input.render).toBe(false)
		expect(input.changes.filter(change => change.patch).map(change => change.token.content)).toEqual(['llo!'])
	})

	it('routes a mark value change to the RENDER branch even though nothing was added or removed', () => {
		const {tree, memo} = setup('he@[x](s)llo')
		const {result, input} = lower(tree, memo, 'he@[y](s)llo')

		expect(result.structural).toBe(false)
		expect(result.render).toBe(true)
		expect(input.render).toBe(true)
	})

	it('routes an add and a removal to the render branch and reports both ids', () => {
		const {tree, memo} = setup('he#[x]llo')
		const markId = tree.roots()[1].id
		const {input} = lower(tree, memo, 'hello')

		expect(input.render).toBe(true)
		expect(input.delta.removed).toContain(markId)
	})

	it('carries a shifted root AND its descendants, each with its own absolute positions', () => {
		// The '@[x](ab)t' fixture again: the child is in neither adoption feed and
		// its delta differs from the root's, so a lowering that emitted only the
		// listed nodes would leave the child's handle on stale positions.
		const {tree, memo} = setup('@[x](ab)t')
		const childId = childIdOf(tree)
		const {input} = lower(tree, memo, '@[xy](ab)t')

		const child = input.changes.find(change => change.id === childId)
		expect(child).toBeDefined()
		expect(child?.patch).toBe(false)
		expect(child?.token.position).toEqual({start: 6, end: 8})
	})

	it('emits one entry per node when it is both updated and shifted, and it patches', () => {
		// Measured: an interior text edit lists the SAME node in `updated` and
		// `shifted` (both content and position moved).
		const {tree, memo} = setup('he#[x]llo')
		const tailId = tree.roots()[2].id
		const {input} = lower(tree, memo, 'he#[x]llo!')

		const entries = input.changes.filter(change => change.id === tailId)
		expect(entries).toHaveLength(1)
		expect(entries[0].patch).toBe(true)
	})

	it('hands the pipeline the MEMOIZED tokens, not fresh ones', () => {
		const {tree, memo} = setup('he#[x]llo')
		const before = memo.tokenFor(tree.roots()[1].id)
		const {input} = lower(tree, memo, 'he#[x]llo!')

		expect(input.tokens[1]).toBe(before)
	})
})

function childIdOf(tree: ReturnType<typeof createTokenTree>): number {
	const mark = tree.roots()[1]
	if (mark.kind !== 'mark') throw new Error('expected a mark node')
	return mark.children()[0].id
}
```

- [ ] **Step 2: Run — FAIL** (`./treeInput` not found).

- [ ] **Step 3: Implement**

```ts
// packages/core/src/features/tokens/model/treeInput.ts
import {untracked} from '../../../shared/signals/index.js'
import type {SnapshotMemo} from '../tree/snapshotMemo'
import type {TransactionResult, TreeNode} from '../tree/types'
import type {CommitChange, CommitInput} from './commitInput'

/**
 * The tree core's lowering into the one commit pipeline (spec D9). Runs inside
 * `Boundary.onResult`, i.e. synchronously at adoption — §4.4 requires
 * `tokens.current()` to stay consistent with `value.current()`, and seven live
 * call sites slice the value by positions read from the snapshot.
 *
 * Routing is `result.render`, NOT `result.structural`: the latter is add/remove
 * only, while a mark whose value or meta changed renders new framework props
 * and must reach the renderer (adopt.ts:197-198; pinned in treeInput.spec.ts).
 */
export function fromTransaction(
	result: TransactionResult,
	memo: SnapshotMemo,
	roots: readonly TreeNode[]
): CommitInput {
	memo.invalidate(result)
	const tokens = memo.roots(roots)

	const changes: CommitChange[] = []
	const seen = new Set<number>()

	const push = (node: TreeNode, patch: boolean): void => {
		if (seen.has(node.id)) return
		const token = memo.tokenFor(node.id)
		// Unreachable in practice — `memo.roots` above walked every live node — but
		// `tokenFor` is typed optional and a silent skip beats a throw on a datum
		// the pipeline only uses to refresh a cache.
		if (!token) return
		seen.add(node.id)
		changes.push({id: node.id, token, patch})
	}

	// Content first, so a node listed in BOTH feeds is emitted as a patch. Order
	// between entries is NOT significant (spec: `shifted` is unordered, measured
	// as reverse-document suffix run then document-order middle): every entry is
	// an absolute write to a distinct node.
	untracked(() => {
		for (const node of result.updated) push(node, true)
		// `shifted` carries subtree ROOTS only; descendants moved with it and their
		// stored positions are what the DOM boundary layer reads, so walk them.
		for (const node of result.shifted) walk(node, push)
	})

	return {
		tokens,
		render: result.render,
		changes,
		delta: {
			added: result.added.map(change => change.node.id),
			removed: result.removed,
			updated: result.updated.map(node => node.id),
		},
	}
}

function walk(node: TreeNode, push: (node: TreeNode, patch: boolean) => void): void {
	push(node, false)
	if (node.kind === 'mark') {
		for (const child of node.children()) walk(child, push)
	}
}
```

Note on `delta.added`: `TransactionResult.added` carries subtree ROOTS
(`types.ts:70-71`), so a fresh mark's children are not listed. That is
correct for the `changed` payload's only consumer — `BlockController` keys on
top-level row ids — and it matches `removed`'s asymmetry, which the type
documents as normative. Record it in the S1.7 review if a consumer ever needs
the flattened add list.

- [ ] **Step 4: Gate**

Run: `pnpm run format && pnpm -w exec vitest run packages/core/src/features/tokens && pnpm run typecheck && pnpm run lint:check`

- [ ] **Step 5: Commit**

```bash
pnpm run format
git add packages/core/src/features/tokens/model/treeInput.ts \
        packages/core/src/features/tokens/model/treeInput.spec.ts
git commit -m "feat(tokens): S1.5 fromTransaction — lower TransactionResult into the commit pipeline"
```

---

### Task 5: the parity suite — the SAME pipeline, driven by the tree

**Files:** create `model/treePipeline.spec.ts`.

This is the phase's real gate: it proves the tree lowering reproduces every
behavior §11 lists as "must survive intact", on the same code path.

- [ ] **Step 1: Build the harness and port the cases**

```ts
// packages/core/src/features/tokens/model/treePipeline.spec.ts
import {afterEach, describe, expect, it, vi} from 'vitest'

import {watch} from '../../../shared/signals/index.js'
import {Parser} from '../parser/Parser'
import type {Markup, Token} from '../parser/types'
// The S1.4 STRING boundary (`tokens/tree/boundary.ts`), not the DOM boundary
// layer of the same filename at `tokens/boundary.ts`.
import {createBoundary} from '../tree/boundary'
import {createSnapshotMemo} from '../tree/snapshotMemo'
import {createTokenTree} from '../tree/tree'
import {createTransactions} from '../tree/transactions'
import {createCommitPipeline} from './commit'
import type {TokenHandle} from './TokenHandle'
import {fromTransaction} from './treeInput'

/**
 * The same manual adapter commit.spec.ts uses, wired to the tree core instead
 * of the identity tracker: an empty tree seeded through the boundary, edits
 * through the transaction verbs, and `onResult` lowering into the pipeline.
 * Value-only marks render their value as a bare text node, so bind never
 * descends into them.
 */
// `Markup`, NOT `string`: `Parser`'s constructor takes `(Markup | undefined)[]`
// and `Markup` is a template-literal union (parser/types.ts:63), so a
// `string[]` default fails with TS2345. Vitest stays GREEN on that — only
// `pnpm run typecheck` catches it, which is why it is in every gate.
function createHarness(markups: Markup[] = ['@[__value__]']) {
	const parser = new Parser(markups)
	const tree = createTokenTree([])
	const memo = createSnapshotMemo()
	const nodes = new Map<number, TokenHandle>()
	const controls = new Set<HTMLElement>()
	const container = document.createElement('div')
	document.body.append(container)
	let mounted: HTMLElement | null = container
	const pipeline = createCommitPipeline({
		container: () => mounted,
		nodes,
		// The tree core stamps every snapshot token with its node's id
		// (snapshot.ts), so bind's id pre-pass can never throw on this path.
		idFor: token => token.id,
		editableState: () => ({editable: true, readOnly: false}),
		controlElements: () => controls,
		childSequenceHostsFor: () => [],
		isBlock: () => false,
	})
	const boundary = createBoundary({
		tree,
		parser: () => parser,
		controlled: () => false,
		onChange: () => {},
		onResult: result => pipeline.apply(fromTransaction(result, memo, tree.roots())),
	})
	const tx = createTransactions({tree, readOnly: () => false, sink: boundary.sink})
	// FLAT paint: a value-only mark renders its value as a bare text node, so
	// bind never descends. This is the default for every case but the slot one.
	const render = () => {
		const spans = pipeline.renderTree().map(token => {
			const span = document.createElement('span')
			if (token.type === 'mark') span.append(document.createTextNode(token.value))
			return span
		})
		container.replaceChildren(...spans)
		pipeline.onRendered()
		return spans
	}
	// NESTED paint, for slot markups: a mark renders its CHILDREN as spans, so
	// bind descends and each child text token owns a surface. Same recursion as
	// createSlotHarness's `paint` at commit.spec.ts:598-606 — and it lives HERE,
	// inside createHarness, for the same reason that one does: it needs
	// `container` and `pipeline.onRendered()`, neither of which a free function
	// has. Call it as `harness.renderNested()`.
	const renderNested = () => {
		const paint = (tokens: readonly Token[]): HTMLElement[] =>
			tokens.map(token => {
				const span = document.createElement('span')
				if (token.type === 'mark') span.append(...paint(token.children))
				return span
			})
		const spans = paint(pipeline.renderTree())
		container.replaceChildren(...spans)
		pipeline.onRendered()
		return spans
	}
	const splice = (start: number, end: number, text: string) =>
		tx.applyRange({start, end, insertedLength: 0}, text)
	return {
		pipeline,
		tree,
		memo,
		nodes,
		container,
		boundary,
		tx,
		render,
		renderNested,
		splice,
		unmount: () => void (mounted = null),
	}
}

type Harness = ReturnType<typeof createHarness>

/** 'he@[x]llo' → text 'he'[0,2], mark '@[x]'[2,6], text 'llo'[6,9]. */
function mount(harness: Harness, value = 'he@[x]llo') {
	harness.boundary.arrive(value)
	const [text1, mark, text2] = harness.render()
	return {text1, mark, text2}
}

describe('commit pipeline driven by the tree core', () => {
	afterEach(() => {
		document.body.replaceChildren()
		window.getSelection()?.removeAllRanges()
	})

	it('cold start: the seed is structural, quiet until rendered, then binds three surfaces', () => {
		const harness = createHarness()
		const {pipeline} = harness
		const changedSpy = vi.fn()
		watch(pipeline.changed, changedSpy)

		harness.boundary.arrive('he@[x]llo')

		expect(pipeline.pending()).toBe(true)
		expect(changedSpy).not.toHaveBeenCalled()
		expect(harness.container.childElementCount).toBe(0)

		const [text1, mark, text2] = harness.render()

		expect(changedSpy).toHaveBeenCalledTimes(1)
		expect(pipeline.byPath().size).toBe(3)
		expect(text1.textContent).toBe('he')
		expect(mark.textContent).toBe('x')
		expect(text2.textContent).toBe('llo')
		expect(text1.contentEditable).toBe('true')
		expect(mark.tabIndex).toBe(0)
	})

	it('a tail text edit patches in place, keeps the render tree and announces once', () => {
		const harness = createHarness()
		const {pipeline} = harness
		const {text2} = mount(harness)
		const treeBefore = pipeline.renderTree()
		const byPathBefore = pipeline.byPath()
		const changedSpy = vi.fn()
		let domAtEvent: string | null = null
		watch(pipeline.changed, () => {
			changedSpy()
			domAtEvent = text2.textContent
		})

		expect(harness.splice(9, 9, '!')).toBe(true)

		expect(text2.textContent).toBe('llo!')
		expect(domAtEvent).toBe('llo!')
		expect(pipeline.renderTree()).toBe(treeBefore)
		expect(pipeline.byPath()).toBe(byPathBefore)
		expect(pipeline.pending()).toBe(false)
		expect(changedSpy).toHaveBeenCalledTimes(1)
	})

	it('a mark value change routes RENDER even though it adds and removes nothing', () => {
		const harness = createHarness()
		const {pipeline} = harness
		const {mark} = mount(harness)
		const markHandle = pipeline.byPath().get('1')
		if (!markHandle) throw new Error('expected mark handle')
		const treeBefore = pipeline.renderTree()
		const changedSpy = vi.fn()
		watch(pipeline.changed, changedSpy)

		// '@[x]' spans [2,6]; replacing it whole is what MarkController lowers to.
		expect(harness.splice(2, 6, '@[y]')).toBe(true)

		expect(pipeline.renderTree()).not.toBe(treeBefore)
		expect(changedSpy).not.toHaveBeenCalled()
		expect(pipeline.pending()).toBe(true)
		expect(markHandle.element()).toBe(mark)

		harness.render()

		expect(changedSpy).toHaveBeenCalledTimes(1)
		// Handle continuity across a re-render is the pinned contract (id-keyed).
		expect(pipeline.byPath().get('1')).toBe(markHandle)
		expect(harness.container.children[1].textContent).toBe('y')
	})

	it('a removal routes structural and kills the handle at bind', () => {
		const harness = createHarness()
		const {pipeline, nodes} = harness
		mount(harness)
		const markHandle = pipeline.byPath().get('1')
		if (!markHandle) throw new Error('expected mark handle')
		let payload: {removed: readonly number[]} | undefined
		watch(pipeline.changed, delta => {
			payload = delta
		})

		expect(harness.splice(2, 6, '')).toBe(true)
		expect(markHandle.alive()).toBe(true)
		expect(pipeline.pending()).toBe(true)

		harness.render()

		expect(markHandle.alive()).toBe(false)
		expect(payload?.removed).toContain(markHandle.id)
		expect(nodes.size).toBe(1)
	})

	it('an edit landing in the pending window folds in, fail-closed', () => {
		const harness = createHarness()
		const {pipeline} = harness
		const {text2} = mount(harness)
		const tail = pipeline.byPath().get('2')
		if (!tail) throw new Error('expected tail handle')
		const changedSpy = vi.fn()
		watch(pipeline.changed, changedSpy)

		harness.splice(2, 6, '@[y]') // render bit set → latched
		harness.splice(9, 9, '!') // looks like a text edit against the pending tree

		expect(pipeline.pending()).toBe(true)
		expect(changedSpy).not.toHaveBeenCalled()
		expect(tail.token().content).toBe('llo')
		expect(text2.textContent).toBe('llo')

		harness.render()

		expect(changedSpy).toHaveBeenCalledTimes(1)
		expect(harness.container.children[2].textContent).toBe('llo!')
	})

	it('a text change whose handle vanished abandons the branch and self-heals through a bind', () => {
		const harness = createHarness()
		const {pipeline, nodes} = harness
		const {text2} = mount(harness)
		const tail = pipeline.byPath().get('2')
		if (!tail) throw new Error('expected tail handle')
		nodes.delete(tail.id)
		const changedSpy = vi.fn()
		watch(pipeline.changed, changedSpy)

		harness.splice(9, 9, '!')

		expect(changedSpy).toHaveBeenCalledTimes(1)
		expect(pipeline.pending()).toBe(false)
		expect(pipeline.byPath().get('2')?.token().content).toBe('llo!')
		expect(text2.textContent).toBe('llo!')
	})

	it('the divergence detector still throws with the path on an untouched surface', () => {
		const harness = createHarness()
		const {text1} = mount(harness)
		text1.textContent = 'WRONG'

		let message = ''
		try {
			harness.splice(9, 9, '!')
		} catch (e) {
			message = e instanceof Error ? e.message : String(e)
		}
		expect(message).toMatch(/TokenModel divergence/)
		expect(message).toContain('[0]')
		expect(message).toContain('"WRONG"')
		expect(message).toContain('"he"')
	})

	it('an in-slot edit routes TEXT and patches the child surface', () => {
		// Slot harness: marks render their CHILDREN, so bind descends and the child
		// text token owns a surface. '#[ab]tail' → text ''[0,0], mark '#[ab]'[0,5]
		// {child 'ab'[2,4]}, text 'tail'[5,9].
		const harness = createHarness(['#[__slot__]'])
		const {pipeline} = harness
		harness.boundary.arrive('#[ab]tail')
		harness.renderNested()
		const childHandle = pipeline.byPath().get('1.0')
		const childSurface = childHandle?.node()?.textElement
		if (!childSurface) throw new Error('expected the child surface')
		const treeBefore = pipeline.renderTree()

		expect(harness.splice(3, 3, 'X')).toBe(true)

		expect(pipeline.renderTree()).toBe(treeBefore)
		expect(pipeline.pending()).toBe(false)
		expect(childSurface.textContent).toBe('aXb')
	})
})
```

**On the nested paint (an earlier draft got this wrong twice):** the recursion
belongs to `createHarness` as the `renderNested()` sibling of `render()` shown
above, *not* to a free `paintNested(harness)` helper. Two reasons, both
concrete: the walk it mirrors (`commit.spec.ts:598-606`) lives inside a
`render()` closure that owns `container` and calls `pipeline.onRendered()`,
and a free function has neither; and a stub with an unused `tokens` parameter
is a hard stop — `eslint(no-unused-vars)` is error-level and `denyWarnings:
true` fails `lint:check` and the pre-commit hook on it.

Hand-traced offsets used above, against
`Parser(['@[__value__]']).parse('he@[x]llo')`: `he` `[0,2]`, `@[x]` `[2,6]`,
`llo` `[6,9]`. `splice(9,9,'!')` yields window `{9,9,1}`: the prefix walk
claims indices 0 and 1 (`end <= 9`), stops at the tail because its bytes
changed, and the middle re-adopts the tail — `updated` and `shifted` both
list it, `render` is false. `splice(2,6,'@[y]')` yields window `{2,6,4}`: the
prefix claims `he`, the suffix claims `llo` at delta 0, the middle pairs the
two marks by descriptor, `updated` is `[mark]`, `render` is true.

- [ ] **Step 2: Gate**

Run: `pnpm run format && pnpm -w exec vitest run packages/core && pnpm run typecheck && pnpm run lint:check`

**`typecheck` is not optional here.** Vitest runs the browser project through
Vite, which strips types without checking them — the `string[]` markups
default this task originally shipped kept the whole suite green and failed
only at `pnpm run typecheck` (`TS2345`). A tests-only gate would have carried
that all the way to the pre-commit hook.

- [ ] **Step 3: Commit**

```bash
pnpm run format
git add packages/core/src/features/tokens/model/treePipeline.spec.ts
git commit -m "test(tokens): S1.5 pipeline parity suite over the tree lowering"
```

---

### Task 6: hardening — bind-generation reads, mutation proof, recorded gaps

**Files:** modify `model/treePipeline.spec.ts`, `model/treeInput.spec.ts`,
`tree/snapshotMemo.spec.ts`; comments in `model/TokenHandle.ts`.

- [ ] **Step 1: Pin the mid-window boundary read (spec §11's named S1.5 verification)**

```ts
// append to treePipeline.spec.ts
	it('reads DOM boundaries against BIND-GENERATION positions during the pending window', () => {
		// Inserting a mark at 0 moves 'llo' from [6,9] to [10,13] in the tree the
		// instant adoption runs — but the DOM still shows the old layout until the
		// adapter repaints. `tokens/boundary.ts:55` resolves every offset as
		// `token.position.start + local`, reading exactly the datum asserted here,
		// so a handle that answered with the LIVE node would put the caret four
		// characters off for the whole adopt→bind window (spec D9).
		const harness = createHarness()
		const {pipeline} = harness
		const {text2} = mount(harness)
		expect(pipeline.byElement(text2)?.token().position).toEqual({start: 6, end: 9})

		expect(harness.splice(0, 0, '@[y]')).toBe(true)

		expect(pipeline.pending()).toBe(true)
		// The tree has moved…
		expect(pipeline.current()[4].position).toEqual({start: 10, end: 13})
		// …the painted generation has not.
		expect(pipeline.byElement(text2)?.token().position).toEqual({start: 6, end: 9})

		harness.render()

		expect(pipeline.byPath().get('4')?.token().position).toEqual({start: 10, end: 13})
	})
```

Hand-traced: `'@[y]he@[x]llo'` parses to `''[0,0]`, `'@[y]'[0,4]`,
`'he'[4,6]`, `'@[x]'[6,10]`, `'llo'[10,13]`, so the tail lands at index 4 with
`{10,13}`, and the pre-edit handle holds `{6,9}`.

- [ ] **Step 2: Prove the guards are load-bearing (mutation testing)**

Apply each mutation, confirm the NAMED test fails, revert, confirm green. The
predicted kills below are **measured** — an earlier draft crossed two of them
over (see MUT 2 and MUT 3), which sends an executor hunting a bug that is not
there.

1. `apply` routes on `TransactionResult.structural` (via a `fromTransaction`
   that sets `render: result.structural`) → "a mark value change routes
   RENDER…" must fail.
2. `memo.invalidate` dirties `shifted` roots without walking children → "re-reads
   DESCENDANT positions of a shifted root…", "carries a shifted root AND its
   descendants…" **and** "stays deep-equal to a fresh parse after a run of
   edits" must fail (measured: 3 failed). The deep-equal run kills this one
   because a shifted mark's slot child keeps a stale `position`, which the
   `stripIds` comparison sees.
3. `materialize` drops `sameChildren` from its cache-hit condition → **only**
   "re-materializes an ANCESTOR whose own fields never changed" fails
   (measured: 1 failed / 5 passed). It does **not** kill the deep-equal run,
   contrary to an earlier draft: that run contains no length-preserving
   in-slot edit, so every ancestor in it is in `shifted` anyway and is dirtied
   explicitly. If you want the deep-equal run to gate `sameChildren` too, add
   a length-preserving in-slot step to its list — otherwise leave it and rely
   on the ancestor test.
4. `foldDelta` assigns instead of merging (`into.removed = new Set(delta.removed)`)
   → "merges the removals of every apply folded into one pending structural
   pass" must fail. (This is the gate on the reproduced leak in Task 2.)
5. `foldDelta` drops the `into.added.delete(id)` arm → "a node added and
   removed inside one pending window…" must fail.
6. `TokenHandle.refresh` is replaced by the live node's fields (simulate: have
   the mid-window test read `pipeline.current()` instead of the handle) →
   "reads DOM boundaries against BIND-GENERATION positions…" must fail.
7. `memo.invalidate` skips the `removed` eviction → "evicts removed ids…" must
   fail.
8. `snapshotMemo.roots` drops `dirty.clear()` → the SECOND half of "reuses the
   token of every untouched node, and KEEPS reusing across a second edit" must
   fail. Without the extension added in Task 3 this mutation survives the
   **entire** suite (measured: 843 tests, all green) while silently disabling
   every reuse after the first edit — the exact regression the memo exists to
   prevent for block layout's `memo(Block)`. Re-run this one specifically; a
   green bar here means the Task 3 test was not extended.

- [ ] **Step 3: Record the mutations that CANNOT be gated**

Do not invent tests for these; write them into the specs as comments.

- **`refresh` vs `update` on the text branch (D-c).** Restoring the path write
  is undetectable *by construction*: a text-routed commit adds and removes
  nothing, so every path is already equal. The guard is the proof in D-c, not
  a test.
- **`changes` ordering (D-e).** Add the reversal test below and label it
  honestly — it passes against both the specified implementation and its
  reverse, and exists only to fail a future refresher that accumulates state
  instead of writing absolute values.

```ts
// append to treeInput.spec.ts
	it('is order-insensitive: reversing `changes` yields the same node state', () => {
		// DOCUMENTATION, NOT A DEFECT GATE. `shifted` arrives suffix-run-reversed
		// then middle-in-document-order, and nothing depends on that: every entry
		// is an absolute write to a distinct node, and `adopt` pushes each node at
		// most once (the `covered` flag suppresses descendants of an entry). This
		// test cannot fail against the current pipeline; it will fail against any
		// future refresher that applies deltas rather than re-reading positions.
		const {tree, memo} = setup('@[x](ab)t')
		const {input} = lower(tree, memo, '@[xy](ab)t')

		const forward = input.changes.map(change => [change.id, change.token.position] as const)
		// `toReversed()`, not `[...changes].reverse()`: oxlint's
		// `unicorn(no-array-reverse)` warns on the latter and `denyWarnings: true`
		// turns that warning into a failing `lint:check` and a blocked commit.
		const reversed = input.changes.toReversed().map(change => [change.id, change.token.position] as const)
		expect(new Map(reversed)).toEqual(new Map(forward))
	})
```

- [ ] **Step 4: Document the surviving `#token` contract**

Update `TokenHandle`'s class doc: `#token` is no longer "the CURRENT parsed
token" but **the bind-generation snapshot** — what the DOM currently shows.
Name the readers that depend on it (`tokens/boundary.ts` — the DOM boundary
layer, not `tokens/tree/boundary.ts`; `SelectionController.ts:78,121`;
`DomModel.ts:95`), point at D9, and record that S1.6d narrows it to a
`{start, end}` stamp when `#token`/`update()` die together with the three
`#path` readers.

- [ ] **Step 5: Full gates + commit**

Run: `pnpm run format && pnpm test && pnpm run typecheck && pnpm run lint:check && pnpm run format:check && pnpm run build`

(`pnpm test` runs the react and vue browser projects too; they need
`pnpm exec playwright install chromium`. If a browser project is skipped, say
so explicitly in the report — AGENTS.md forbids implying everything passed.)

**Measured on the verification run, for comparison:** `pnpm test` — **73 test
files, 1267 tests passed**, with the react and vue browser projects actually
running (not skipped); `typecheck`, `lint:check`, `format:check` and `build`
all clean. A materially lower file or test count means something was
filtered — re-run without the filter before reporting green.

```bash
pnpm run format
git add packages/core/src/features/tokens/model/treePipeline.spec.ts \
        packages/core/src/features/tokens/model/treeInput.spec.ts \
        packages/core/src/features/tokens/tree/snapshotMemo.spec.ts \
        packages/core/src/features/tokens/model/TokenHandle.ts
git commit -m "test(tokens): S1.5 hardening — bind-generation reads, mutation-proven guards, recorded gaps"
```

---

## Contradictions found while writing this plan (report, do not paper over)

1. **D9's snapshot-memo rationale names the wrong beneficiary.** It says
   "the compat renderer memoizes on object identity, so without per-node
   reuse every structural commit re-renders every mark". Measured against the
   adapters: the inline (default) path's `memo(Token)`
   (`packages/react/markput/src/components/Token.tsx:14`) is already defeated
   by a fresh `path={[i]}` array at `Container.tsx:40` and `Token.tsx:26`
   (Vue mirrors at `Container.vue:62`, `Token.vue:40`), and
   `packages/storybook/src/pages/renderCount.react.spec.tsx:58` pins that a
   structural edit already re-renders. The user's `Mark` receives primitives
   (`resolveSlot.ts:68` passes `{value, meta}`), not the token, so a fresh
   Token does not by itself re-render a memoized childless Mark. **Where the
   memo genuinely pays:** block layout, where `memo(Block)`,
   `memo(DragHandle)`, `memo(BlockMenu)` and `memo(DropIndicator)` take
   `{token, blockIndex}` only — there, losing today's `tokenIdentity` object
   reuse (`tokenIdentity.ts:221-222,257-258`, pinned by
   `tokenIdentity.spec.ts:41,107,167,228,256`) would newly re-render every
   unrelated row on every structural commit. The memo is still required — it
   is a regression guard, not the optimization D9 advertises. Fixing the
   inline `path` allocation is out of S1.5's scope and belongs with S1.7's
   render-loop question.
2. **The roadmap's "where the result feed lives" premise is stale** —
   `createUncontrolledSink` no longer exists and the feed is already on the
   boundary covering both paths (D-f). Its suggestion to hoist to the
   dispatcher would break the controlled path.
3. **Spec §11's S1.5 line asks for a node-backed `TokenHandle`; D9 in the
   same document says `#token` survives until S1.6d.** Taken together with
   AGENTS.md's no-surface-without-a-caller rule, the two cannot both be
   honored minimally. D-b resolves it in favor of D9 and defers node-backing
   to the phase that gains the caller.
4. **D9 asks the fold to compose `map()`; §2.3's payload has no `map`.**
   Resolved in D-h: merge the id lists now, compose `map` in S1.6c.
5. **The spec's spec-migration estimate is high, and its production estimate
   is the wrong shape.** ~1,670 spec lines are budgeted; the four files are
   2,058, but `bind.spec.ts` (684) and `TokenModel.spec.ts` (388) need no
   migration at all. Conversely `commit.ts` is *not* mostly rewritten — the
   pipeline body survives; what changes is its input type and one routing
   name. Budget by the table in the File structure section.
6. **The roadmap's status table is stale**: it lists S1.4 as "plan written &
   verified", but S1.4 is executed and committed (`7585e534`, `4f84cb5c`).
7. **A latent bug this phase fixes as a side effect — REPRODUCED, not
   inferred.** `commit.ts:167` overwrites `pendingRemovedIds` per apply.
   Measured against the shipped pipeline: two structural applies before one
   bind, `'a@[x]b@[y]c'` → `'ab@[y]c'` (reconcile `removedIds` `[2, 3]`) then
   `'ab@[y]c'` → `'abc'` (`removedIds` `[4, 5]`), one `render()` — the paint
   announces `pipeline.removedIds() === [4, 5]` and markX (id 2) is dropped on
   the floor. `BlockController` prunes `#stores` off exactly that list, so
   those rows' `BlockStore` is leaked for the input's lifetime. Task 2's
   `foldDelta` fixes it, its first new test pins it, and Task 6's MUT 4
   (assign instead of merge) kills that test — so the fix is gated, not merely
   asserted. Called out in the Task 2 commit body.

## Self-review notes (spec → plan)

- Covers S1.5's scope line: `TransactionResult` consumption, `render`
  routing, fold merging, the `changed` payload, the BlockController
  migration, compat snapshot invalidation, and the bind-generation read
  semantics.
- Behaviors §11 requires to survive intact are covered by the Task 5 parity
  suite: fold guard, self-heal escalation, `assertAligned`, mount/editable
  seeding (through the untouched `bind.ts` + its untouched suite), control
  roots (untouched `computeControlRoots`), block rows (untouched
  `resolveRoot`; block-layout binding stays pinned by `bind.spec.ts:139-205`).
- **Deliberately deferred, with reasons above:** node-backing `TokenHandle`
  (D-b), `map()` composition (D-h), `selectionBefore` (S1.6a owns the
  channel), deleting `removedIds()` (§4.6 item 6, S1.6d), the inline `path`
  allocation that defeats `memo(Token)` (contradiction 1).
- **Not in this plan:** any Store wiring, any `beforeinput` change, any
  `ValueModel` change, any deletion. The tree lowering has no live caller
  when this phase ends — S1.6a adds it.

### Decision audit (post-implementation)

All eight decisions survive the verification pass.

| decision | verdict |
| --- | --- |
| D-a one pipeline, two lowerings | holds — `bind.ts` and `bind.spec.ts` were never touched, as predicted |
| D-b `TokenHandle` not node-backed | holds — Task 6 Step 1's mid-window test measures it |
| D-c text branch stops refreshing `#path` | holds — no assertion moved, exactly as the "honest gap" predicted |
| **D-d snapshot memo** | **holds WITH CAVEATS** — the mechanism is right, but its worked example produced an unrunnable, semantically inverted first test (C1: a head insert dirties *every* root), and `dirty.clear()` was an entirely ungated guard (M1). Both corrected in Task 3; M1 also added as Task 6 MUT 8 |
| D-e `shifted` is unordered | holds — both ordering claims reproduce; only the transcript's ids and one count were wrong, now fixed |
| D-f feed stays on the boundary | holds |
| D-g `render` is the routing bit | holds — Task 6 MUT 1 kills the alternative |
| D-h no `map()` in the fold | holds |

**Reviewer's checklist for the two items this plan cannot resolve itself:**
after Task 2, `TokenModel.removedIds()` has zero production consumers (§4.6
item 6 deletes it in S1.6d — see Task 2 Step 5); and `refresh`-vs-`update` on
the text branch is ungated by construction (D-c, Task 6 Step 3).
