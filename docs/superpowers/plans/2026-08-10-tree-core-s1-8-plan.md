# Tree Core S1.8 (Dead-surface sweep) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** close the rewrite by deleting what it made dead. Spec §11's S1.8 entry
lists seven steps; this plan **executes four of them, folds one into the others,
reports one as already done, and defers one to its own phase** — each with the
measurement that forced the call. What ships: the pre-existing cruft
(`src/test-utils/`, `parser.profile.bench.ts` + `parser.profile.json`, the
write-only `control(ownerPath)` channel, `#placeAt`'s unread boolean); the path
layer (`tokenIndex.ts`, `TokenPath`, `children(ownerPath)` re-keyed on ids, the
path-keyed bind result, the adapters' `path` prop); the superseded modules
(`ValueModel`, `replaceInString`); and the documentation, which in three places
described the opposite of what ships. Per spec
`2026-08-08-markput-s1-tree-core-v2.md` (v2.2) §11's S1.8 entry, §2.3, §4.6, §9,
D8 and D11.

**Architecture:** nothing here changes a contract that a user can observe. Both
adapters' `dist/index.d.ts` tail export statements are **byte-identical before
and after** (measured, both packages) — S1.7 already executed the §2.3 table, so
everything this phase removes is either core-root-only (unreachable:
`@markput/core` is unpublished) or internal. The one exception is deliberate and
adapter-internal: `tokens.children()` changes its key from a `TokenPath` to the
owning mark's stable id, which is what lets the path layer die.

**Tech stack:** TypeScript, the shipped `tree/`, `model/`, `selection/` and
`store/` modules, Vitest (three Chromium browser projects — even the `core`
project runs in real Chromium, `vite.config.ts:38`), Storybook 9 + Playwright,
Astro/Starlight + starlight-typedoc for the website.

**Prerequisites:** S1.1–S1.7 complete and committed on `b0`
(`12ead317..b4763c95`).

## Plan status / Verification status

**Written** 2026-08-10 against `b4763c95`. **Verified by implementation**
2026-08-10: every task below was implemented in a throwaway worktree detached at
`b4763c95`, every gate was run at every task boundary, all six commits were
checked out and re-gated afterwards, and 9 mutations were applied and re-run.
Everything below is labelled: *measured* claims carry their command or
`file:line`; the places where no test can discriminate are named rather than
decorated.

**Baseline reproduced** at `b4763c95`: `pnpm test` → **73 files, 1326 passed, 7
todo (1333)**; `build`, `typecheck`, `lint:check`, `format:check` and
`pnpm -F @markput/website run build` (49 pages) clean, and `git status` clean
after `typecheck` — the starlight-typedoc regeneration is a no-op while the
*adapter* barrel is unchanged, which is the fact S1.7's contradiction 10 was
missing.

**Final state with every correction folded in:** `pnpm test` → **72 files, 1323
passed, 7 todo (1330)**; `typecheck` 0 errors, `lint:check` clean, `format:check`
clean, `pnpm run build` clean, website build clean (49 pages). Diff against the
baseline: **64 files changed, +807/−2639 — net −1,832 lines**, 7 files deleted, 1
renamed.

| | files changed | +/− |
| --- | --- | --- |
| core | 44 | +709 / −2522 |
| react | 7 | +34 / −40 |
| vue | 7 | +25 / −39 |
| storybook | 1 | +12 / −10 |
| website | 5 | +27 / −28 |

Test count moves down by 3 (`tokenIndex.spec.ts`, 3 cases) and by 2 (the two
`replaceInString` unit cases), and up by 2 (the new `handleDeleteKey` cases):
1326 → 1323.

**Green at every task boundary — verified, not asserted.** Each of the six
commits was checked out and re-gated:

| commit | `pnpm test` | tsc errors | lint | format |
| --- | --- | --- | --- | --- |
| Task 1 | 73 files, 1326 passed, 7 todo | 0 | clean | clean |
| Task 2 | 73 files, 1326 passed, 7 todo | 0 | clean | clean |
| Task 3 | 72 files, 1323 passed, 7 todo | 0 | clean | clean |
| Task 4 | 72 files, 1321 passed, 7 todo | 0 | clean | clean |
| Task 5 | 72 files, 1321 passed, 7 todo | 0 | clean | clean |
| Task 6 | 72 files, 1323 passed, 7 todo | 0 | clean | clean |

### Hard stops found (all fixed in place below, each marked `[HARD STOP]`)

1. **Task 2 — id-keyed `children()` imposes a registration ORDER that path
   keying did not, and one spec was silently destroying its own fixture.**
   A path can be registered before the tree exists; an id cannot. Moving
   `TokenModel.spec`'s "children() refs scope the structural walk" registration
   after `host.container(container)` made it fail with
   `expected undefined to be <span></span>` — because `container()` fires the
   `host.rendered` watch **immediately**, so the mount bound the pre-painted DOM
   with no host registered, mis-bound the slot child to `wrapper`, and
   `applyMountState` wrote `wrapper.textContent = 'ab'`, **deleting `childSpan`
   from the DOM** before the real bind ever saw it. The fix is the real adapter
   order: mount the EMPTY container, paint, register, then `rendered()`.
   `SelectionController.spec`'s equivalent helper survives the naive reorder only
   by luck — its frame count mismatches and the walk bails before writing.
2. **Task 2/3 — `typecheck` does not see an unused type import; `lint:check`
   does.** Removing `TokenPath` from `TokenModel.ts` and `commit.ts` left two
   dead `import type` lines that compile clean and fail
   `eslint(no-unused-vars)` — i.e. fail at `git commit`, not at the tests. This
   is the third phase in a row where the gate that caught the task was
   `lint:check`.
3. **Task 3 — `noUncheckedIndexedAccess` is off, so the spec helpers' bounds
   guard is linted away.** `siblings[index]` types as `Token`, so
   `if (!token) return undefined` is `typescript(no-unnecessary-condition)`, and
   an explicit `const next: Token | undefined = …` annotation does NOT help
   (TS narrows the initializer). `siblings.at(index)` is the spelling that both
   compiles and keeps the guard.
4. **Task 4 — deleting `ValueModel` silently HALVES a named gate.** The mutation
   "`TokenModel#seeded` is a plain field, not a signal" killed **3** cases before
   the deletion and **1** after. `ValueModel.current` was a writable computed,
   and a writable computed evaluates its getter before the set — that implicit
   read-before-write was what made the two surviving cases discriminate.
   `tokens.replace` has no such read. Two `Store.spec` cases get an explicit
   `expect(store.tokens.value()).toBe('')` first, restoring all three (Task 6).
5. **Task 6 — `handleDeleteKey`'s all-selected branch is NOT redundant, and the
   obvious test does not prove it.** Deleting the branch survives the entire
   suite (1321/1321) including a freshly added "Backspace with everything
   selected" case. It diverges only when the STORED selection says all-selected
   while the DOM selection is gone: `readRaw()` answers `undefined`, the
   fallthrough returns without `preventDefault`, and the browser mutates
   contenteditable behind the model. `window.getSelection()?.removeAllRanges()`
   after `selectAll()` is the discriminating fixture.

### Predictions this plan made before the run that turned out FALSE

- **"Step 2 (root-export narrowing) has real work left."** **False, measured.**
  S1.7 Task 5 executed the table; the only remaining zero-importer root export is
  `MarkInit`, one line. Step 2 is folded into Task 1 rather than given a task.
- **"Every `pnpm run typecheck` regenerates `content/docs/api/**` and dirties the
  repo"** (recorded as S1.7 hard stop 12 and carried into this plan's brief).
  **False as stated, measured.** starlight-typedoc runs against the **react
  adapter barrel**, not the core root. Every gate in this phase left
  `git status` clean, because no adapter export changed. The S1.7 statement was
  true *of S1.7*, whose Task 5 rewrote the adapter barrels.
- **"The spec's gate — the adapter DTS tail diffs by exactly the §2.3 table."**
  **The correct answer is ZERO diff**, measured on both packages: the tail export
  statements are byte-identical before and after. Nothing S1.8 removes was ever
  republished.
- **"`snapshot.ts` + `joinNodes` are the §7.1 gate with zero production
  callers"** (spec trap list). **Half false, measured.** `joinNodes` has three
  production callers in `tree/tree.ts` alone (`:59`, `:70`, `:133`) — it is the
  projection, not a test helper. `snapshot`/`stripIds` are indeed spec-only.

### Surviving mutations

9 mutations were applied and re-run. **Eight died against a named test.** One —
`children()` ignoring its `ownerId` — survives the entire `core` project (878
tests) and dies only in the browser suites (100 failures). Recorded, not
patched: the core project has no fixture with two slot marks, and inventing one
to duplicate coverage the browser suites already give is the kind of test
AGENTS.md tells you not to add. Details in Task 6.

**Gates.** Every per-task gate LEADS with `pnpm run format` and includes
`pnpm run lint:check`: the pre-commit hook runs `oxfmt --check` and `oxlint` with
`denyWarnings: true` **and `reportUnusedDisableDirectives: 'deny'`**
(`oxlint.config.ts:146-149`), so a tests-only gate defers the failure to
`git commit`. Tasks 1, 2 and 6 run the FULL `pnpm test` (adapter files change,
and Task 6's one surviving mutation is browser-only); Tasks 3 and 4 are core-only
plus `typecheck`; Task 5 adds the website build.

**Revert units.** Six tasks, six commits, six revert units, and they are
genuinely independent in both directions **except** Task 3 ⇒ Task 2: reverting
Task 2 alone restores `children(ownerPath)` against a `TokenPath` type Task 3
deleted. Task 1 is landable at any time and against any prerequisite, exactly as
spec §11 says.

---

## Decisions taken before writing this plan (do not re-litigate)

### D-a. The render-loop move (step 3) is NOT in S1.8. It is its own phase, S1.10

§11's step 3 reads "snapshot names out of the four barrels — `Token`/`TextToken`/
`MarkToken`, `keyOf`, `handleOf`, the `renderTree`/`current()` reads", and the
spec's own size estimate treats it as a barrel edit. S1.7's decision D-c already
reported that framing as wrong. Sized honestly here, against the code:

| what moves | measured |
| --- | --- |
| core production files that type on `Token` | **21** files (`grep -rln "from '.*parser/types'" packages/core/src --include='*.ts' \| grep -v '\.spec\.'`) |
| core production lines in the blast radius | **2,481** (`DomModel` 222, `boundary` 153, `TokenHandle` 214, `bind` 255, `commit` 254, `commitInput` 64, `treeInput` 85, `snapshot` 64, `snapshotMemo` 112, `serializeRange` 21, `blockEdit` 284, `input` 137, `BlockController` 56, `operations` 159, `ClipboardController` 45, `SelectionController` 356) |
| pipeline spec lines pinned to `Token[]` shapes | **3,180** (`bind.spec` 681, `treePipeline.spec` 792, `model/TokenModel.spec` 394, `model/TokenHandle.spec` 302, plus the four top-level `TokenModel.*.spec` and `TokenHandle.spec`) |
| adapter + storybook files importing `Token`-family types | **14** at `b4763c95` after Task 2 (5 react, 6 vue, 3 storybook) |
| `tokens.current()` production call sites outside the token layer | **8** (`selection` ×2, `keyboard/input` ×1, `keyboard/blockEdit` ×4, `block` ×1, `clipboard` ×1) |

For comparison, S1.5 — the largest phase shipped so far, and the one whose
estimate was questioned twice — was budgeted at ~680 production lines adapted
plus ~1,670 spec lines. The render-loop move is **3.6× its production surface and
1.9× its spec surface**, and unlike every other item in this phase it is a
net-ADD: it changes a representation, it does not delete one. It also drags the
one thing spec §11's own trap list calls irreducible ("the eight-file
contenteditable adapter, ~1,300 lines"), because `renderTree` feeds `bind.ts`,
`commit.ts`'s divergence detector compares `handle.token().content`, and
`TokenHandle#token` is D9's read latch with five production readers.

**Therefore:** S1.8 does not touch the render loop, `keyOf`, `handleOf`,
`renderTree`, `current()` or the `Token` family in any barrel. They get a comment
naming **S1.10** (after S1.9's pure moves) as their phase. The one thing step 3
*can* deliver without the loop — dropping `TextToken`, which has zero importers
anywhere — is deliberately NOT taken: `Token` is `TextToken | MarkToken`, all
three are re-exported by both published adapters, and removing one name of a
three-name union now and the other two next phase is churn, not a sweep.

**Reported consequence:** spec §11's "net −2,300 to −2,600 source lines, ~20
files deleted, ~35 edited" is an estimate for a phase that includes step 3. The
phase that ships is **−1,832 lines, 7 files deleted, 64 edited**.

### D-b. Step 2 (root-export narrowing) is already executed. Its residue is one line

§11 step 2 lists `event`, `isReactive`, `Signal`, `Event`, `merge`,
`DEFAULT_OPTIONS`, `SlotRegistry`, `CoreSlotProps`, `Range`, `MarkSlot`,
`OverlaySlot`. Measured against `packages/core/index.ts` at `b4763c95`: **every
one of them is already gone except `SlotRegistry`, which S1.7 proved must stay**
(both adapters augment it; dropping it collapses `Slot` to `unknown`, 8 JSX type
errors). S1.7 Task 5 did this work.

What is left, measured by extracting every named import of `@markput/{core,react,vue}`
across `packages/{react,vue}/markput/src`, `packages/storybook/src` and the two
demo apps:

- **`MarkInit`** — zero importers, and **neither adapter republishes it**, so a
  userland consumer of the two packages that actually ship cannot name it. It is
  the parameter type of `MarkputApi.insertMark`, so structural typing keeps the
  verb usable with an object literal, and the rolled-up DTS keeps the declaration
  as a local. Confirmed by the typedoc output: there is no
  `api/type-aliases/MarkInit.md`, because typedoc walks the adapter barrel.
  **Drop it** — and if someone later wants it nameable, the fix is to add it to
  the adapter barrels, not to keep an unreachable core-root export.
- **`Id`, `TreeNode`, `NodeAnchor`, `MarkPatch`, `TextToken`** — zero *imports*,
  but all five are re-exported by both published adapters and are the shapes of
  §2.3's public reads and write verbs. **Keep.** The table's method — "zero
  importers ⇒ drop" — is exactly what produced five wrong rows in S1.7; a type
  that names a published method's parameter or return is load-bearing with zero
  importers.

One line is not a task. `MarkInit` lands in Task 1, which is where the other
zero-consumer surface goes.

### D-c. Step 6's port-or-delete budget, file by file

§11 demands "a written budget, not a default". Here it is. Note first that the
spec sized step 6 at "~2,000 lines of behavior pinned against the old surface" —
that number assumes step 3 happened. With the render loop staying, the
`Token[]`-shaped suites (`bind.spec` 681, `treePipeline.spec` 792,
`model/TokenModel.spec` 394, `TokenModel.facade.spec` 348 …) still pin **live**
behavior and are not "old surface" at all. What actually comes loose is 264
lines:

| file | lines | disposition | why |
| --- | --- | --- | --- |
| `features/tokens/tokenIndex.spec.ts` | 55 | **DELETE** | Three cases, all unit tests of `pathEquals`/`pathKey`/`resolvePath`. The module goes; there is no behavior left to pin, and re-homing `resolvePath` as a test helper would be keeping the module under another name. |
| `features/state/ValueModel.spec.ts` | 209 | **PORT 12 of 14** → `features/tokens/TokenModel.value.spec.ts` | Every case except two exercises the token layer through a mounted `Store`; the facade was a delegation. The two dropped are unit tests of `replaceInString` (`:130-138`), which dies with the helper — `tree/offsetShim.spec.ts`'s "rejects the ranges replaceInString rejected" is the gate that already replaced them. |
| `features/state/ValueModel.spec.ts`'s "value hinge (S1.6a)" note | 12 | **RESOLVE, do not re-record** | It documented a behavior divergence (`value.current(x)` on an equal value no longer emitting) that only the writable computed could produce. With the facade gone the divergence is gone; carrying the note forward would describe a mechanism that no longer exists. |
| `bind.spec.ts` byPath assertions | ~45 sites | **PORT in place** (Task 3) | They pin real bind behavior; only the lookup spelling changes. A local `at(result, ids, tokens, …path)` helper keeps the fixtures readable — a case names a token by where it sits, which is how a human describes a tree. |
| `treePipeline.spec.ts` byPath assertions | ~30 sites | **PORT in place** (Task 3) | Same, via `boundAt(pipeline, …path)`. |
| `SelectionController.spec.ts:404-406` | 3 | **PORT in place** (Task 3) | `resolvePath(tree, [1, n])` becomes a destructure of `outer.children`, which is what the case actually means. |
| `Store.spec.ts` value cases | ~15 sites | **PORT in place** (Task 4), and **two get STRONGER** | See hard stop 4 — a mechanical port would have halved a named gate. |

**Nothing is deleted by default.** The only deletions are five cases whose
subject no longer exists.

### D-d. The §9 directory regroup does NOT ride along. S1.9 stays a separate phase of pure moves

Spec §9 defers it "to a separate S1.9 of pure-move commits (no content edits), so
it does not destroy the git blame of the files S1.8 deletes from". Confirmed, and
the evidence is stronger after the run than before:

1. **S1.8 deletes 7 files and rewrites 2 READMEs.** Every one of them
   (`tokenIndex.ts`, `ValueModel.ts`, `replaceInString.ts`, `test-utils/dom.ts`,
   `parser.profile.bench.ts`) would otherwise be moved *and* deleted, or moved
   *and* rewritten, in one diff. Doing the sweep first means S1.9 moves 7 fewer
   files and rewrites none.
2. **AGENTS.md is explicit:** "Make structural changes (moves, renames, splits)
   pure: relocate code without changing behavior, so the diff is a clean move."
   Task 3 alone is a 10-file behavior-preserving refactor with 75 spec-assertion
   rewrites; folding a directory move into it makes the diff unreviewable.
3. **Measured cost of NOT folding: zero.** Nothing in this phase is blocked by a
   file's location. The only near-miss is `features/state/ValueModel.spec.ts`,
   which Task 4 moves to `features/tokens/` — but that is a *rename that follows
   its subject*, which is the port, not a regroup.

**Therefore:** confirmed as written. S1.9 remains pure moves, after this phase.

### D-e. `control()` loses its argument, and the four now-unread `blockIndex` props go with it

The `ownerPath` argument is write-only: `#pendingControls` is read by exactly one
function, `#controlElements()`, which returns `new Set(values.map(r => r.element))`
and never looks at `ownerPath`. Dropping it removes the last reader of
`blockIndex` in `BlockMenu` and `DropIndicator` in **both** adapters, so those
props and their four pass-sites in `Block.tsx`/`Block.vue` go too — otherwise the
sweep leaves four dead props behind. `DragHandle` keeps `blockIndex`
(`attachGrip`).

In Vue this also collapses three pointless `computed(() => store.tokens.control([props.blockIndex]))`
wrappers into a single `store.tokens.control()` call at setup — a stable ref
instead of one that churned a fresh registration key on every `blockIndex`
change.

### D-f. `anchorAt`'s `export` is REFUTED, not swept

Spec §11 step 1 lists "`anchorAt`'s `export`" as dead surface. It has had
production callers since S1.6c moved it into `tree/anchors.ts`:
`tree/adopt.ts:6,232` (the `map` implementation) and
`model/TokenModel.ts:10,299`. The S1.6bcd plan's contradiction 7 already recorded
this. **The item is stale; leave the export alone.**

### D-g. `bind`'s result is re-keyed on ids, even though §11 only names `children(ownerPath)`

Once `children()` is id-keyed, `pathKey` has exactly one caller left:
`bind.ts:94`, keying a map whose key **no production consumer ever reads**. All
three consumers iterate the values (`commit.ts`'s `assertAligned`,
`TokenModel.setEditable`, `DomModel.boundHandles`). Keeping it would mean keeping
`tokenIndex.ts` (which §11 says to delete) or inlining `path.join('.')`, and
keeping `collectTree`/`walkDom` building a throwaway array per token per bind for
a key nobody looks up. `byPath: ReadonlyMap<string, TokenHandle>` becomes
`bound: ReadonlyMap<number, TokenHandle>`; the cost is 75 mechanical spec-lookup
rewrites, taken.

### D-h. `handleDeleteKey`'s all-selected branch STAYS

Flagged as "redundant with its own fallthrough". Refuted — see hard stop 5. It
also had **zero direct coverage**; Task 6 adds two cases, and only the second
discriminates. Recorded at the site so the next sweep does not re-litigate it
from the same reasoning.

### D-i. `packages/core/README.md` is step 7's, not step 1's

§11 step 1 says "the stale core README line", singular. There is one line that
step 1 falsifies directly — `pnpm test:bench:watch`, a script
`packages/core/package.json` does not define — and it is fixed in Task 1 next to
the benchmark deletion. But the file also advertises `Parser`, `caretDom`,
`EventBus`, `NodeProxy`, `getTokensByUI`, `SystemEvent`, `MarkStruct`,
`isAnnotated`, `deleteMark`, `getClosestIndexes`, `escape`, `toString`,
`shallow`, `DEFAULT_CLASS_NAME`, `KEYBOARD` and `PLACEHOLDER` — **none of which
is a root export**. That is a rewrite, and it belongs with the other
documentation in Task 5.

---

## File structure

**Delete:**

- `packages/core/src/test-utils/dom.ts` (18) — and the directory.
- `packages/core/src/features/tokens/parser.profile.bench.ts` (928) and
  `parser.profile.json` (786).
- `packages/core/src/features/tokens/tokenIndex.ts` (21) and
  `tokenIndex.spec.ts` (55).
- `packages/core/src/features/state/ValueModel.ts` (23).
- `packages/core/src/shared/utils/replaceInString.ts` (5).

**Rename:**

- `packages/core/src/features/state/ValueModel.spec.ts` →
  `packages/core/src/features/tokens/TokenModel.value.spec.ts`.

**Modify (core):** `index.ts`, `README.md`, `model/TokenModel.ts`,
`model/bind.ts`, `model/commit.ts`, `shared/editorContracts.ts`,
`shared/utils/index.ts`, `features/state/index.ts`, `store/Store.ts`,
`features/edit/EditController.ts`, `features/keyboard/KeyboardController.ts`,
`features/keyboard/input.ts`, `features/keyboard/blockEdit.ts`,
`features/block/BlockController.ts`, `features/overlay/OverlayController.ts`,
`features/selection/SelectionController.ts`,
`features/tokens/README.md`, `store/README.md`, `shared/signals/README.md`,
plus 13 spec files.

**Modify (adapters):** react `Block.tsx`, `BlockMenu.tsx`, `DragHandle.tsx`,
`DropIndicator.tsx`, `Container.tsx`, `Token.tsx`, `TokenChildren.tsx`; vue the
same seven.

**Modify (storybook):** `pages/Base/Base.vue.spec.ts` (one case).

**Modify (website):** `development/architecture.md`, `development/how-it-works.md`,
`development/inconsistencies.md`, `guides/dynamic-marks.md`,
`guides/keyboard-handling.md`.

**Do NOT touch:** the parser, `TokenHandle.ts`, `DomModel.ts`,
`tokens/boundary.ts`, `caret.ts`, `textOffsets.ts`, `tree/adopt.ts`,
`tree/snapshot.ts`, `tree/snapshotMemo.ts`, `utils/findGap.ts`,
`utils/serializeRange.ts`, `filterEmptyText`, `parser.bench.ts`,
`parser.bench.result.json`, the internal offset shim (`tree/offsetShim.ts`, D8),
`block/operations.ts`, `clipboard/`, the `Token`/`TextToken`/`MarkToken` barrel
exports, `keyOf`/`handleOf`/`renderTree`/`current()`, and `SlotRegistry`.

---

## Task 1: pre-existing dead surface (spec §11 steps 1 + 2)

**Files:** delete `src/test-utils/`, `parser.profile.bench.ts`,
`parser.profile.json`; modify `packages/core/index.ts`, `packages/core/README.md`,
`model/TokenModel.ts`, `features/selection/SelectionController.ts`, two core
specs, six adapter components, two adapter `Block` files.

Landable at any time and against any prerequisite (spec §11), which is why it is
first and separate.

- [ ] **Step 1: delete the three zero-reference artifacts**

```bash
git rm -r packages/core/src/test-utils \
         packages/core/src/features/tokens/parser.profile.bench.ts \
         packages/core/src/features/tokens/parser.profile.json
```

Evidence, all three measured before deleting:

- `grep -rn "test-utils" packages/` → the only hit outside the file itself is
  spec §11 naming it. `createEditableDiv`/`cleanup` have zero importers.
- `grep -rn "parser\.profile" packages/ vite.config.ts` → the only hit is
  `parser.profile.bench.ts:506` writing its own JSON. `getComplexityForMethod`
  (`:428,497,634`) dies with it. `features/tokens/README.md:338` and spec §8 name
  **only** `parser.bench.ts` as the tripwire, and
  `packages/core/package.json`'s `bench` script runs the whole `--project core`
  bench set, so the profile bench was running on every `pnpm bench` for nobody.
- `parser.bench.ts` and `parser.bench.result.json` STAY — the README references
  them by name in four places (`:338,356,365,370`). They are on the trap list.

- [ ] **Step 2: `control()` loses its write-only argument**

`model/TokenModel.ts`:

```ts
	/**
	 * Ref callback for a control element (e.g. overlay, drag handle). Registration is
	 * ELEMENT-ONLY: the sole reader is `#controlElements`, which feeds bind's
	 * `computeControlRoots` — a walk from each control up to the container. Nothing ever
	 * asks which token owns a control, which is why the `ownerPath` argument the six
	 * adapter call sites used to pass was write-only and went at S1.8 step 1.
	 */
	control(): DomRef {
		const key = `control:${++this.#nextControlId}`
		return element => {
			if (element) {
				this.#pendingControls.set(key, element)
			} else {
				this.#pendingControls.delete(key)
			}
		}
	}
```

the registry collapses to the element map it always was:

```ts
	readonly #pendingControls = new Map<string, HTMLElement>()
```

```ts
	#controlElements(): ReadonlySet<HTMLElement> {
		return new Set(this.#pendingControls.values())
	}
```

and `type ControlRegistration` is deleted.

- [ ] **Step 3: the six adapter call sites, and the four props they orphan**

React (`BlockMenu.tsx`, `DragHandle.tsx`, `DropIndicator.tsx`) — the comment
"A row's path is its block index by construction" goes with the argument:

```tsx
	const controlRef = useMemo(() => tokens.control(), [tokens])
```

Vue (`BlockMenu.vue`, `DragHandle.vue`, `DropIndicator.vue`) — with no argument
the `computed` wrapper is pointless, and dropping it also stops churning a fresh
registration key whenever `blockIndex` changes:

```ts
const dropControlRef = store.tokens.control()

const setDropRef = (el: unknown) => {
	dropControlRef(el as HTMLElement | null)
}
```

`import {computed} from 'vue'` then goes from `BlockMenu.vue` and
`DropIndicator.vue` (`DragHandle.vue` keeps it for `alwaysShowHandle`).

**`blockIndex` is now unread in `BlockMenu` and `DropIndicator`** — react
`BlockMenu.tsx` becomes `({token}: {token: Token})`, react `DropIndicator.tsx`
becomes `({token, position}: {token: TokenType; position: 'before' | 'after'})`,
the two Vue `defineProps` drop it, and `Block.tsx`/`Block.vue` drop the four pass
sites. `DragHandle` keeps it (`attachGrip(el, blockIndex, …)`).

- [ ] **Step 4: `#placeAt` returns nothing**

`features/selection/SelectionController.ts` — its one caller
(`#applySelection`, `:214`) ignores the boolean:

```ts
	#placeAt(anchor: NodeAnchor): void {
		const target = anchorTarget(anchor)
		if (target) {
			const handle = this.tokens.handle(target.id)
			if (handle?.alive() && handle.placeCaret(target.offset)) return
		}
		this.tokens.placeCaret(this.tokens.offsetOf(anchor))
	}
```

- [ ] **Step 5: `MarkInit` leaves the root export, and the README's dead script line**

`packages/core/index.ts` — delete
`export type {MarkInit} from './src/store/MarkputApi'` (D-b).

`packages/core/README.md`:

```diff
-# Run benchmarks
-pnpm test:bench:watch
+# Run the parser benchmark tripwire
+pnpm bench
```

The rest of that file is Task 5's (D-i).

- [ ] **Step 6: the two spec call sites `typecheck` will find**

`TS2554: Expected 0 arguments, but got 1` at
`features/selection/SelectionController.spec.ts:77` and
`features/tokens/TokenModel.index.spec.ts:73`:

```bash
sed -i '' 's/store\.tokens\.control(\[0\])(control)/store.tokens.control()(control)/' \
  packages/core/src/features/selection/SelectionController.spec.ts \
  packages/core/src/features/tokens/TokenModel.index.spec.ts
```

- [ ] **Step 7: gate — FULL suite (adapter files changed)**

Run: `pnpm run format && pnpm test && pnpm run typecheck && pnpm run lint:check && pnpm run format:check && pnpm run build`
Measured: **73 files, 1326 passed, 7 todo**; tsc 0, lint clean, format clean,
build clean. Diffstat: **17 files, +50/−1793**.

- [ ] **Step 8: commit**

```bash
git add -A
git commit -m "refactor(core): S1.8 step 1 — sweep pre-existing dead surface

Deletes src/test-utils/ (zero importers), parser.profile.bench.ts + its
parser.profile.json (zero references; the README and spec §8 name only
parser.bench.ts as the tripwire), and the write-only ownerPath argument of
tokens.control() — the registry's only reader takes the element alone.

Dropping the argument leaves blockIndex unread in BlockMenu and DropIndicator
in both adapters, so the prop goes with it. SelectionController.#placeAt returns
void: no caller read its boolean. MarkInit leaves the core root export — zero
importers, and neither adapter republishes it, so it is unreachable from the two
packages that ship."
```

---

## Task 2: child-sequence hosts register by owner id (spec §11 step 4a)

**Files:** `model/TokenModel.ts`, `model/bind.ts`, `model/commit.ts`,
`model/bind.spec.ts`, `model/TokenModel.spec.ts`,
`features/selection/SelectionController.spec.ts`; react `TokenChildren.tsx`,
`Token.tsx`, `Container.tsx`, `Block.tsx`; vue `TokenChildren.vue`, `Token.vue`,
`Container.vue`, `Block.vue`; storybook `pages/Base/Base.vue.spec.ts`.

This is the adapter-visible half of step 4 and the only behavior-adjacent change
in the phase. It has to be one commit: the moment `TokenChildren` stops taking a
path, `Token`'s `path` prop has no reader and both adapters have to drop it in
the same step to stay green.

- [ ] **Step 1: re-key the registry**

`model/TokenModel.ts`:

```ts
	/**
	 * Ref callback for the element hosting a token's child sequence, keyed by the OWNER's
	 * stable id (S1.8 step 4). It was keyed by `TokenPath` until then; the id is the same
	 * thing bind already resolves per token, and it does not go stale when a sibling above
	 * the owner is added or removed mid-render.
	 */
	children(ownerId: number): DomRef {
		const key = `children:${++this.#nextChildSequenceId}`
		return element => {
			if (element) {
				this.#pendingChildSequences.set(key, {ownerId, element})
			} else {
				this.#pendingChildSequences.delete(key)
			}
		}
	}
```

```ts
	/**
	 * `undefined` is a total answer, not a guard: an unregistered id and an id-less token
	 * both match no registration, so the loop answers `[]` without a branch. Bind's id
	 * pre-pass has already thrown for an id-less token by the time the walk asks.
	 */
	#childSequenceHostsFor(ownerId: number | undefined): HTMLElement[] {
		const out: HTMLElement[] = []
		for (const registration of this.#pendingChildSequences.values()) {
			if (registration.ownerId === ownerId) out.push(registration.element)
		}
		return out
	}
```

`type ChildSequenceRegistration` becomes `{readonly ownerId: number; readonly element: HTMLElement}`,
the pipeline dep becomes `childSequenceHostsFor: ownerId => this.#childSequenceHostsFor(ownerId)`,
and `import {pathEquals} from '../tokenIndex'` goes.

**The `number | undefined` parameter is deliberate.** `walkDom` has `idFor`,
which returns `number | undefined` because `Token.id` is optional; accepting the
optional makes the lookup total, where a non-null assertion or a second
`if (id === undefined) throw` would either fight the linter or duplicate the
throw `collectTree` already performs.

- [ ] **Step 2: thread the id through bind**

`model/commit.ts` — `CommitDeps.childSequenceHostsFor: (ownerId: number | undefined) => readonly HTMLElement[]`.

`model/bind.ts` — the same on `BindInput` (with
`/** Registered `__slot__` hosts for one owner, resolved by the owner's stable id. */`),
`walkDom` gains an `idFor` parameter, and its per-token line becomes:

```ts
			const hosts = childSequenceHostsFor(idFor(token))
```

- [ ] **Step 3: the adapters — `TokenChildren` takes an id, `Token` loses `path`**

React `TokenChildren.tsx`:

```tsx
/** `ownerId` is the owning mark's stable id — the key `tokens.children` registers under since S1.8. */
export const TokenChildren = memo(({ownerId, children}: {ownerId: number; children: ReactNode}) => {
	const {tokens} = useMarkput(s => ({tokens: s.tokens}))
	const ref = useMemo(() => tokens.children(ownerId), [tokens, ownerId])
```

React `Token.tsx` — `keyOf` is already in scope and already throws loud on an
id-less token, so it is the right resolver:

```tsx
/**
 * `depth` arrives by construction: the parent that maps the tree knows it. The render-time
 * `TokenPath` that used to travel alongside it went at S1.8 step 4 — its last reader was
 * `TokenChildren`, which now registers under the owner's stable id.
 */
export const Token = memo(({token, depth}: {token: TokenType; depth: number}) => {
```

```tsx
			<TokenChildren ownerId={keyOf(token)}>
				{token.children.map(child => (
					<Token key={keyOf(child)} token={child} depth={depth + 1} />
				))}
```

`Container.tsx:40` → `tokens.map(t => <Token key={keyOf(t)} token={t} depth={0} />)`;
`Block.tsx:49` → `<Token token={token} depth={0} />`.

Vue `TokenChildren.vue` — the prop becomes
`ownerId: {type: Number, required: true}`, both `store.tokens.children(...)`
calls take `props.ownerId`, and the re-registration watch keys on it directly
instead of on `props.ownerPath.join('.')`. Vue `Token.vue` drops its `path` prop
and passes `{ownerId: keyOf(token)}`; `Container.vue` and `Block.vue` drop
`:path`.

- [ ] **Step 4: the storybook case that pins re-registration**

`pages/Base/Base.vue.spec.ts` — the mock and the harness move from paths to ids.
The contract it pins is unchanged (the old ref is released with `null` before the
new one is handed the element), so only the vocabulary changes:

```ts
	it('refreshes child sequence registration when the owner id changes', async () => {
		// Owner identity is the mark's stable id since S1.8 step 4, not its TokenPath. The
		// re-registration contract is unchanged: the old ref is released with `null` before
		// the new one is handed the element.
		const callbacks = new Map<number, ReturnType<typeof vi.fn>>()
		const store = new Store()
		vi.spyOn(store.tokens, 'children').mockImplementation((ownerId: number) => {
			const callback = vi.fn()
			callbacks.set(ownerId, callback)
			return callback
		})
		const Harness = defineComponent({
			setup() {
				provide(STORE_KEY, store)
				const ownerId = ref(7)
				return () =>
					h('div', [
						h('button', {onClick: () => (ownerId.value = 8)}, 'move'),
						h(TokenChildren, {ownerId: ownerId.value}, () => h('span', 'child')),
					])
			},
		})

		await render(Harness)
		const initialCallback = callbacks.get(7)
		expect(initialCallback).toHaveBeenCalledWith(expect.any(HTMLElement))

		await userEvent.click(getElement(page.getByRole('button', {name: 'move'})))
		await nextTick()

		expect(initialCallback).toHaveBeenLastCalledWith(null)
		expect(callbacks.get(8)).toHaveBeenCalledWith(expect.any(HTMLElement))
	})
```

`import type {TokenPath} from '@markput/core'` goes from that file.

- [ ] **Step 5: the two core specs that pre-registered — and the one that was destroying its own fixture**

**[HARD STOP], measured.** An id can only be read once the mount has published a
tree, so a registration cannot precede the mount. `SelectionController.spec`'s
`mountStructuralNestedWithChildSequence` already registers after
`host.container(container)` and only needs the id:

```ts
	store.host.container(container)
	// The registration is id-keyed since S1.8 step 4, so it has to come AFTER the mount
	// publishes a tree: an adapter registers from the render of a token that already has
	// an id, and a spec has to do the same.
	store.tokens.children(store.tokens.keyOf(store.tokens.current()[1]))(host)
	store.host.rendered()
```

`model/TokenModel.spec.ts`'s "children() refs scope the structural walk" is the
hard one. It painted the container BEFORE mounting, and `host.container()` fires
the `host.rendered` watch with `{immediate: true}` — so moving the registration
after the mount lets that immediate bind run with no host registered, mis-bind
the slot child to `wrapper`, and `applyMountState` write
`wrapper.textContent = 'ab'`, **deleting `childSpan`**. Measured failure:
`expected undefined to be <span></span>`. The fix is the real adapter order:

```ts
			const text2 = document.createElement('span')
			document.body.append(container)

			// Mount the EMPTY container, then paint, then register, then report rendered — the
			// real adapter order, and mandatory since S1.8 step 4 made the registration
			// id-keyed: the id only exists once the mount has published a tree. Painting
			// before the mount instead would let the mount's immediate bind run with no host
			// registered, mis-bind the child text token to `wrapper` and overwrite its
			// `textContent` — destroying `childSpan` before the real bind ever sees it.
			setup.host.container(container)
			container.append(text1, markEl, text2)
			setup.model.children(setup.model.keyOf(setup.model.current()[1]))(wrapper)
			setup.host.rendered()
```

`model/bind.spec.ts`'s three `childSequenceHostsFor` mocks become id predicates,
which is strictly clearer than the `pathKey` string compare they replace:

```ts
					childSequenceHostsFor: ownerId => (ownerId === ids.idFor(tokens[0]) ? [host] : []),
```

(and `ownerId === ids.idFor(tokens[1])` for the "registered outside its owner
mark element" case). `import {pathKey} from '../tokenIndex'` goes.

- [ ] **Step 6: gate — FULL suite**

Run: `pnpm run format && pnpm test && pnpm run typecheck && pnpm run lint:check && pnpm run format:check && pnpm run build`
Measured: **73 files, 1326 passed, 7 todo**; all clean. Diffstat:
**15 files, +80/−69**.

- [ ] **Step 7: commit**

```bash
git add -A
git commit -m "refactor(core)!: S1.8 step 4a — child-sequence hosts register by owner id

BREAKING (adapter-internal SPI): tokens.children(ownerPath) becomes
tokens.children(ownerId). The registry is keyed by the owning mark's stable id,
which is what bind already resolves per token and what does not go stale when a
sibling above the owner is added or removed mid-render.

That was TokenPath's last reader in the render loop, so the Token component's
path prop goes with it in both adapters. The ordering constraint is new and
load-bearing: a registration can only be made once the mount has published a
tree, so a spec that pre-registered against a pre-painted container has to mount
the empty container first, then paint, then register, then report rendered — the
order a real adapter already uses."
```

---

## Task 3: delete the path layer (spec §11 step 4b)

**Files:** delete `features/tokens/tokenIndex.ts` + `tokenIndex.spec.ts`; modify
`packages/core/index.ts`, `shared/editorContracts.ts`, `model/bind.ts`,
`model/commit.ts`, `model/TokenModel.ts`, `model/bind.spec.ts`,
`model/treePipeline.spec.ts`, `features/selection/SelectionController.spec.ts`.

Core-only: no adapter file changes, so the gate is `vitest run packages/core` +
`typecheck` rather than the full suite.

- [ ] **Step 1: delete the module**

```bash
git rm packages/core/src/features/tokens/tokenIndex.ts \
       packages/core/src/features/tokens/tokenIndex.spec.ts
```

After Task 2: `pathEquals` has no caller, `pathKey` has one
(`bind.ts:94`, killed in Step 2), and `resolvePath` has none outside
`tokenIndex.spec.ts` and `SelectionController.spec.ts:404-406` (Step 4).

- [ ] **Step 2: `bind` returns `bound`, keyed by id**

`model/bind.ts` — the result type:

```ts
/** Derived lookups over the nodes the walk actually bound (buildIndex's IndexResult, handle-valued). */
export type BindResult = {
	/**
	 * The handles this walk bound, keyed by stable id. It was keyed by `pathKey(path)`
	 * until S1.8 step 4; no production consumer ever looked one up by key — all three
	 * (`assertAligned`, `setEditable`, `DomModel.boundHandles`) iterate the values — so the
	 * path string was the last thing keeping a path layer alive inside the pipeline.
	 */
	bound: ReadonlyMap<number, TokenHandle>
	byElement: WeakMap<HTMLElement, TokenHandle>
	controlRoots: WeakSet<HTMLElement>
}
```

`Frame` loses `basePath`; `TreeEntry` becomes `{id: number; token: Token}`;
`collectTree` loses its path threading and its error message names the content
instead (nothing asserts the message beyond `/no id/`):

```ts
function collectTree(tokens: readonly Token[], idFor: (token: Token) => number | undefined, out: TreeEntry[]): void {
	for (const token of tokens) {
		const id = idFor(token)
		if (id === undefined) {
			throw new Error(`bind: token "${token.content}" has no id — bind requires an identity-reconciled tree`)
		}
		out.push({id, token})
		if (token.type === 'mark') collectTree(token.children, idFor, out)
	}
}
```

The main loop destructures `{id, token}` and sets `bound.set(id, handle)`;
`walkDom` drops the `path` local and the `basePath` on both `resolveRoot`
returns; `import type {TokenPath}` and `import {pathKey}` go.

`model/commit.ts` — `bound(): ReadonlyMap<number, TokenHandle>` on the pipeline
type, `let bound: ReadonlyMap<number, TokenHandle> = new Map()`,
`bound = result.bound`, `for (const handle of bound.values())` in
`assertAligned`, `bound: () => bound` in the return, and the "paths are unchanged
there by definition" comment on the derived lookups becomes "no node is added or
removed there by definition, so the same ids stay bound to the same elements".
`import type {TokenPath}` goes.

`model/TokenModel.ts` — the two `#pipeline.byPath()` readers become
`#pipeline.bound()`, and the survivors ledger is corrected: it still said
"`ValueModel`, `MarkputHandler` and the path layer (`byPath`, `tokenIndex`) —
S1.8's directory regroup owns them", which names a phase that does not own them
and a class deleted at S1.7.

- [ ] **Step 3: `TokenPath` leaves the type layer and the barrel**

`shared/editorContracts.ts` — delete `export type TokenPath = readonly number[]`.
`packages/core/index.ts` — delete
`export type {TokenPath} from './src/shared/editorContracts'` and re-title the
section, because the reason the `Token` family stays has changed phase:

```ts
// ═══ Snapshot render loop ═════════════════════════════════════════════════════
// Kept deliberately (S1.7 decision D-c, re-affirmed at S1.8 decision D-a): 14 adapter
// files render `Token[]` off `renderTree`, and moving that loop onto `input.nodes()`
// also moves `bind`/`commit`. That move is its own phase (S1.10), not part of the sweep.
export type {Token, TextToken, MarkToken} from './src/features/tokens'
```

Neither adapter barrel re-exported `TokenPath`, so they need no change — verify
with `grep -n TokenPath packages/{react,vue}/markput/index.ts` before assuming
it.

- [ ] **Step 4: the specs — 75 lookups and one destructure**

**[HARD STOP], measured:** the obvious spec helper does not lint.
`tsconfig.json` leaves `noUncheckedIndexedAccess` off, so `siblings[index]` types
as `Token` and the bounds guard is
`typescript(no-unnecessary-condition): Unnecessary conditional, value is always
falsy`. Annotating `const next: Token | undefined = siblings[index]` does **not**
help — TS narrows the initializer. `siblings.at(index)` is the spelling that
works.

`model/treePipeline.spec.ts` gets one module-level helper, above `createHarness`:

```ts
/**
 * The bound handle at a tree POSITION. Replaces `pipeline.byPath().get(pathKey(path))`:
 * S1.8 step 4 re-keyed the bind result on stable ids, so a case that names a token by
 * where it sits in the fixture resolves the token first and looks its handle up by id.
 */
function boundAt(pipeline: CommitPipeline, ...path: number[]): TokenHandle | undefined {
	let siblings: readonly Token[] = pipeline.current()
	let token: Token | undefined
	for (const index of path) {
		// `.at`, not `[]`: `tsconfig` leaves `noUncheckedIndexedAccess` off, so an index read
		// types as `Token` and the out-of-range guard — which several cases below rely on to
		// answer `undefined` — is linted away as an impossible condition.
		const next = siblings.at(index)
		if (!next) return undefined
		token = next
		siblings = token.type === 'mark' ? token.children : []
	}
	return token?.id === undefined ? undefined : pipeline.bound().get(token.id)
}
```

then, mechanically: `pipeline.byPath().get('2')` → `boundAt(pipeline, 2)`,
`.get('1.0')` → `boundAt(pipeline, 1, 0)`, `pipeline.byPath().size` →
`pipeline.bound().size`, `byPathBefore` → `boundBefore`. Add
`import type {CommitPipeline} from './commit'`.

`model/bind.spec.ts` gets the same shape with the fixture's own id map:

```ts
function at(
	result: BindResult,
	ids: ReturnType<typeof createIds>,
	tokens: readonly Token[],
	...path: number[]
): TokenHandle | undefined {
```

with the body identical except the last line
(`const id = token === undefined ? undefined : ids.idFor(token)`), and
`import type {BindInput, BindResult} from './bind'`. Two call sites in the "node
map lifecycle" describe have no `tokens` in scope and pin their ids explicitly
(`ids.set(next, 1)`), so they read better as `result.bound.get(1)` /
`result.bound.get(2)` — and the case titled "rebinds when a token shifts to a new
path" becomes "…to a new position", because there are no paths any more.

`features/selection/SelectionController.spec.ts:404-406` — the destructure says
what the case means:

```ts
			const outer = store.tokens.current()[1]
			if (outer.type !== 'mark') throw new Error('expected the outer mark')
			// The path layer went at S1.8 step 4; the fixture's three slot children are read
			// straight off the mark that owns them.
			const [beforeToken, innerToken, afterToken] = outer.children
```

and the four `?.position` reads below it lose their optional chain (the
destructure is non-nullish, and `no-unnecessary-condition` is error-level).

- [ ] **Step 5: gate — core only**

Run: `pnpm run format && pnpm -w exec vitest run packages/core && pnpm run typecheck && pnpm run lint:check && pnpm run format:check`
Measured: `pnpm test` at this commit is **72 files, 1323 passed, 7 todo** (−3:
`tokenIndex.spec.ts`); tsc 0, lint clean, format clean, build clean. Diffstat:
**10 files, +184/−220**.

- [ ] **Step 6: commit**

```bash
git add -A
git commit -m "refactor(core): S1.8 step 4b — delete the path layer

tokenIndex.ts and its spec go: pathEquals lost its caller when children()
re-keyed on ids, pathKey when the bind result did, and resolvePath had none
outside two specs. TokenPath leaves shared/editorContracts and the root barrel.

bind returns \`bound\`, keyed by stable id, instead of \`byPath\` keyed by
pathKey(path). No production consumer ever looked one up by key — assertAligned,
setEditable and DomModel.boundHandles all iterate the values — so the path string
was the last thing keeping a path abstraction alive in the pipeline. collectTree
and walkDom stop building a throwaway array per token per bind."
```

---

## Task 4: delete `ValueModel` and `replaceInString` (spec §11 step 5)

**Files:** delete `features/state/ValueModel.ts`, `shared/utils/replaceInString.ts`;
rename `features/state/ValueModel.spec.ts` → `features/tokens/TokenModel.value.spec.ts`;
modify `features/state/index.ts`, `shared/utils/index.ts`, `store/Store.ts`,
`features/edit/EditController.ts`, `features/keyboard/KeyboardController.ts`,
`features/keyboard/input.ts`, `features/keyboard/blockEdit.ts`,
`features/block/BlockController.ts`, `features/overlay/OverlayController.ts`,
`features/selection/SelectionController.ts`, `model/TokenModel.ts`, plus 13 spec
files.

Spec §11 step 5 says "`ValueModel` + `replaceInString`, `MarkController`,
`MarkputHandler`". The last two were deleted at S1.7 (Tasks 2 and 3), so the list
is two items — S1.7's contradiction 4, confirmed.

- [ ] **Step 1: delete the two modules and their barrel lines**

```bash
git rm packages/core/src/features/state/ValueModel.ts \
       packages/core/src/shared/utils/replaceInString.ts
```

`features/state/index.ts` drops its third line; `shared/utils/index.ts` drops
`export {replaceInString} from './replaceInString'`.

`replaceInString`'s evidence: `grep -rn replaceInString packages/` finds only its
own definition, the barrel, `ValueModel.spec.ts`'s two unit cases and a comment
in `tree/offsetShim.spec.ts`. The shim owns range validation now.

- [ ] **Step 2: repoint the eight consumers**

`ValueModel.current` → `TokenModel.value` (a `Computed<string>`, so
`watch(this.value.current, …)` becomes `watch(this.tokens.value, …)` unchanged in
shape); `ValueModel.replace` → `TokenModel.replace`.

- `EditController` — the constructor's first parameter becomes
  `private readonly tokens: TokenModel`, `this.value.replace(...)` becomes
  `this.tokens.replace(...)`, and the class doc says what it now delegates to:
  "delegates gating to the token layer's internal offset shim
  ({@link TokenModel.replace}, spec D8)".
- `SelectionController` — drops the `value` parameter; `isAllSelected` and
  `selectAll` read `this.tokens.value()`.
- `OverlayController` — drops the `value` parameter;
  `watch(this.tokens.value, …)` and `this.tokens.value()`.
- `BlockController` — drops the `value` parameter; `this.tokens.value()`.
- `KeyboardController` — drops the `value` parameter and the `ctx` key;
  `KbCtx` in `input.ts` and `blockEdit.ts` becomes
  `Pick<Store, 'selection' | 'edit' | 'tokens' | 'props'>`.
- `keyboard/input.ts:114` and `blockEdit.ts:78,128,260` —
  `store.value.current()` → `store.tokens.value()`.
- `store/Store.ts` — `readonly value` and the `ValueModel` import go; the five
  constructor calls lose the argument. `KeyboardController` and
  `OverlayController` fit on one line again.

`store.value` has **zero** consumers outside `packages/core` (measured across
both adapters, the storybook and both demo apps), so nothing external moves.

- [ ] **Step 3: the specs — mechanical, except where it isn't**

Thirteen spec files reference `value.current` / `value.replace`. The rewrite is
regular enough to script, and worth scripting because there are ~110 sites:

```python
# X.value.current()      -> X.tokens.value()
# X.value.current(arg)   -> X.tokens.replace({start: 0, end: -1}, arg)
# X.value.current        -> X.tokens.value        (bare signal reference)
# X.value.replace(       -> X.tokens.replace(
```

Three things the script does not catch:

- `model/TokenModel.spec.ts`'s `createNew` builds its own
  `const value = new ValueModel(model)`; drop it, drop the `value` key from the
  returned object and from five `const {model, value, …} = mountNewInline()`
  destructures, and rewrite `value.replace(` → `model.replace(`.
- Three `vi.spyOn(store.value, 'replace' | 'current')` become
  `vi.spyOn(store.tokens, 'replace')` (`BlockController.spec` ×2,
  `input.spec` ×1).
- `OverlayController.spec` has four nested reads inside a write
  (`store.value.current(store.value.current() + ' ')`) that the outer
  substitution leaves half-converted; finish them by hand.

- [ ] **Step 4: port the spec, and say what did not come**

`git mv packages/core/src/features/state/ValueModel.spec.ts packages/core/src/features/tokens/TokenModel.value.spec.ts`,
then:

```ts
/**
 * Ported from `features/state/ValueModel.spec.ts` at S1.8 step 5. The facade was a
 * one-phase delegation to the token layer (`current` → {@link TokenModel.value},
 * `replace` → the internal offset shim), so every behavior it pinned is the token
 * layer's. Two cases did NOT move: they were unit tests of `replaceInString`, deleted
 * with the helper — the shim (`tree/offsetShim.ts`) owns range validation now and
 * `offsetShim.spec.ts`'s "rejects the ranges replaceInString rejected" is its gate.
 */
describe('TokenModel value boundary', () => {
```

`expect('next' in store.value).toBe(false)` goes with the object it probed. The
"value hinge (S1.6a)" note is **resolved rather than re-recorded** (D-c):

```ts
	describe('value hinge (S1.6a)', () => {
		// RESOLVED AT S1.8 step 5. The S1.6a note here recorded a behavior change that only
		// the deleted facade could produce: `ValueModel.current` was a WRITABLE computed, so
		// writing the value the store already held short-circuited before the setter and
		// never emitted. There is no writable computed any more — every write is
		// `tokens.replace`, which emits for a no-op splice exactly as it always did
		// (`tree/boundary.spec.ts`'s 'emits an unchanged value in both modes'). The
		// divergence is gone rather than merely untested.
```

- [ ] **Step 5: fix the six stale cross-references the deletion creates**

`model/TokenModel.ts` names `ValueModel.spec` twice as the gate on
{@link TokenModel.value}'s `#seeded` arm and once more on `#seeded` itself —
repoint all three at `TokenModel.value.spec`. Its survivors ledger loses
`ValueModel`. `SelectionController.spec:474`, `tree/boundary.spec.ts:287` and
`tree/transactions.ts:77` refer to the facade in the present tense; put them in
the past.

- [ ] **Step 6: gate — core only**

Run: `pnpm run format && pnpm -w exec vitest run packages/core && pnpm run typecheck && pnpm run lint:check && pnpm run format:check`
Measured: `pnpm test` at this commit is **72 files, 1321 passed, 7 todo** (−2:
the `replaceInString` unit cases); tsc 0, lint clean, format clean, build clean.
Diffstat: **29 files, +197/−254**.

- [ ] **Step 7: commit**

```bash
git add -A
git commit -m "refactor(core): S1.8 step 5 — delete ValueModel and replaceInString

ValueModel was a one-phase facade: current delegated to TokenModel.value and
replace to the internal offset shim. Its eight consumers read the token layer
directly now, and Store loses its \`value\` member — zero non-core importers, so
nothing outside the package sees it.

replaceInString had no production caller left; the shim (tree/offsetShim.ts)
owns range validation and offsetShim.spec's 'rejects the ranges replaceInString
rejected' is the gate that replaced it.

ValueModel.spec is ported to features/tokens/TokenModel.value.spec.ts, 12 of 14
cases; the two dropped were unit tests of the deleted helper. The S1.6a
value-hinge note it carried is RESOLVED rather than re-recorded: the divergence
it described could only be produced by the facade's writable computed."
```

---

## Task 5: documentation (spec §11 step 7)

**Files:** `packages/core/README.md`, `packages/core/src/features/tokens/README.md`,
`packages/core/src/store/README.md`, `packages/core/src/shared/signals/README.md`;
website `development/architecture.md`, `development/how-it-works.md`,
`development/inconsistencies.md`, `guides/dynamic-marks.md`,
`guides/keyboard-handling.md`.

- [ ] **Step 1: `features/tokens/README.md` — the one that states the opposite of D11**

448 lines in the spec's count, 412 at `b4763c95`. It describes a world three
phases dead: `MarkController.fromToken` (deleted S1.7) has its own section;
`handle.path()` is documented as a read (deleted S1.6d); `byPath` is described as
path-keyed; there is a whole "Edit-hint flow" section for the consume-once hint
(deleted S1.6a) and a `TokenChangeEntry` / `ReconcileResult` vocabulary for a
reconcile that no longer exists.

The load-bearing correction is line 22: **"No per-node reactivity"** is exactly
what D11 reverses. `TreeNode`'s `text`/`value`/`meta`/`children` ARE signals and
they are what `useMark()` subscribes to. The sentence was true *of `TokenHandle`*
and got generalized to the model. The rewrite opens with the distinction:

```md
## Two layers, and the difference matters

| | owns | reactive? | identity |
| --- | --- | --- | --- |
| `TreeNode` (`tree/types.ts`) | the CONTENT — text, value, meta, children, positions | yes: `text`/`value`/`meta`/`children` are signals (spec D11) | `id`, assigned at birth, never reused |
| `TokenHandle` (`model/TokenHandle.ts`) | the DOM BINDING and the generation the DOM is showing | no — plain field reads | the same `id`, keyed in the `nodes` map |

`TreeNode` is the store. `TokenHandle` is a view over one node's DOM. They share
an id and nothing else, and the split is what makes the pending window safe.
```

and the handle section keeps the honest half of the old claim:

```md
No per-node reactivity **on the handle**: its getters are plain field reads. That
is not a statement about the model — `TreeNode`'s content fields ARE signals, and
they are what the public API subscribes to.
```

New/rewritten sections: "The tree (`tree/`)" (a file-by-file map of
`tree.ts`/`types.ts`/`adopt.ts`/`gapWindow.ts`/`transactions.ts`/`boundary.ts`/
`offsetShim.ts`/`snapshot*.ts`/`anchors.ts`/`markPatch.ts`); the pipeline diagram
redrawn from `fromTransaction`; "The read latch" replacing the deleted
`MarkController` section; "Adoption — the descend rules" replacing "Deep
reconcile"; "Mark commands" describing `MarkNode.update`/`remove` and the
`null`-clears patch. `bind`'s section states the id keying and why. The
benchmarking chapter is kept verbatim — it is still correct.

- [ ] **Step 2: `packages/core/README.md` — rewrite (D-i)**

It advertises sixteen symbols that are not root exports. Replace with: the
"not published, consumed through the two adapters" framing; what the core owns; a
table of the actual public surface; the `SlotRegistry` augmentation note; and
pointers to the three in-tree READMEs plus the website's development docs. Keep
the Development block, with `pnpm bench` (Task 1 already fixed that line).

- [ ] **Step 3: `store/README.md` and `shared/signals/README.md`**

`store/README.md`'s closing paragraph is a `ValueModel` paragraph. It becomes:
the token layer owns the value, `store.tokens.value()` is the projection, edits
route through `store.edit.replace()` (or `store.tokens.replace()` for a raw
range), and gating lives in the transaction layer so every write verb answers the
same way. Its "Feature state" bullet drops "accepted serialized value" and
"composition flags" (there are none).

`shared/signals/README.md:119` cites `ValueModel.current` as the worked example
of a writable computed with a custom `set`. The pattern is still right, the
citation is not — point at the code block two lines below instead.

- [ ] **Step 4: the website prose**

Ten sites across five pages, each a one-line repoint:

| file | was | now |
| --- | --- | --- |
| `guides/dynamic-marks.md:44` | `store.refs`, `store.dom` | `store.tokens.control()` / `store.tokens.children(ownerId)`, `store.tokens` |
| `guides/keyboard-handling.md:12` | `store.refs.control(path?)` / `store.refs.children(ownerPath)` | `store.tokens.control()` / `store.tokens.children(ownerId)` |
| `development/how-it-works.md:51,53` | `store.refs`; `store.value.replace()`/`.current()` | the ref registries; `store.edit.replace()` / `store.tokens.replace()` / `store.tokens.value()` |
| `development/inconsistencies.md:56` | `store.value.replaceRange()` — a method that never existed | "a transaction on the token tree" |
| `development/architecture.md` ×7 | steps 5–6 of the edit flow, the `store.value.replace` prose, two code samples, the `Store` shape, the `ValueModel` feature row, the mount comment, the ref-registry bullet, `ReconcileResult`, "reconciled tree" | the string boundary + adoption; `store.tokens.*`; `readonly api: MarkputApi` added to the shape; the `ValueModel` row deleted; `CommitInput` "lowered from the transaction's `TransactionResult`" |

`store.refs` is worth calling out separately: **that namespace has never existed
on `Store`** — the registries have always been `store.tokens.control` /
`store.tokens.children`. Three pages document an object a reader cannot find.

- [ ] **Step 5: gate**

```bash
pnpm run format
pnpm -F @markput/website run build          # measured: 49 pages, unchanged
git status --short packages/website          # measured: no regenerated api/** — see below
pnpm test && pnpm run typecheck && pnpm run lint:check && pnpm run format:check
```

Measured: **72 files, 1321 passed, 7 todo**; all clean. Diffstat:
**9 files, +251/−303**.

**Typedoc does NOT regenerate here, and that corrects S1.7's hard stop 12.**
`starlight-typedoc` is pointed at the **react adapter barrel**, so it only
rewrites `src/content/docs/api/**` when an adapter export changes. S1.8 changes
none, so every gate in this phase left `git status` clean.
`pnpm exec oxfmt --check` on a docs file still answers "All matched files may
have been excluded by ignore rules" — `packages/website/src/content/docs/` is in
`oxfmt.config.ts`'s `ignorePatterns`. That is the expected answer.

- [ ] **Step 6: commit**

```bash
git add -A
git commit -m "docs: S1.8 step 7 — retire the pre-rewrite architecture prose

features/tokens/README.md described the deleted world: MarkController,
handle.path(), the path-keyed byPath map, reconcile/ReconcileResult, the
consume-once edit hint and TokenChangeEntry kinds. Worse, its 'No per-node
reactivity' section stated the opposite of the shipped design — TreeNode's
content fields ARE signals (spec D11), and they are what the public API
subscribes to. The rewrite separates the two layers explicitly: TreeNode owns
content, TokenHandle owns the DOM binding and the generation the DOM shows.

packages/core/README.md documented an API that has not existed for several
phases (Parser, caretDom, EventBus, NodeProxy, getTokensByUI, SystemEvent…) and
told the reader to run a script that is not in package.json.

Website prose, store/ and signals/ READMEs: ValueModel, store.value.*,
store.refs.*, control(path?)/children(ownerPath) and ReconcileResult all
repointed at what actually ships."
```

---

## Task 6: hardening — mutation proof and the two gates the sweep would have lost

**Files:** `features/keyboard/input.ts`, `features/keyboard/input.spec.ts`,
`store/Store.spec.ts`.

- [ ] **Step 1: apply each mutation, confirm a NAMED test fails, revert, confirm green**

Nine were run. Eight died:

| # | mutation | killed by |
| --- | --- | --- |
| 1 | `#controlElements()` returns an empty set | **4 cases in 4 files** — `handleAt` tri-state (`model/TokenModel.spec`), `TokenHandle.spec`, `TokenModel.index.spec`, `SelectionController.spec` "returns undefined for selections crossing controls" |
| 2 | `#placeAt` drops the handle path and always resolves an absolute offset | `SelectionController.spec` "places at a mark whose start equals the previous text node end, through the mark itself" |
| 3 | `commit.bound()` returns an empty map | **20 cases** in `treePipeline.spec` — assertAligned, setEditable and the boundary reads all go blind |
| 4 | `TokenModel.value` drops the `#seeded` arm | `TokenModel.value.spec` "an unmounted store reads defaultValue before anything has committed" — the ported case, so the port kept the gate |
| 5 | `TokenModel#seeded` is a plain field, not a signal | `Store.spec` ×3 **after Step 2**; ×1 before it (see Step 2) |
| 6 | react `Token.tsx` passes `ownerId={0}` | **54 assertions** across the react browser suites |
| 7 | `children()` ignores `ownerId` | **100 assertions** in the browser suites — see the survivor below |
| 8 | `handleDeleteKey` loses its all-selected branch | `input.spec` "clears the whole value even when the DOM selection is gone" — **only after Step 3** |

- [ ] **Step 2: restore the `#seeded` gates the ValueModel deletion halved**

**[HARD STOP], measured.** Mutation 5 killed **3** cases at Task 3's tip and
**1** at Task 4's. `ValueModel.current` was a writable computed, and
`shared/signals/signal.ts`'s `writableComputed` reads `prev` before the set to
short-circuit an equal write — that implicit read is what cached the `#seed` arm
and its dep set, which is what a plain field then fails to invalidate. Writing
through `tokens.replace` performs no read, so the computed is cold at the
assertion and re-derives correctly under the mutation. Two `Store.spec` cases get
the read back, explicitly:

```ts
		it('update when written directly', () => {
			const store = new Store()
			// The READ BEFORE the write is load-bearing, and it stopped being implicit at S1.8
			// step 5. `ValueModel.current` was a writable computed, and a writable computed
			// evaluates its getter before the set to short-circuit an equal write — which is
			// what caught `TokenModel#seeded` degrading from a signal to a plain field (the
			// computed caches the `#seed` arm and its dep set, and a field write then notifies
			// nothing). Writing through `tokens.replace` has no such implicit read, so without
			// this line the computed is cold at the assertion and re-derives correctly under
			// the mutation. Measured: 3 cases died before the port, 1 after; this line and the
			// one in `current` › 'returns written current value' restore the other two.
			expect(store.tokens.value()).toBe('')
			store.tokens.replace({start: 0, end: -1}, 'hello')
			expect(store.tokens.value()).toBe('hello')
		})
```

and the same two-line addition in `current` › 'returns written current value'.
The describe `'reacts to props.value changes when ValueModel is enabled'` is
renamed to `'… when controlled'`. Re-measured after: **3 cases die again**.

- [ ] **Step 3: gate `handleDeleteKey`, and refute the redundancy claim**

The keydown path had **zero** direct coverage — every existing all-selected case
drives `beforeinput`. Two cases go in, and the note says plainly that the first
one does not do the job:

```ts
/**
 * The keydown path had NO direct coverage before S1.8. It was flagged as redundant with its
 * own fallthrough — `readRaw()` on an all-selected editor answers `{0, len}`, which
 * `rangeForDelete` passes straight through — and the first case below does NOT discriminate
 * it: deleting the branch keeps that one green. The second case does, and that is what
 * refutes the claim. The two paths diverge exactly when the STORED selection says
 * all-selected while the DOM selection is gone: the branch still preventDefaults and clears,
 * the fallthrough bails on `readRaw()` and lets the browser mutate contenteditable behind
 * the model's back.
 */
describe('handleDeleteKey()', () => {
	it('clears the whole value on Backspace with everything selected', () => {
		const {store, container} = mountStructuralInline()
		store.selection.selectAll()

		const event = new KeyboardEvent('keydown', {key: 'Backspace', bubbles: true, cancelable: true})
		container.dispatchEvent(event)

		expect(event.defaultPrevented).toBe(true)
		expect(store.tokens.value()).toBe('')
		container.remove()
	})

	it('clears the whole value even when the DOM selection is gone', () => {
		// THE discriminating case (see the note above): the only one that fails when the
		// all-selected branch is deleted.
		const {store, container} = mountStructuralInline()
		store.selection.selectAll()
		window.getSelection()?.removeAllRanges()

		const event = new KeyboardEvent('keydown', {key: 'Backspace', bubbles: true, cancelable: true})
		container.dispatchEvent(event)

		expect(event.defaultPrevented).toBe(true)
		expect(store.tokens.value()).toBe('')
		container.remove()
	})
})
```

and the branch itself carries the finding, so the next sweep does not re-derive
it from the same reasoning:

```ts
	// NOT redundant with the fallthrough below, and the difference is measured rather than
	// argued: when the STORED selection says all-selected but the live DOM selection is gone,
	// `readRaw()` answers `undefined` and the fallthrough returns without preventing the
	// default — letting the browser mutate contenteditable behind the model's back. Gated by
	// `input.spec`'s 'clears the whole value even when the DOM selection is gone'; the
	// obvious "Backspace with everything selected" case does NOT discriminate it.
	if (store.selection.isAllSelected()) {
```

- [ ] **Step 4: the one survivor — recorded, not patched**

**Mutation 7, `children()` ignores its `ownerId`:** the whole `core` project
passes (48 files, 878 tests). It dies only in the browser suites, and loudly —
100 assertions. The reason is structural: bind takes a child-sequence host only
when `hosts.length === 1`, so the filter is unobservable until a document has TWO
slot marks, and no `core` fixture does. Building one would duplicate coverage the
storybook suites already provide with real DOM. **Recorded here rather than
patched**; the consequence to know is that a change to the registry lookup will
look green under `vitest run packages/core` and turn the browser suites red.

- [ ] **Step 5: full gates**

Run: `pnpm run format && pnpm test && pnpm run build && pnpm run typecheck && pnpm run lint:check && pnpm run format:check && pnpm -F @markput/website run build`
Measured final: **72 files, 1323 passed, 7 todo (1330)**; tsc 0, lint clean,
format clean, build clean, website 49 pages.
`grep -rni "@deprecated" packages/ | grep -v dist | grep -v node_modules` → **0
hits** (spec §11's gate).
The adapter DTS tail export statements diff by **nothing** against the pre-phase
build, in both packages (spec §11's other gate — see D-b for why zero is the
right answer).

**Browser flakiness, observed once in this pass:** three react suites failed at
suite level with `Failed to import test file` and **zero** failed assertions
(1302 passed | 5 todo, 0 failed) — the optimize-deps race the S1.6bcd plan
documents. Green on re-run. Re-run once before believing a browser failure; never
dismiss an *assertion* failure as a flake.

- [ ] **Step 6: commit**

```bash
git add -A
git commit -m "test(core): S1.8 hardening — gate handleDeleteKey and restore the #seeded gates

handleDeleteKey's all-selected branch was flagged as redundant with its own
fallthrough. REFUTED, measured: they diverge when the stored selection says
all-selected while the live DOM selection is gone — the branch preventDefaults
and clears, the fallthrough bails on readRaw() and lets the browser mutate
contenteditable behind the model's back. The keydown path had no direct coverage
at all; it has two cases now, and only the second discriminates.

Deleting ValueModel halved the gate on TokenModel#seeded being a signal (3 cases
died before, 1 after): the facade's writable computed supplied an implicit
read-before-write that tokens.replace does not. Two Store.spec cases read the
value explicitly first, which restores all three."
```

---

## Trap list — what was verified and left alone

Spec §11 names thirteen things that look dead and are not. Re-verified at
`b4763c95` before touching anything:

| trap | verdict | evidence |
| --- | --- | --- |
| `utils/findGap.ts` | LIVE | `tree/gapWindow.ts:1,19` |
| `filterEmptyText` | LIVE | `tree/boundary.ts:3,67` — block mode's parse filter |
| `readSelected` | LIVE | both adapters' `useMarkput.ts:1` |
| `toMarkInfo` | LIVE | both adapters' `useMarkInfo`; unhooked from `TokenPath` at S1.7 (D-a), which is exactly what let Task 3 delete the path layer |
| `MarkPatch`'s clear arm | LIVE | `null` = clear since S1.7 (D-b); `tree/markPatch.ts:11` |
| `serializeRange` | LIVE | `clipboard/ClipboardController.ts:7,43` |
| `tree/snapshot.ts`'s `snapshot`/`stripIds` | LIVE as the §7.1 gate, zero production callers — as documented | imported by 5 spec files; `materializeNode`, the same file's other export, IS production (`snapshotMemo.ts:3`) |
| `joinNodes` | **the trap entry is WRONG** | three production callers in `tree/tree.ts` (`:59` `MarkNode.slot()`, `:70` the tree's `value` computed, `:133` the recursion). It is the projection, not a test helper |
| the parser `Token` interfaces | LIVE | 21 core production files |
| the eight-file contenteditable adapter | LIVE, untouched | D-a |
| `Store`'s root export | LIVE | both adapters construct it |
| the named suffix-window fixture | untouched | not in any task's file list |
| `parser.bench.result.json` | KEPT | `features/tokens/README.md:356,365,370` |

**Additionally refuted** (candidates that spec §11 or the phase brief listed and
that turned out load-bearing): `anchorAt`'s `export` (D-f), `handleDeleteKey`'s
all-selected branch (D-h), and the five §2.3 export rows S1.7 already corrected.

**Proven genuinely dead** (each deleted with its evidence in the commit body):
`src/test-utils/`, `parser.profile.bench.ts` + `parser.profile.json` +
`getComplexityForMethod`, `control()`'s `ownerPath`, four `blockIndex` props,
`#placeAt`'s boolean, `MarkInit`'s root export, `pathEquals`/`pathKey`/
`resolvePath`/`TokenPath`, the path key on the bind result, `ValueModel`,
`replaceInString`.

---

## Contradictions found while writing and verifying this plan (report, do not paper over)

1. **Spec §11's step 3 is not a barrel edit and cannot be done in this phase.**
   Sized: 21 core production files / 2,481 lines, 3,180 spec lines, 14 adapter +
   storybook files, 8 external `current()` call sites — 3.6× S1.5's production
   surface, and a net-add rather than a deletion. It is S1.10. S1.7's
   contradiction 3 said the estimate excluded it; this plan says the *phase* has
   to.
2. **Spec §11's size estimate is for a different phase.** "net −2,300 to −2,600
   source lines, ~20 files deleted, ~35 edited" vs the measured **−1,832 lines, 7
   deleted, 64 edited**. Most of the "~20 files" were step 3's.
3. **Step 2 is already done.** Ten of the eleven exports it names left the root
   at S1.7; the eleventh (`SlotRegistry`) must stay. The residue is one line
   (`MarkInit`).
4. **Step 5's list is one item, not three.** `MarkController` and
   `MarkputHandler` were deleted at S1.7 (its contradiction 4, now confirmed by
   grep).
5. **Step 6's "~2,000 lines" assumed step 3 happened.** With the render loop
   staying, the `Token[]`-shaped suites pin live behavior; the actual budget is
   264 lines across three files (D-c).
6. **The trap list's `joinNodes` entry is wrong.** "zero production callers, but
   they ARE the §7.1 gate" is true of `snapshot`/`stripIds` and false of
   `joinNodes`, which has three production callers in `tree/tree.ts`. Anyone
   acting on the entry as written would look for a way to delete the string
   projection.
7. **§11 step 1's "`anchorAt`'s `export`" is stale** — it gained production
   callers at S1.6c, which the S1.6bcd plan already recorded (its contradiction
   7). The spec was never updated.
8. **§11 step 1's "the stale core README line" is an undercount by two orders of
   magnitude.** One line is falsified by step 1 (`pnpm test:bench:watch`); the
   other ~110 describe an API deleted across several phases.
9. **`store.refs` is documented on three website pages and has never existed.**
   The ref registries have always been `store.tokens.control` /
   `store.tokens.children`. This is not rewrite drift — it predates S1.
10. **`features/tokens/README.md` asserted the negation of D11.** "No per-node
    reactivity: the getters … are plain field reads, not signals" was written
    about `TokenHandle` and reads as a statement about the model. D11 makes
    per-node signals the whole reason the public API can be reactive. A reader
    trusting the README would conclude `useMark()` cannot subscribe.
11. **S1.7's contradiction 10 — "every gate that runs `typecheck` mutates the
    repo" — is scoped narrower than it reads.** starlight-typedoc walks the
    **react adapter barrel**; it regenerates only when an adapter export changes.
    Every gate in this phase left the tree clean.
12. **Spec §11's DTS gate is unsatisfiable as written.** "the tail export
    statement … diffs against the pre-phase build by exactly the §2.3 table"
    assumes S1.8 changes the published surface. It does not: the tails are
    byte-identical. The gate should read "diffs by nothing", and it passes.

---

## Self-review notes (spec → plan)

- **Four of §11's seven steps execute** (1, 4, 5, 7), **one is folded** (2, into
  Task 1, one line), **one is a written budget rather than a task** (6, D-c) and
  **one is deferred with a measured sizing** (3, D-a).
- **All three decisions the brief demanded are answered with measurements**:
  the render-loop move is its own phase (D-a, sized against S1.5); the step-6
  budget is file-by-file with a line count and a reason per row (D-c); the §9
  regroup stays separate and the evidence got *stronger* after the run, because
  the sweep deletes 7 files S1.9 would otherwise move-and-delete (D-d).
- **Six tasks, six commits, six revert units**, green at all six boundaries,
  verified by checking each commit out and re-running the four gates. The one
  coupling (Task 3 ⇒ Task 2) is named in the header.
- **Where a test cannot discriminate, it is said so**: mutation 7
  (`children()`'s id filter) is core-invisible and browser-only, recorded rather
  than patched; the first `handleDeleteKey` case is labelled as non-discriminating
  in the file itself.
- **Two gates the sweep would have silently weakened were found and restored**:
  the `#seeded` signal gate (3 → 1 → 3) and the `handleDeleteKey` branch (0 → 2,
  1 discriminating). Both were invisible to a green suite.
- **Fixtures chosen to discriminate**: `removeAllRanges()` after `selectAll()`
  (the only shape where the delete branch and its fallthrough disagree); an
  explicit value read before the write (the only shape that keeps the `#seeded`
  mutation observable); mounting an EMPTY container before painting (the only
  order in which an id-keyed child-sequence registration can exist at all).
- **Deliberately deferred, with reasons above**: the adapter render loop and the
  snapshot names (D-a, S1.10); the directory regroup (D-d, S1.9); the internal
  offset shim (D8, gated on block-rows); `TextToken`'s solo removal (D-a);
  `MarkInit` republished from the adapter barrels (D-b — the fix if anyone wants
  it nameable).
- **The standing lesson held again.** The expensive findings were not in the
  reasoning that felt hard. The render-loop sizing — the decision this plan was
  written around — cost one afternoon of counting and was never in doubt once
  counted. What cost real time was a spec fixture quietly deleting its own DOM
  because `host.container()` fires `rendered` immediately, and a deletion halving
  a gate three files away through a writable computed's implicit read.
