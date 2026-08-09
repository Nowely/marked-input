# Tree Core S1.7 (Public API v2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ship §2.3 as the product. The `MarkputApi` host replaces
`MarkputHandler` and absorbs `focus()`; the live nodes gain their public shape
(`markup`, `slot()`, `range()`, `update()`, `remove()`) and become what
`useMark()` returns; the model-centric write verbs (`insertMark`,
`replaceText`, `replaceRange`, `setValue`, `tx`) and node-anchored selection
(`selection`, `select`, `caret`, `selectionRange`) land on the host; `changed`
is published with its payload; and the export-disposition table is executed
**directly against the root export** — no compat entry is built (D8 as
amended). Per spec `2026-08-08-markput-s1-tree-core-v2.md` (v2.2) §11's S1.7
entry, §2.3 in full, D5, D6, D8, D9, D11 and §5.

**Architecture:** the inversion finishes at the boundary of the package. Until
now the tree was the truth *inside* core while the outside still spoke
positional `Token` snapshots and global ranges. S1.7 pushes the node layer
through the barrel: a `MarkNode` stops being a datum the DOM layer owns and
`MarkController` narrates, and becomes the thing userland holds, reads
reactively and writes through. Two consequences drive the tasks below. First,
the node must carry its own verbs, which means the tree needs a write port it
does not have. Second, once the node carries the verbs, `MarkController` is a
second implementation of the same semantics — and, measured, it cannot be
retired in a separate task from `useMark`, which is why Tasks 2 and 4 are one.

**Tech stack:** TypeScript, the shipped `tree/`, `model/`, `selection/` and
`store/` modules, Vitest (three Chromium browser projects — note that even the
`core` project runs in real Chromium, `vite.config.ts:38`), Storybook 9 +
Playwright, Astro/Starlight + starlight-typedoc for the website.

**Prerequisites:** S1.1–S1.6d complete and committed on `b0`
(`12ead317..c2d78482`).

## Plan status / Verification status

**Written** 2026-08-10 against `c2d78482`. **Verified by implementation**
2026-08-10: every task below was implemented in a throwaway worktree detached
at `c2d78482`, every gate was run at every task boundary, and 22 mutations were
applied and re-run. Everything below is labelled: *measured* claims carry their
command or `file:line`; the places where no test can discriminate are named
rather than decorated.

**Baseline reproduced** at `c2d78482`: `pnpm test` → **71 files, 1292 passed, 7
todo (1299)**; `build`, `typecheck`, `lint:check`, `format:check` and
`pnpm -F @markput/website run build` clean. (The FIRST baseline run failed two
react suites with `Failed to import test file … vitest.setup.react.ts /
SyntaxError: Unexpected identifier 'isCustomProperty'` — a suite-level import
error with **zero** failed assertions, the optimize-deps race the S1.6bcd plan
documents. Green on re-run. Re-run once before believing a browser failure;
never dismiss an *assertion* failure as a flake.)

**Final state with every correction folded in:** `pnpm test` → **73 files, 1326
passed, 7 todo (1333)**; `typecheck` 0 errors, `lint:check` clean,
`format:check` clean, `pnpm run build` clean, website build clean (49 pages, up
from 43). Diff against the baseline: **72 files changed, +2154/−705**
(core +816/−312, adapters +63/−39, storybook +298/−66, website +977/−288, the
last dominated by regenerated typedoc).

**Green at every task boundary — verified, not asserted.** Each of the seven
commits was checked out and re-gated:

| commit | `pnpm test` | tsc errors | lint errors | format |
| --- | --- | --- | --- | --- |
| Task 1 | 1297 passed, 7 todo | 0 | 0 | clean |
| Task 2 | 1299 passed, 7 todo | 0 | 0 | clean |
| Task 3 | 1313 passed, 7 todo | 0 | 0 | clean |
| Task 5 | 1313 passed, 7 todo | 0 | 0 | clean |
| Task 6 | 1323 passed, 7 todo | 0 | 0 | clean |
| Task 7 | 1323 passed, 7 todo | 0 | 0 | clean |
| Task 8 | 1326 passed, 7 todo | 0 | 0 | clean |

### Hard stops found (all fixed in place below, each marked `[HARD STOP]`)

1. **Task 1 — the `slot` rename must land alone, first.** Declaring
   `slot(): string | undefined` while `MarkNode.slot` is still the positional
   record gives **TS2300 "Duplicate identifier 'slot'" ×2 and 23 errors total**
   in `packages/core`, none of which points at the cause.
2. **Task 1 — the rename is ELEVEN sites, and one of them must NOT rename.**
   The obvious grep finds six. Missed: `adoptUtils.ts:23-25`
   (`snapshotNodeEquals` compares a NODE against a TOKEN — only the node side
   renames), `snapshot.spec.ts:105`, and `types.spec.ts:33`, which pins every
   node field with `expectTypeOf(...).toMatchObjectType`. Over-renamed:
   `adopt.property.spec.ts:180` compares two `MarkToken`s and must keep `slot`.
3. **Tasks 2 and 4 cannot be split.** Deleting `MarkController` forces
   `useMark`'s migration, which forces 19 storybook `mark.value` sites, all in
   one green step. Every split attempt leaves either a red `typecheck` at a task
   boundary or two live implementations of the same patch semantics. They are
   one task and one revert unit; **there is deliberately no Task 4**.
4. **Task 3 — `MarkputApi` cannot have both a `selection` dependency and a
   `selection()` method.** Measured with the colliding name: **TS2300 ×2** on
   the declarations plus **TS2341 and TS2349** at the call site. Same collision
   `TokenModel` documents at `model/TokenModel.ts:314-319`.
5. **Task 3 — `api.changed(fn)` EMITS; it does not subscribe.** `Event<T>` is
   `(payload: T) => void`, so the natural spelling fires the event with the
   listener as the payload and crashes core: measured
   `TypeError: delta.removed is not iterable` at
   `features/block/BlockController.ts:43`. The subscription verb is
   `watch(api.changed, fn)` — and **`watch` therefore has to be re-exported
   from both adapter barrels**, or §2.3's documented event is unreachable from
   the two packages that actually ship.
6. **Task 5 — `SlotRegistry` must STAY at the root.** §2.3's table lists it
   among the "zero importers outside `packages/core` … Drop" rows. It has zero
   *imports* and is load-bearing through **module augmentation**, which grep
   cannot see: both adapters carry `declare module '@markput/core' { interface
   SlotRegistry {…} }` (react/vue `src/augment.ts`). Dropping it collapses
   `Slot` to `unknown` — measured **TS2604/TS2786 ×8** across `Block`,
   `Container`, `Token` and `OverlayRenderer` in the React adapter alone.
7. **Task 5 — the reactive-primitives row is wrong.** Removing
   `computed`/`effect`/`watch`/`Computed`/`SignalValues` from the root gives
   **9 typecheck errors** in `packages/react` and `packages/vue`: they are the
   runtime and the signatures of `useMarkput`, the hook §2.3 explicitly keeps.
8. **Task 6 — the US-5 story fails `lint:check` before it fails anything
   else.** Two `typescript(no-unnecessary-condition)` errors (`nodes()[i]?.kind`
   and `element().textContent ?? ''`). With `denyWarnings: true` and the
   pre-commit hook, the task cannot commit.
9. **Task 6 — `insertMark('caret')` from a toolbar button always rejects.**
   The story's first version failed: clicking the button blurs the editor and
   `SelectionController`'s `focusout` handler clears the stored anchors, so
   `'caret'` resolves to `undefined`. `onMouseDown={e => e.preventDefault()}`
   is required, not decoration.
10. **Task 6 — adding a story page writes HTML snapshots, and changing the
    fixture afterwards turns the suite red.** `stories.react.spec.tsx` walks
    every story; the first run wrote 2 snapshots, and the later block-fixture
    correction produced a genuine mismatch that had to be reviewed and updated
    (`-u`) before `pnpm test` was green again.
11. **Task 6 — block rows are top-level TOKENS, not lines.** The first Block
    fixture `'first row\nsecond row'` renders as ONE row, so AC-5.1's
    between-rows scenario was not exercised at all. `'@[a](x)@[b](y)'` is the
    fixture that makes `{after: rows[0]}` mean something.
12. **Task 7 — typedoc regenerates `src/content/docs/api/**` during
    `pnpm run typecheck`, not only during the website build.** `astro check`
    runs the starlight-typedoc plugin, so **every** task gate that runs
    `typecheck` leaves the tree dirty with regenerated API pages. Stage them, or
    the next task's `git status` is confusing and the pages drift from the
    barrel.

### Predictions this plan made before the run that turned out FALSE

Recorded because they are the shape of the mistakes this series keeps making —
plausible reasoning asserted in passing.

- **"`useMark()` throwing on a missing node breaks five browser assertions."**
  **False, measured.** A strict `markFor` that throws is green across the whole
  suite (73 files, 1299 at that commit). React unmounts a removed mark's
  component rather than re-rendering it with a stale token. No detached
  stand-in is built — AGENTS.md forbids the untested guard.
- **"`import/no-cycle` rejects a type-only cycle, so `MarkCommands` must live in
  `tree/types.ts`."** **False, measured.** A deliberate type-only cycle
  (`types.ts → tree.ts → types.ts`) passes `pnpm run lint:check` clean. The
  placement is still right, but for a design reason (`types.ts` is where the
  tree layer's contracts live and both modules already import it), not because
  a gate enforces it.
- **"typedoc does not delete pages for removed exports."** **False, measured.**
  `api/classes/MarkController.md` and `api/classes/MarkputHandler.md` were
  deleted by the regeneration; no manual `git rm` is needed.
- **"`MarkputApi.value()`'s delegation cannot be discriminated."** **False,
  measured.** Replacing it with `joinNodes(this.tokens.nodes())` fails **9 core
  tests**.

### Surviving mutations

22 mutations were applied and re-run. **Sixteen died against a named test.**
Six survived; **four are now closed by tests added in Task 8** and **three are
recorded in code** as genuinely ungatable (one of the six, mutation 5, was
closed by re-fixturing rather than by a new test). Details in Task 8.

**Gates.** Every per-task gate LEADS with `pnpm run format` and includes
`pnpm run lint:check`: the pre-commit hook runs `oxfmt --check` and `oxlint`
with `denyWarnings: true` **and `reportUnusedDisableDirectives: 'deny'`**
(`oxlint.config.ts:146-149`), so a tests-only gate defers the failure to
`git commit`. Tasks 2, 3, 6, 7 and 8 run the FULL `pnpm test`; Tasks 1 and 5 are
core-only plus `typecheck`, which is what actually catches them — Task 5's
break is a `typecheck` failure in `packages/react`, invisible to
`vitest run packages/core`.

**Revert units.** Seven tasks, seven commits, seven revert units. **Task 5 (the
export table) cannot be reverted without also reverting Task 6** — the story
imports `MarkputApi` from `@markput/react`, which Task 5's barrel publishes.
Task 2 is the only task that changes adapter *behavior*; it is the one to bisect
against if a browser suite turns red later.

---

## Decisions taken before writing this plan (do not re-litigate)

### D-a. `useMarkInfo().depth` is threaded through the render context. `MarkNode` gets NO `depth` field

Spec §11 poses three options. Measured:

- **`depth` is already threaded.** `toMarkInfo(token, path)` computes
  `depth = path.length - 1`, and `path` arrives by construction at exactly three
  sites per adapter: `Container.tsx:40` / `Container.vue:62` (`[i]`),
  `Block.tsx:49` / `Block.vue:53` (`[blockIndex]`) and `Token.tsx:26` /
  `Token.vue:40` (`[...path, i]`). Substituting `depth={0}` / `depth={depth+1}`
  is a 1:1 edit at those same six sites. Nothing is invented.
- **`path`'s only other consumer in the render loop is `TokenChildren
  ownerPath`** (`Token.tsx:24`, `Token.vue:38`), which S1.8 step 4 re-keys on
  ids. Measured by grep over both adapters: in the *context value* `path` exists
  for `toMarkInfo` and nothing else. So this decision lets the context value
  drop `path` NOW and shrinks S1.8 step 4 by two files.
- **A `MarkNode.depth` field costs more and buys nothing.** It would be the only
  node field that is neither parser-stamped nor signal-backed; `buildNode` would
  need a depth argument, adoption would have to re-stamp it at every recursion
  level (`adoptSiblings` threads `[...parentPath, …]` but no depth), and it
  would have exactly one reader. AGENTS.md: "pick the simplest representation
  that works" and "don't add public surface … without a current caller".

**Therefore:** `toMarkInfo(token: Token, depth: number): MarkInfo` — it loses
its `TokenPath` argument and keeps everything else, including its token-shaped
`hasNestedMarks`. It stays a root export (the corrected table's `[fix]` row),
because it is the entire implementation of `useMarkInfo()` in both adapters.

**Why token-shaped and not node-shaped:** because of D-c. The render context
carries a `Token` and keeps carrying one through S1.7. A `MarkNode` parameter
would force `useMarkInfo` into a `store.tokens.find(token.id)` resolution with a
new `undefined` failure mode, for a function that only reads `children`. If D-c
had gone the other way, `toMarkInfo(node: MarkNode, depth)` would be right. **The
three answers hang together; do not change one without the others.**

### D-b. `MarkPatch` keeps the clear capability and expresses it as `null`

§2.3's replacement is literally `update({value?, meta?, slot?})`, which cannot
carry a `{kind:'set'|'clear'}` discriminator. The three options and their
measured costs:

| option | cost |
| --- | --- |
| keep the discriminator | contradicts §2.3's own signature; keeps `MarkPatch` + `OptionalMarkFieldPatch` at the root, both with **zero** importers outside `packages/core` (measured: `grep -rn MarkPatch packages` hits only `core/index.ts:22`, `MarkController.ts:2,72`, `editorContracts.ts:19` and one generated typedoc page) |
| **`null` = clear** ✅ | fits §2.3's shape exactly; keeps the capability S1.8's trap list protects ("`MarkPatch`'s clear arm (documented capability)"); deletes two exported types; JSON-Merge-Patch convention, so it needs no explanation |
| drop the capability | breaks `guides/dynamic-marks.md:59` and `guides/keyboard-handling.md:56`, un-pins `MarkController.spec.ts:91,112` with no replacement, and S1.8's trap list explicitly forbids sweeping it |

**Therefore:** `type MarkPatch = {value?: string; meta?: string | null; slot?:
string | null}`, moved to `tree/types.ts` (it is the node's write contract now,
not an "editor contract"). Absent/`undefined` leaves the field alone, `null`
clears it, a string sets it.

This is a **breaking runtime change for userland Mark components** that wrote
`{meta: {kind: 'clear'}}`. `@markput/core` is unpublished, but `mark.update()`
is reachable from userland through `useMark()` in both published adapters, so
this is a real public break and AGENTS.md requires it in the commit body rather
than buried as cleanup. Task 2's commit message carries it.

`exactOptionalPropertyTypes` is off (root `tsconfig.json` sets neither it nor
`strict`), so `{meta: undefined}` and an absent `meta` are indistinguishable —
which is exactly the intended semantics, so nothing hangs on it.

### D-c. The adapter render loop does NOT move to `input.nodes()` in S1.7. S1.8 owns it

§11's "single biggest scope lever". Measured before deciding:

1. **§11 sizes S1.7 assuming it does not move**: "~7 files, ~350 lines + docs
   (**more if the render loop moves**)".
2. **Blast radius, counted:** 14 adapter source files import `Token`-family
   types (react `Token.tsx`, `Container.tsx`, `Block.tsx`, `BlockMenu.tsx`,
   `DragHandle.tsx`, `DropIndicator.tsx`, `TokenContext.ts`; vue the same
   seven), plus 4 storybook files (`Overlay.react.stories.tsx`, `Mention.tsx`,
   `UserItem.tsx`, `Base.vue.spec.ts`).
3. **It is not an adapter-only change.** `renderTree` is produced by `commit.ts`
   and consumed by `bind.ts`, which walks `latest: Token[]`; the divergence
   detector compares `handle.token().content` against the DOM
   (`commit.ts:229-234`); `TokenHandle#token` is D9's read latch, deliberately
   kept at S1.6d (plan D-h) with five production readers. Moving the render loop
   means moving the binder — the eight-file contenteditable adapter S1.8's own
   trap list calls "~1,300 lines of irreducible cost".
4. **§2.3 does not require it.** `input.nodes()` is a public READ. Nothing says
   the internal renderer consumes it, and D9 puts node-signal mark props in the
   future tense ("vestigial **once** node-signal mark props land"), with no
   phase assigned.
5. **S1.7's deliverable is fully expressible without it — proven, not argued.**
   `useMark()` returns a live `MarkNode` resolved by
   `store.tokens.find(token.id)`, exactly how `MarkController` has worked since
   S1.6d, and the whole suite is green with the render loop untouched.

**Therefore:** the render loop stays on `renderTree: Token[]`. `Token`,
`TextToken`, `MarkToken` and `TokenPath` stay at the root export with a comment
naming S1.8 as their removal phase.

**Reported consequence (contradiction 3):** S1.8 step 3 is therefore NOT "a
four-line barrel edit". It is the render-loop rewrite, and S1.8's
"net −2,300 to −2,600 source lines, ~20 files deleted, ~35 edited" estimate
excludes it.

### D-d. `MarkController` and `MarkputHandler` are DELETED here, not at S1.8 — and `MarkController`'s deletion is inseparable from `useMark`'s migration

The export table says `MarkputHandler` is "replaced by `MarkputApi`", so its
deletion is unambiguously S1.7's. `MarkController` has no table row and S1.8
step 5 lists it under "superseded modules" — but S1.7 is what supersedes it: the
moment `useMark()` returns a `MarkNode` with `update`/`remove`, the class has
zero production consumers and its patch semantics are precisely what the node
reimplements.

**Verification finding, and the reason there is no Task 4:** the two cannot be
separate tasks. Three splits were tried:

- *Delete `MarkController` in Task 2, migrate `useMark` in Task 4* → both
  adapters stop compiling at Task 2's boundary (`useMark.tsx:1` imports the
  class from `@markput/core`). Task 2 cannot commit green.
- *Keep `MarkController` as a thin delegation for one task* → its spec is then
  a spec for a delegation, and the `?? false` arms it adds are untested.
- *Keep it unchanged with `#serialize` intact* → two live implementations of the
  same serialization for one task, which is what D-d exists to avoid.

The atomic unit is: node verbs + `useMark(): MarkNode` + `MarkController` and
its 399-line spec deleted (ported to `tree/markNode.spec.ts`) + the 19 storybook
`mark.value` sites. That is Task 2. S1.8 step 5 keeps only `ValueModel` +
`replaceInString`.

### D-e. `input.clear()` is not built

§2.3 writes `input.setValue(text: string): boolean // whole-value;
input.clear() = setValue('')`. Read as a definition, not a second verb:
`clear()` would be a zero-caller alias, which AGENTS.md forbids. `setValue('')`
is the documented spelling, and the US-5 story uses it.

### D-f. `select`/`caret` return `false` only for a dangling anchor

§2.3 gives them a boolean with no stated meaning, and
`SelectionController.select` already returns "did the stored selection change" —
which as a public contract is a trap (selecting what is already selected would
answer `false`). The public boolean means **accepted**: `false` iff an anchor
names a node that is not in the live tree (`tokens.find(node.id) !== node`), so
a caller holding a node from a previous generation gets a rejection instead of a
splice at an arbitrary offset. `'start'`/`'end'` always accept. Same fail-closed
rule §6 states for the write verbs, applied to the selection verbs.

### D-g. `insertMark` resolves its return value by position, not by a result feed

`applyRange` answers `boolean`; the `TransactionResult` goes to the boundary's
`onResult`, not to the verb. Rather than thread a result out of the dispatcher
(four sites, one caller), `insertMark` re-reads the tree after the commit and
returns the mark whose `position.start` equals the insertion offset — the parse
of the spliced projection puts it exactly there. In controlled mode the verb
returns `undefined` **before** the lookup, per D6, because the tree has not
moved and the lookup would answer with whatever mark already sits at that
offset. **That early return is load-bearing and its first test did not prove
it** — see Task 8, mutation 5.

---

## File structure

**Create:**

- `packages/core/src/store/MarkputApi.ts` — the §2.3 host object (~165 lines).
- `packages/core/src/store/MarkputApi.spec.ts` — the verb matrix (~215 lines,
  19 cases).
- `packages/core/src/features/tokens/tree/markPatch.ts` — `serializeMark`, the
  one place a patch becomes markup (~22 lines). Split out of the deleted
  `MarkController.#serialize` so `tree/` can serialize without the store.
- `packages/core/src/features/tokens/tree/markNode.spec.ts` — the ported
  `MarkController.spec` (~420 lines, 23 cases).
- `packages/storybook/src/pages/Api/Api.react.stories.tsx` and
  `Api.react.spec.tsx` — the US-5 scenarios (~150 + ~65 lines).

**Delete:**

- `packages/core/src/store/MarkputHandler.ts` (22).
- `packages/core/src/features/tokens/MarkController.ts` (110) and
  `MarkController.spec.ts` (399).

**Modify:**

- `tree/types.ts` (118) — `MarkPatch`, `MarkCommands`, the node shapes.
- `tree/tree.ts` (118) — `buildNode` builds the public members; the port.
- `tree/adopt.ts`, `tree/adoptUtils.ts`, `tree/snapshot.ts` — the rename.
- `tree/adopt.spec.ts`, `tree/adopt.property.spec.ts`, `tree/snapshot.spec.ts`,
  `tree/types.spec.ts`, `tree/tree.spec.ts`.
- `model/TokenModel.ts` (571) — `nodes()`, `applyText()`, `tx()`, `markFor()`,
  the command port.
- `features/selection/SelectionController.ts` (348) — `anchors()`.
- `features/tokens/index.ts` (14), `packages/core/index.ts` (41).
- `shared/editorContracts.ts` (42) — `toMarkInfo`'s signature; the old
  `MarkPatch`/`OptionalMarkFieldPatch` deleted.
- `store/Store.ts` (49), `store/Store.spec.ts` (407).
- `packages/react/markput/index.ts`, `packages/vue/markput/index.ts`.
- react: `MarkedInput.tsx`, `Container.tsx`, `Block.tsx`, `Token.tsx`,
  `TokenContext.ts`, `useMark.tsx`, `useMarkInfo.tsx`.
- vue: `MarkedInput.vue`, `Container.vue`, `Block.vue`, `Token.vue`,
  `tokenKey.ts`, `useMark.ts`, `useMarkInfo.ts`.
- storybook: `Base/MarkputHandler.{react,vue}.spec.*` → `MarkputApi.*` (renamed),
  `Dynamic/Dynamic.{react,vue}.stories.*`,
  `Drag/components/TodoMark/TodoMark.tsx`, `Base/Base.{react,vue}.spec.*`,
  `Nested/nested.{react,vue}.spec.*`, `pages/__snapshots__/stories.react.spec.tsx.snap`.
- website: `guides/dynamic-marks.md`, `guides/keyboard-handling.md`,
  `guides/nested-marks.md`, and the four `useMark`-showing snippets in
  `development/{architecture,how-it-works,performance,rfc-nested-marks}.md`.
- website `src/content/docs/api/**` — regenerated by typedoc; stage it.

**Do NOT touch:** the parser, `bind.ts`, `commit.ts`, `TokenHandle.ts`,
`DomModel.ts`, `tokens/boundary.ts`, `caret.ts`, `block/operations.ts`,
`keyboard/`, `clipboard/`, the internal offset shim (`tree/offsetShim.ts`, D8),
`ValueModel.ts` (S1.8 step 5), `tokenIndex.ts` / `TokenPath` (S1.8 step 4),
`features/tokens/README.md`, and the *prose* of `development/architecture.md`
and `how-it-works.md` describing internal flow (S1.8 step 7 — already two phases
stale per the S1.6bcd plan's contradiction 8). Only the `useMark` snippets in
those files are S1.7's, because S1.7 is what falsifies them.

**Size (measured touch surface):**

| | files changed | +/− |
| --- | --- | --- |
| core | 22 | +816 / −312 |
| adapters | 16 | +63 / −39 |
| storybook | 14 | +298 / −66 |
| website | 20 | +977 / −288 (regenerated typedoc dominates) |

---

## Task 1: nodes get §2.3's public read shape

**Files:** `tree/types.ts`, `tree/tree.ts`, `tree/adopt.ts`, `tree/adoptUtils.ts`,
`tree/snapshot.ts`, `tree/adopt.spec.ts`, `tree/adopt.property.spec.ts`,
`tree/snapshot.spec.ts`, `tree/types.spec.ts`, `tree/tree.spec.ts`.

**[HARD STOP], measured:** the rename lands **alone and first**. Adding
`slot(): string | undefined` to an interface that still declares
`slot: {start, end} | undefined` gives `TS2300: Duplicate identifier 'slot'`
twice and **23 errors** in `packages/core`, none of which names the cause. Run
`typecheck` between Step 1 and Step 3.

- [ ] **Step 1: rename the positional `slot` field to `slotRange` — eleven sites**

The grep that finds them all:
`grep -rn "\.slot\b" packages/core/src/features/tokens | grep -v "parser/core"`.
**Read every hit before editing: the parser's `token.slot` and the property
spec's `MarkToken` comparison must NOT rename.**

`tree/types.ts`:

```ts
	/**
	 * Live slot POSITIONS, written by adoption like `position`. Named `slotRange` since
	 * S1.7, because `slot()` is now the public read of the slot's TEXT (spec §2.3) and one
	 * name cannot be both. Slot text is still deliberately NOT stored: projection, snapshot
	 * and adoption equality all derive it from children, so a stored copy would be an unread
	 * mirror nothing resyncs.
	 */
	slotRange: {start: number; end: number} | undefined
```

`tree/adopt.ts:129` → `node.slotRange = token.slot ? … : undefined`.

`tree/adoptUtils.ts` — **two hits, and they are different**. `shiftPositions`
renames both sides:

```ts
		if (node.slotRange) {
			node.slotRange.start += delta
			node.slotRange.end += delta
		}
```

`snapshotNodeEquals` compares a NODE against a parser TOKEN, so only the node
side renames:

```ts
	if (node.slotRange && token.slot) {
		if (node.slotRange.start + delta !== token.slot.start) return false
		if (node.slotRange.end + delta !== token.slot.end) return false
	}
```

`tree/snapshot.ts:51-54`:

```ts
		slot:
			node.slotRange === undefined || slotText === undefined
				? undefined
				: {content: slotText, start: node.slotRange.start, end: node.slotRange.end},
```

`tree/tree.ts:41` renames in `buildNode`. Specs: `adopt.spec.ts:125,503`
(`shiftedMark.slotRange`, `mark.slotRange`), `snapshot.spec.ts:105`
(`expect(token.slot).not.toBe(node.slotRange)` — token side keeps its name),
and `types.spec.ts:33` (the `toMatchObjectType` pin).

**Leave `adopt.property.spec.ts:180` alone**: `tokensEqualShifted(a: Token, b:
Token)` compares two parser tokens, whose field is still `slot`.

- [ ] **Step 2: typecheck the rename alone**

Run: `pnpm run format && pnpm run typecheck && pnpm -w exec vitest run packages/core && pnpm run lint:check`
Expected: PASS, no behavior change — a pure rename, per AGENTS.md's "make
structural changes pure".

- [ ] **Step 3: write the failing tests**

Append to `tree/tree.spec.ts`, which already has a module-scope
`parser = new Parser(['@[__value__](__meta__)', '#[__slot__]'])`:

```ts
describe('public node shape (spec §2.3)', () => {
	it('exposes the markup string, not the descriptor, as the public view', () => {
		const tree = createTokenTree(parser.parse('a@[x](m)b'))
		const mark = tree.roots()[1]
		if (mark.kind !== 'mark') throw new Error('expected a mark')
		expect(mark.markup).toBe('@[__value__](__meta__)')
		expect(mark.markup).toBe(mark.descriptor.markup)
	})

	it('derives slot() from the children, and answers undefined for a slotless markup', () => {
		const tree = createTokenTree(parser.parse('#[in slot]@[x](m)'))
		const withSlot = tree.roots()[1]
		const withoutSlot = tree.roots()[3]
		if (withSlot.kind !== 'mark' || withoutSlot.kind !== 'mark') throw new Error('expected marks')
		expect(withSlot.slot()).toBe('in slot')
		expect(withoutSlot.slot()).toBeUndefined()
	})

	it('slot() tracks the live children — it is a read, not a snapshot', () => {
		const tree = createTokenTree(parser.parse('#[before]'))
		const mark = tree.roots()[1]
		if (mark.kind !== 'mark') throw new Error('expected a mark')
		const child = mark.children()[0]
		if (child.kind !== 'text') throw new Error('expected a text child')
		child.text('after')
		expect(mark.slot()).toBe('after')
	})

	it('range() reads the stored positions of both node kinds', () => {
		const tree = createTokenTree(parser.parse('ab@[x](m)'))
		const [text, mark] = tree.roots()
		expect(text.range()).toEqual({start: 0, end: 2})
		// '@[x](m)' is SEVEN characters: [2,9), not [2,10). Measured — the first draft of
		// this plan had 10 and the case went red on arithmetic, not on the code.
		expect(mark.range()).toEqual({start: 2, end: 9})
	})

	it('range() returns a copy — a caller cannot write the stored position through it', () => {
		const tree = createTokenTree(parser.parse('ab'))
		const node = tree.roots()[0]
		node.range().start = 99
		expect(node.range()).toEqual({start: 0, end: 2})
		expect(node.position).toEqual({start: 0, end: 2})
	})
})
```

- [ ] **Step 4: run — the new tests fail**

Run: `pnpm -w exec vitest run packages/core/src/features/tokens/tree/tree.spec.ts`
Expected: FAIL on `markup`, `slot`, `range` being undefined.

- [ ] **Step 5: implement**

`tree/types.ts` — `import type {Markup} from '../parser/types'`, then:

```ts
export interface TextNode {
	readonly kind: 'text'
	readonly id: Id
	readonly text: Signal<string>
	position: {start: number; end: number}
	/**
	 * Spec §2.3's explicit derived read. NOT reactive: `position` is a plain field written
	 * by adoption (spec D3), so a consumer that must react to a move watches `changed` or
	 * the content signals instead. Returns a COPY — the stored record is adoption's, and
	 * handing it out would let a caller corrupt the coordinate space every splice is
	 * computed in.
	 */
	range(): {start: number; end: number}
}
```

and on `MarkNode`, next to `descriptor`:

```ts
	/** Spec §2.3: the public view of the descriptor, which is not a public type. */
	readonly markup: Markup
```

plus, after `position`:

```ts
	/** Spec §2.3: the slot's TEXT, joined from the live children. `undefined` for a slotless markup. */
	slot(): string | undefined
	/** Spec §2.3. See {@link TextNode.range}. */
	range(): {start: number; end: number}
```

`tree/tree.ts` — the closures capture `node`, which is legal because they run
after the declaration completes:

```ts
			const node: TextNode = {
				kind: 'text',
				id: alloc(),
				text: signal({initial: token.content}),
				position: {...token.position},
				range: () => ({...node.position}),
			}
```

```ts
		const node: MarkNode = {
			kind: 'mark',
			id: alloc(),
			descriptor: token.descriptor,
			// A plain field, not a getter: `descriptor` is readonly and `descriptor.markup` is
			// immutable, so the two cannot diverge, and the node stays a plain data object the
			// equality helpers walk without surprises.
			markup: token.descriptor.markup,
			value: signal({initial: token.value}),
			meta: signal({initial: token.meta}),
			children: signal<readonly TreeNode[]>({initial: token.children.map(buildNode)}),
			slotRange: token.slot ? {start: token.slot.start, end: token.slot.end} : undefined,
			position: {...token.position},
			// Same rule as joinNodes and materializeNode: a slot mark always parses with >=1
			// text child, so children are the sole slot source.
			slot: () => (node.descriptor.hasSlot ? joinNodes(node.children()) : undefined),
			range: () => ({...node.position}),
		}
```

`tree/types.spec.ts` — extend the two `toMatchObjectType` pins (and import
`Markup`), otherwise the new members are unpinned:

```ts
			position: {start: number; end: number}
			range: () => {start: number; end: number}
		}>()
```

```ts
			readonly descriptor: MarkupDescriptor
			readonly markup: Markup
```

```ts
			slotRange: {start: number; end: number} | undefined
			position: {start: number; end: number}
			slot: () => string | undefined
			range: () => {start: number; end: number}
		}>()
```

- [ ] **Step 6: gate**

Run: `pnpm run format && pnpm -w exec vitest run packages/core && pnpm run typecheck && pnpm run lint:check && pnpm test`
Measured: **71 files, 1297 passed, 7 todo**; typecheck/lint/format clean.

- [ ] **Step 7: commit**

```bash
git add -A packages/core
git commit -m "feat(tokens): S1.7 nodes get §2.3's public read shape — markup, slot(), range()

Renames MarkNode.slot (positions) to slotRange so slot() can be the public read
of the slot's text, per spec §2.3. No behavior change beyond the three reads."
```

---

## Task 2: mark writes ride the node; `useMark` returns it; `MarkController` dies

**Files:** create `tree/markPatch.ts`, `tree/markNode.spec.ts`; modify
`tree/types.ts`, `tree/tree.ts`, `tree/types.spec.ts`, `model/TokenModel.ts`,
`shared/editorContracts.ts`, `features/tokens/index.ts`, `packages/core/index.ts`;
delete `features/tokens/MarkController.ts` + `MarkController.spec.ts`; both
adapters' `useMark`, `useMarkInfo`, token context, `Token`/`Container`/`Block`;
both adapter barrels; seven storybook files.

**[HARD STOP], and it is why this task is this large:** the pieces cannot be
split — see D-d for the three splits that were tried and what each breaks.
**There is deliberately no Task 4**; the numbering skips it so every
cross-reference in this document keeps pointing at the same task.

**Where to declare `MarkCommands`:** `tree/types.ts`. Not because a gate forces
it — a deliberate type-only cycle (`types.ts → tree.ts → types.ts`) passes
`pnpm run lint:check` clean, measured, so the "`import/no-cycle` rejects it"
reasoning an earlier draft used is **false**. It goes there because `types.ts`
is where the tree layer's contracts live and both modules already import it.

- [ ] **Step 1: the patch type, the port and the serializer**

`tree/types.ts`:

```ts
/**
 * Spec §2.3's mark patch. Three states per optional field, expressed without a
 * discriminator (plan decision D-b): absent/`undefined` leaves the field alone, `null`
 * clears it, a string sets it. Replaces the `{kind:'set'|'clear'}` `OptionalMarkFieldPatch`
 * of the pre-v2 surface — a documented break.
 */
export type MarkPatch = {
	readonly value?: string
	readonly meta?: string | null
	readonly slot?: string | null
}

/**
 * The write port `MarkNode.update`/`remove` ride (spec D5). Declared here rather than
 * beside the verbs in `transactions.ts` because `types.ts` is where the tree layer's
 * contracts live and both modules already import it. Injected as a THUNK: `TokenModel`
 * builds `#tree` before `#tx`, the same reason `SelectionPort` is one.
 */
export interface MarkCommands {
	update(node: MarkNode, patch: MarkPatch): boolean
	remove(node: MarkNode): boolean
}
```

`MarkNode` gains:

```ts
	/** Spec §2.3. Rides a transaction (spec D5); `false` in read-only mode or off the tree. */
	update(patch: MarkPatch): boolean
	remove(): boolean
```

(and `types.spec.ts` pins both, importing `MarkPatch`).

New `tree/markPatch.ts`:

```ts
import {annotate} from '../parser/utils/annotate'
import type {MarkNode, MarkPatch} from './types'

/**
 * A patch becomes markup. Moved out of the deleted `MarkController` (`#serialize` plus its
 * three field defaults) so the node can serialize without reaching into the store; the only
 * semantic change is `null` instead of `{kind: 'clear'}` (plan decision D-b).
 *
 * The defaults come off the NODE: an omitted key must round-trip the current field, and the
 * slot's current value is the joined children, because the node stores no slot text
 * (`MarkNode.slotRange` is positions only).
 */
export function serializeMark(node: MarkNode, patch: MarkPatch): string {
	const value = patch.value ?? node.value()
	const meta = patch.meta === null ? undefined : (patch.meta ?? node.meta())
	const slot = patch.slot === null ? undefined : (patch.slot ?? node.slot())
	return annotate(node.markup, {
		value,
		meta: node.descriptor.gapTypes.includes('meta') ? (meta ?? '') : undefined,
		slot: node.descriptor.hasSlot ? (slot ?? '') : undefined,
	})
}
```

`tree/tree.ts`:

```ts
export function createTokenTree(
	tokens: readonly Token[],
	/**
	 * Spec §2.3's `mark.update`/`mark.remove`. Optional because the tree is built UNWIRED in
	 * the specs and in the §7.1 snapshot gate, where there is no transaction layer to write
	 * through; an unwired node's verbs answer `false`, which is the same fail-closed answer a
	 * dead node gives.
	 */
	commands?: () => MarkCommands | undefined
): TokenTree {
```

and, in the mark literal:

```ts
			update: patch => commands?.()?.update(node, patch) ?? false,
			remove: () => commands?.()?.remove(node) ?? false,
```

`model/TokenModel.ts`:

```ts
	readonly #tree = createTokenTree([], () => this.#markCommands)
	readonly #memo = createSnapshotMemo()

	/**
	 * Spec §2.3's mark verbs, lowered onto `applyStructural` (spec D5). Read-only and
	 * dead-node gating live in the transaction layer, so both arms answer exactly what it
	 * answers — the deleted `MarkController` duplicated those two checks.
	 */
	readonly #markCommands: MarkCommands = {
		update: (node, patch) => this.applyStructural(node, serializeMark(node, patch)),
		remove: node => this.applyStructural(node, ''),
	}
```

`shared/editorContracts.ts` — delete `OptionalMarkFieldPatch` and the old
`MarkPatch`.

- [ ] **Step 2: `markFor` — strict, and that is measured**

```ts
	/**
	 * Spec §2.3's `useMark()` resolution: the live node behind a render-tree mark token.
	 *
	 * STRICT, and that is measured rather than assumed: every token an adapter renders comes
	 * from a tree published by `commitStructural`, so `find(token.id)` cannot miss. A tolerant
	 * variant — the pre-S1.7 `MarkController` returned `''` for a mark that had left the tree
	 * — was tried first and the whole suite stayed green either way, so the fallback would
	 * have been an untested guard AGENTS.md tells you not to keep.
	 *
	 * RECORDED GAP: by the same token nothing exercises the throw, so returning a bogus node
	 * instead of throwing also survives the suite. The error path is unfalsifiable here — it
	 * would take a React interleaving that re-renders a mark component after its node died,
	 * which no test can construct.
	 */
	markFor(token: MarkToken): MarkNode {
		const node = token.id === undefined ? undefined : this.find(token.id)
		if (node?.kind !== 'mark') throw new Error(`markFor: no live mark node for token #${token.id}`)
		return node
	}
```

- [ ] **Step 3: port `MarkController.spec.ts` → `tree/markNode.spec.ts`**

Mechanical, and the port must not lose a case: the identity-bridge suite (four
cases across text-path commits), the pending-window suite (two cases, including
the S1.6d inversion where a mid-window write SUCCEEDS), and the fail-closed
pairs. The transformation is `MarkController.fromToken(store, token)` →
`markNodeOf(store, token)` and `controller.X` → the node's read:

```ts
/**
 * Ported from the deleted `MarkController.spec.ts` at S1.7 (plan decision D-d): the class
 * was the second implementation of these semantics once `mark.update`/`remove` moved onto
 * the node, so the behaviors it pinned are the NODE's now. A captured node object is the
 * exact equivalent of the controller's captured id: adoption keeps a node object exactly
 * when it keeps its id.
 */
function markNodeOf(store: Store, token: {id?: number}): MarkNode {
	if (token.id === undefined) throw new Error('token has no id')
	const node = store.tokens.find(token.id)
	if (node?.kind !== 'mark') throw new Error('expected a live mark node')
	return node
}
```

Two cases change shape rather than spelling:

- `'exposes readonly snapshot fields'` loses `controller.readOnly` (editor
  state left the mark surface) and gains `expect(node.markup).toBe('@[__value__]')`.
- `'readOnly is a live read of props.readOnly()'` becomes the gating claim,
  which is what actually survives:

```ts
	it('both write verbs fail closed the moment readOnly flips', () => {
		// `readOnly` LEFT the mark surface at S1.7 (§2.3 does not put editor state on a node),
		// so what is left to pin is the gating itself, which lives in the transaction layer.
		const {store, node} = mountedSetup()
		store.props.set({readOnly: true})
		expect(node.update({value: 'bad'})).toBe(false)
		expect(node.remove()).toBe(false)
		expect(store.value.current()).toBe('he@[x]llo')
	})
```

Add the two `null`-direction cases the old spec could not have — they are what
mutations 1 and 2 need:

```ts
	it('preserves an unpatched META when only the value changes', () => {
		// The `null`-vs-omitted split (plan decision D-b) needs BOTH directions pinned: this
		// one dies if `serializeMark` treats an omitted key as a clear.
		const {store, node} = setup('hello @[world](keep)', '@[__value__](__meta__)')
		node.update({value: 'other'})
		expect(store.value.current()).toBe('hello @[other](keep)')
	})

	it('sets meta from a plain string', () => {
		const {store, node} = setup('hello @[world]()', '@[__value__](__meta__)')
		node.update({meta: 'user:1'})
		expect(store.value.current()).toBe('hello @[world](user:1)')
	})
```

and the two existing clear cases become `{meta: null}` / `{slot: null}`.

Delete `features/tokens/MarkController.ts` and `MarkController.spec.ts`, drop
`MarkController` from `features/tokens/index.ts` and from
`packages/core/index.ts`, and widen the token barrel:

```ts
export type {Id, MarkNode, MarkPatch, NodeAnchor, TextNode, TransactionResult, TreeNode} from './tree/types'
```

- [ ] **Step 4: `toMarkInfo` loses its path**

```ts
/**
 * Build a {@link MarkInfo} for a mark token at the given render depth. `depth` arrives by
 * construction from the render loop (the parent that maps the tree knows it), which is what
 * it always did — S1.7 only stops laundering it through a `TokenPath` whose LENGTH was the
 * real input (plan decision D-a). That unhooks this function from the path layer S1.8
 * deletes. Throws if `token` is not a mark token.
 */
export function toMarkInfo(token: Token, depth: number): MarkInfo {
	if (token.type !== 'mark') throw new Error('toMarkInfo: token is not a mark')
	return {depth, hasNestedMarks: token.children.some(child => child.type === 'mark')}
}
```

- [ ] **Step 5: thread `depth` through both render contexts**

React `TokenContext.ts` — `path` leaves the context VALUE (`Token.tsx` keeps it
as a prop for `TokenChildren`, which S1.8 step 4 re-keys):

```ts
export type TokenContextValue = {
	readonly store: Store
	readonly token: Token
	/**
	 * Nesting level, by construction from the render loop: a top-level token is 0. It
	 * replaced the render-time `TokenPath` at S1.7 — `path.length - 1` was the only thing
	 * anything here read off it, and the path layer goes at S1.8 (plan decision D-a).
	 */
	readonly depth: number
}
```

React `Token.tsx`:

```tsx
export const Token = memo(({token, path, depth}: {token: TokenType; path: TokenPath; depth: number}) => {
	…
					<Token key={keyOf(child)} token={child} path={[...path, i]} depth={depth + 1} />
	…
		<TokenContext value={{store, token, depth}}>
```

`Container.tsx:40` → `depth={0}`; `Block.tsx:49` → `depth={0}`.

Vue `tokenKey.ts` → `export type TokenContext = {readonly depth: number; readonly token: Token}`;
`Token.vue` gains `depth: {type: Number, required: true}`, provides
`toRef(() => ({depth: props.depth, token: props.token}))` and passes
`depth: props.depth + 1` to children; `Container.vue` and `Block.vue` pass
`:depth="0"`.

- [ ] **Step 6: the hooks**

```tsx
// packages/react/markput/src/lib/hooks/useMark.tsx
import type {MarkNode} from '@markput/core'
import {useMemo} from 'react'

import {useTokenContext} from '../providers/TokenContext'
import {useMarkput} from './useMarkput'

/** The live mark node for the surrounding mark token context (spec §2.3). */
export const useMark = (): MarkNode => {
	const {store, token} = useTokenContext()
	// Subscribe to readOnly changes to trigger a re-render when it changes; the node's write
	// verbs read readOnly lazily, so the retained node is correct either way.
	useMarkput(s => s.props.readOnly)
	if (token.type !== 'mark') throw new Error('useMark must be called within a mark token context')

	return useMemo(() => store.tokens.markFor(token), [store, token])
}
```

Vue resolves once in `setup` — safe by construction: adoption keeps a node
object exactly when it keeps its id, and a new id means a new `keyOf` and a
fresh component. `useMarkInfo` in both adapters reads `depth` off the context.

- [ ] **Step 7: migrate the storybook consumers — this is what makes the suite green**

`typecheck` finds the React ones for you (10 errors: `Type 'Signal<string>' is
not assignable to type 'ReactNode'` and friends). It does **not** find the Vue
ones, which live in `.vue` render functions and `.vue.spec.ts` `h()` calls —
grep for them:
`grep -rn "mark\.value\|mark\.meta\|mark\.slot\|mark\.readOnly" packages/storybook/src`.
Nineteen sites across `Dynamic/Dynamic.{react,vue}.stories.*`,
`Base/Base.{react,vue}.spec.*`, `Nested/nested.{react,vue}.spec.*` and
`Drag/components/TodoMark/TodoMark.tsx`: `mark.value` → `mark.value()`, same for
`meta`/`slot`.

`TodoMark.tsx` is the one that is not a rename — `readOnly` is not on the node:

```tsx
	const mark = useMark()
	// `readOnly` LEFT the mark surface at S1.7 (§2.3 does not put editor state on a node).
	const readOnly = useMarkput(s => s.props.readOnly)
	const [isDone, setIsDone] = useState(mark.value() === 'x')
```

- [ ] **Step 8: gate — FULL suite**

Run: `pnpm run format && pnpm test && pnpm run typecheck && pnpm run lint:check`
Measured: **71 files, 1299 passed, 7 todo**; typecheck/lint/format clean. (One
run in this pass hit the vue optimize-deps import flake — `Failed to import test
file … vitest.setup.vue.ts / SyntaxError: Unexpected token '}'`, zero failed
assertions — and was green on re-run.)

- [ ] **Step 9: commit**

```bash
git add -A
git commit -m "feat(tokens)!: S1.7 mark writes ride the node; useMark returns it

BREAKING: useMark() returns a MarkNode, not a MarkController. Reads are signal
calls — mark.value() / mark.meta() / mark.slot() — and mark.readOnly is gone;
read the editor's readOnly through useMarkput(s => s.props.readOnly).

BREAKING: mark.update() no longer takes {kind:'set'|'clear'} field patches. An
omitted key leaves the field alone, null clears it, a string sets it:
mark.update({meta: {kind:'clear'}}) becomes mark.update({meta: null}).

MarkController is deleted — it was the second implementation of these patch
semantics once the node carried them. Its spec is ported to
tree/markNode.spec.ts. useMarkInfo() is unchanged for callers; internally its
depth now arrives through the render context instead of a TokenPath, which
unhooks toMarkInfo from the path layer S1.8 deletes."
```

---

## Task 3: `MarkputApi` — the §2.3 host object

**Files:** create `store/MarkputApi.ts`, `store/MarkputApi.spec.ts`; modify
`store/Store.ts`, `store/Store.spec.ts`, `model/TokenModel.ts`,
`features/selection/SelectionController.ts`, `packages/core/index.ts`, both
adapters' `MarkedInput`, both adapter barrels, two storybook specs; delete
`store/MarkputHandler.ts`.

- [ ] **Step 1: widen the engine SPI**

`TokenModel`, next to `find`:

```ts
	/**
	 * Spec §2.3's `input.nodes()`: the live root nodes. REACTIVE — `roots` is a signal, so a
	 * consumer inside an effect re-runs on every structural change. Deliberately does NOT
	 * seed, for {@link offsetOf}'s reason: it is a read, and seeding writes signals.
	 */
	nodes(): readonly TreeNode[] {
		return this.#tree.roots()
	}

	/**
	 * @internal Spec §2.3's `replaceText`: node-local coordinates (spec D5).
	 *
	 * RECORDED GAP (measured): dropping `#ensureSeeded()` here and on {@link tx} survives the
	 * whole suite — every fixture reaches these verbs through a mounted store, which the mount
	 * watch already seeded. Kept for parity with {@link replace} and {@link applyStructural},
	 * whose gates are the unmounted-store specs.
	 */
	applyText(node: TextNode, range: {start: number; end: number}, text: string): boolean {
		this.#ensureSeeded()
		return this.#tx.applyText(node, range, text)
	}

	/** @internal Spec §2.3's `input.tx` (spec D5's composition rules). */
	tx(fn: () => void): boolean {
		this.#ensureSeeded()
		return this.#tx.tx(fn)
	}
```

`SelectionController`, above `focusFirst`:

```ts
	/**
	 * Spec §2.3's `input.selection()`: the STORED anchors (spec D7), not the derived numbers
	 * — {@link range} is the numeric projection. Reactive: a tracked read.
	 */
	anchors(): Anchors | undefined {
		return this.#anchors()
	}
```

- [ ] **Step 2: write the host**

**[HARD STOP], measured:** the constructor parameter is `selectionController`.
With `selection`, the class has both a parameter property and a `selection()`
method: `TS2300: Duplicate identifier 'selection'` ×2 in `MarkputApi.ts` plus
`TS2341` and `TS2349` at the call site. The codebase already paid for this
lesson once — `model/TokenModel.ts:314-319`.

```ts
// packages/core/src/store/MarkputApi.ts
import type {SelectionController} from '../features/selection/SelectionController'
import type {Host} from '../features/state/Host'
import type {PropsModel} from '../features/state/PropsModel'
import {annotate} from '../features/tokens'
import type {Id, MarkNode, NodeAnchor, TextNode, TokenModel, TreeNode} from '../features/tokens'
import type {TokenDelta} from '../features/tokens/model/commitInput'
import type {Markup} from '../features/tokens/parser/types'
import type {Range} from '../shared/editorContracts'
import type {Event} from '../shared/signals'

/** Spec §2.3's `insertMark` initializer. */
export type MarkInit = {
	readonly markup: Markup
	readonly value: string
	readonly meta?: string
	readonly slot?: string
}

/**
 * THE public surface (spec §2.3). The evolved `MarkputHandler`: it keeps `container`,
 * absorbs `focus()`, drops the consumer-free `overlay` getter, and gains the live node
 * reads, the model-centric write verbs, node-anchored selection and the `changed` payload.
 *
 * It owns nothing. Every member lowers onto a state owner — the token layer for reads and
 * writes, the selection controller for anchors — so the shape of the API can move without
 * moving state (AGENTS.md's one-owner rule).
 */
export class MarkputApi {
	constructor(
		private readonly host: Host,
		private readonly props: PropsModel,
		private readonly tokens: TokenModel,
		/**
		 * NAMED `selectionController`, not `selection`: this class has a
		 * `selection(): {anchor, head} | undefined` method, and TypeScript rejects a parameter
		 * property colliding with a member (TS2300) — the same collision `TokenModel`
		 * documents for its own `selectionPort`.
		 */
		private readonly selectionController: SelectionController
	) {}

	get container(): HTMLElement | null {
		return this.host.container()
	}

	/**
	 * The string projection (spec D1): controlled → the props value, uncontrolled → the last
	 * committed `join(tree)`. A delegation to {@link TokenModel.value}, and deliberately not
	 * `join(tree)` inline — the two disagree while a controlled parent's `props.value` is
	 * ahead of the last arrival. (Gated: swapping in `joinNodes(nodes())` fails 9 core tests.)
	 */
	value(): string {
		return this.tokens.value()
	}

	/** The live root nodes, reactive (spec §2.3, D11). Ids are always present. */
	nodes(): readonly TreeNode[] {
		return this.tokens.nodes()
	}

	find(id: Id): TreeNode | undefined {
		return this.tokens.find(id)
	}

	/** Fires once per commit, after the DOM is consistent (spec §2.3; D9's fold merging). */
	get changed(): Event<TokenDelta> {
		return this.tokens.changed
	}

	/**
	 * Returns the fresh node in uncontrolled mode and `undefined` in controlled mode (spec D6:
	 * the node exists only once the parent's echo commits — a caller re-finds it from
	 * `changed`). The uncontrolled lookup is BY POSITION rather than through a result feed:
	 * `applyRange` answers a boolean and the `TransactionResult` goes to the boundary, so
	 * threading one out would touch four sites for one caller. The parse of the spliced
	 * projection puts the mark exactly at the insertion offset (plan decision D-g).
	 */
	insertMark(at: NodeAnchor | 'caret', init: MarkInit): MarkNode | undefined {
		const offset = this.#offsetOf(at)
		if (offset === undefined) return undefined
		const text = annotate(init.markup, {value: init.value, meta: init.meta, slot: init.slot})
		if (!this.tokens.replace({start: offset, end: offset}, text)) return undefined
		if (this.props.value() !== undefined) return undefined
		return markStartingAt(this.tokens.nodes(), offset)
	}

	replaceText(target: {node: TextNode; start: number; end: number}, text: string): boolean {
		return this.tokens.applyText(target.node, {start: target.start, end: target.end}, text)
	}

	/** Cross-node (spec D5). The pair is normalized, so `from` after `to` is legal. */
	replaceRange(from: NodeAnchor, to: NodeAnchor, text: string): boolean {
		const a = this.#offsetOf(from)
		const b = this.#offsetOf(to)
		if (a === undefined || b === undefined) return false
		return this.tokens.replace({start: Math.min(a, b), end: Math.max(a, b)}, text)
	}

	/**
	 * Whole-value. Rides the internal offset shim's gap narrowing (spec D8), like every other
	 * whole-value site — which is what the `-1` sentinel selects.
	 *
	 * RECORDED GAP (measured): passing `{0, this.value().length}` instead survives the whole
	 * suite. The two take the same `lowerReplace` branch whenever the props value and the tree
	 * projection agree, and an arrival is synchronous on the props watch, so they agree at
	 * every observable moment. Kept as the sentinel because it is the tree's own length by
	 * construction rather than a read of a value that is props-first in controlled mode.
	 */
	setValue(text: string): boolean {
		return this.tokens.replace({start: 0, end: -1}, text)
	}

	tx(fn: () => void): boolean {
		return this.tokens.tx(fn)
	}

	focus(): void {
		this.selectionController.focusFirst()
	}

	/** The STORED anchors (spec D7), not the derived numbers. Reactive. */
	selection(): {anchor: NodeAnchor; head: NodeAnchor} | undefined {
		return this.selectionController.anchors()
	}

	select(anchor: NodeAnchor, head: NodeAnchor = anchor): boolean {
		if (!this.#live(anchor) || !this.#live(head)) return false
		this.selectionController.select(anchor, head)
		return true
	}

	caret(at: NodeAnchor): boolean {
		return this.select(at)
	}

	selectionRange(): Range | undefined {
		return this.selectionController.range()
	}

	/** `'caret'` yields `undefined` when there is no selection (spec §2.3). */
	#offsetOf(anchor: NodeAnchor | 'caret'): number | undefined {
		if (anchor === 'caret') return this.selectionController.range()?.start
		if (!this.#live(anchor)) return undefined
		return this.tokens.offsetOf(anchor)
	}

	/**
	 * An anchor naming a node from a previous generation is REJECTED rather than silently
	 * resolved (plan decision D-f): its stored `position` is whatever adoption last wrote
	 * before the node left the tree, so resolving it would splice at an arbitrary offset. The
	 * document edges are always live.
	 */
	#live(anchor: NodeAnchor): boolean {
		if (typeof anchor === 'string') return true
		const node = 'node' in anchor ? anchor.node : 'before' in anchor ? anchor.before : anchor.after
		return this.tokens.find(node.id) === node
	}
}

/** The mark a splice just created: the parse puts it exactly at the insertion offset. */
function markStartingAt(nodes: readonly TreeNode[], offset: number): MarkNode | undefined {
	for (const node of nodes) {
		if (node.kind !== 'mark') continue
		if (node.position.start === offset) return node
		const found = markStartingAt(node.children(), offset)
		if (found) return found
	}
	return undefined
}
```

- [ ] **Step 3: the spec**

Nineteen cases in `store/MarkputApi.spec.ts`. Three of them are fixtured the way
they are because of a measured mutation — do not "simplify" them:

**[HARD STOP], measured:** `api.changed(fn)` **emits**. `Event<T>` is
`(payload: T) => void`, so the natural spelling fires the event with the
listener as its payload; at runtime `BlockController.ts:43` throws
`TypeError: delta.removed is not iterable`. The subscription verb is `watch`:

```ts
	it('changed carries the ids of one commit', () => {
		const {api} = setup('hello')
		const seen: {added: readonly number[]; removed: readonly number[]; updated: readonly number[]}[] = []
		// `changed` is an Event, so the subscription verb is `watch` — CALLING it emits. That
		// is why both adapter barrels re-export `watch`: without it a userland consumer of
		// @markput/react cannot consume the documented event at all.
		watch(api.changed, delta => seen.push(delta))
		const id = api.nodes()[0].id
		api.replaceText({node: textAt(api, 0), start: 0, end: 1}, 'H')
		expect(seen).toHaveLength(1)
		expect(seen[0].updated).toEqual([id])
		expect(seen[0].added).toEqual([])
	})
```

```ts
	it('insertMark returns undefined in controlled mode but still emits', () => {
		// The fixture is LOAD-BEARING: it puts an existing mark AT the insertion offset, so the
		// positional lookup would answer with THAT node if the controlled early return were
		// dropped. With a mark-free offset the mutation survives — measured.
		const emitted: string[] = []
		const {api} = setup('@[a](m)b', {controlled: true, onChange: v => emitted.push(v)})
		expect(api.insertMark('start', {markup: MARKUP, value: 'x'})).toBeUndefined()
		expect(emitted).toEqual(['@[x]()@[a](m)b'])
		expect(api.value()).toBe('@[a](m)b') // controlled: nothing committed
	})

	it('insertMark returns the mark it created, not the first mark in the document', () => {
		// Discriminates the positional lookup: with a mark BEFORE the insertion point, a
		// "first mark in the tree" implementation returns the wrong node.
		const {api} = setup('@[a](m)tail')
		const existing = api.nodes()[1]
		const fresh = api.insertMark('end', {markup: MARKUP, value: 'b', meta: 'n'})
		expect(api.value()).toBe('@[a](m)tail@[b](n)')
		expect(fresh?.id).not.toBe(existing.id)
		expect(fresh && api.find(fresh.id)).toBe(fresh)
	})
```

The `selection()` case needs a typeof guard before `in`, or TS rejects the
narrowing (`TS2322: NodeAnchor is not assignable to object` — `NodeAnchor`
includes the two string edges):

```ts
		const anchor = api.selection()?.anchor
		if (typeof anchor === 'string' || anchor === undefined || !('node' in anchor)) {
			throw new Error('expected a text anchor')
		}
		expect(anchor.offset).toBe(2)
```

The rest: `value()`/`nodes()` agreement and always-present ids; `find` hit and
miss; `insertMark` at an anchor / at `'caret'` with and without a selection;
`replaceText` accept and out-of-node reject; `replaceRange` across a mark with a
reversed pair; `setValue` to `''` and back; `tx` composing two disjoint ops into
one emission and rejecting an overlapping pair; `caret` + `selectionRange`;
`select` across two anchors; `select` rejecting a dangling anchor; `container`
and `focus`. Task 8 adds four more.

- [ ] **Step 4: wire `Store`, retire `MarkputHandler`, move the ref**

`Store.ts`:

```ts
	readonly api = new MarkputApi(this.host, this.props, this.tokens, this.selection)
```

Delete `store/MarkputHandler.ts`. `Store.spec.ts`'s `handler` describe becomes
`api`, and its `overlay` case is deleted rather than ported — the getter is
consumer-free per the §2.3 table, confirmed by grep over both adapters, the
storybook and the demo apps. Say so in a comment above the describe.

`packages/core/index.ts` swaps one line now (Task 5 rearranges the whole
barrel); react `MarkedInput.tsx` takes `ref?: Ref<MarkputApi>` and
`useImperativeHandle(props.ref, () => store.api, [store])`; vue
`MarkedInput.vue` calls `defineExpose(store.value.api)` — verified working: the
Vue expose proxy resolves prototype getters and methods, which the renamed
`MarkputApi.vue.spec.ts` gates on `api.value?.container`.

Rename `Base/MarkputHandler.{react,vue}.spec.*` → `MarkputApi.*` and swap the
identifiers.

Both adapter barrels re-export `watch` — without it the §2.3 `changed` event is
documented but unreachable from the two packages that ship:

```ts
// `changed` is an Event: the subscription verb is `watch`. Without this re-export the
// §2.3 event is documented but unreachable from the published packages.
export {watch} from '@markput/core'
```

- [ ] **Step 5: gate — FULL suite (adapter files changed)**

Run: `pnpm run format && pnpm test && pnpm run typecheck && pnpm run lint:check`
Measured: **72 files, 1313 passed, 7 todo**; typecheck/lint/format clean.

- [ ] **Step 6: commit**

```bash
git add -A
git commit -m "feat(core)!: S1.7 MarkputApi — the §2.3 host object

BREAKING: the component ref now exposes MarkputApi, not MarkputHandler. It keeps
container, absorbs focus(), drops the consumer-free overlay getter, and adds
value/nodes/find/changed, insertMark/replaceText/replaceRange/setValue/tx and
node-anchored selection. Both adapters re-export watch, which is how the changed
event is subscribed."
```

---

## Task 5: execute the export-disposition table at the root

**Files:** `packages/core/index.ts`, both adapter barrels.

*(There is no Task 4 — see D-d.)*

**[HARD STOP] ×2, both measured, both spec rows that are wrong:**

1. **`SlotRegistry` must stay.** Zero imports, load-bearing through module
   augmentation (`react/vue src/augment.ts`: `declare module '@markput/core' {
   interface SlotRegistry {…} }`). Dropping it collapses `Slot` to `unknown`:
   **TS2604/TS2786 ×8** in the React adapter alone (`Block.tsx:36`,
   `Container.tsx:37`, `OverlayRenderer.tsx:18`, `Token.tsx:33` ×2 …). Grep
   cannot see an augmentation; that is why the inventory missed it.
2. **`computed`/`effect`/`watch`/`Computed`/`SignalValues` must stay.** They are
   the runtime and the signatures of `useMarkput` — react `useMarkput.ts:1-2`,
   vue `:1-2` — the hook §2.3 explicitly keeps. Removing them: **9 typecheck
   errors** across both adapter packages.

- [ ] **Step 1: rewrite `packages/core/index.ts`**

```ts
// ═══ Public API v2 (spec §2.3) ════════════════════════════════════════════════
export {MarkputApi} from './src/store/MarkputApi'
export type {MarkInit} from './src/store/MarkputApi'
// The ONLY resolution path for both adapters, which import it as a value and construct it.
export {Store} from './src/store'
export type {Id, MarkNode, MarkPatch, NodeAnchor, TextNode, TreeNode} from './src/features/tokens'

// String-domain utilities (spec §2.3: keep)
export {annotate, denote} from './src/features/tokens'
export type {Markup} from './src/features/tokens'

// Adapter utilities (spec §2.3: keep)
export {cx} from './src/shared/utils'
export {key} from './src/shared/classes'
export {filterSuggestions, navigateSuggestions} from './src/features/overlay'
export {getAlwaysShowHandle} from './src/features/block'
export type {
	OverlayMatch,
	OverlayTrigger,
	CoreOption,
	CSSProperties,
	CoreSlots,
	DataAttributes,
	DraggableConfig,
	Slot,
	// NOT dead, and invisible to grep: both adapters carry
	// `declare module '@markput/core' { interface SlotRegistry {…} }` (react/vue
	// src/augment.ts). Drop the export and `Slot` collapses to `unknown`, which fails
	// every slot component as a JSX element (TS2604/TS2786, 8 errors). §2.3's table
	// lists it among the zero-importer drops; a module augmentation is not an import.
	SlotRegistry,
} from './src/shared/types'

// The `useMarkput` runtime. §2.3's "signal/computed/watch/batch not exported from root"
// row is WRONG for these five and for `watch`'s role as the `changed` subscription verb:
// `computed` + `watch` are react `useMarkput`'s runtime (useMarkput.ts:1), `effect` is
// vue's (:1), and `Computed`/`SignalValues` are in their signatures. The rest of the
// reactive system — signal, batch, event, isReactive, Signal, Event — has zero non-core
// importers and is gone.
export {computed, effect, watch} from './src/shared/signals'
export type {Computed, SignalValues} from './src/shared/signals'
export {readSelected} from './src/shared/readSelected'
export type {Selectable, ObjectSelector} from './src/shared/readSelected'

// Mark metadata (spec §2.3: keep — the whole implementation of useMarkInfo)
export {toMarkInfo} from './src/shared/editorContracts'
export type {MarkInfo} from './src/shared/editorContracts'

// ═══ Snapshot render loop — S1.8 step 3 removes these WITH the render loop ════
// Kept deliberately (plan decision D-c): 14 adapter files render `Token[]` off
// `renderTree`, and moving that loop onto `input.nodes()` also moves `bind`/`commit`.
export type {Token, TextToken, MarkToken} from './src/features/tokens'
export type {TokenPath} from './src/shared/editorContracts'
```

**Dropped rows, each with measured evidence** (grep over
`packages/{react,vue}/markput/src`, `packages/storybook/src`,
`packages/{react,vue}/app`, excluding `dist/`): `MarkputHandler` (replaced),
`MarkController` (deleted, Task 2), `merge`, `DEFAULT_OPTIONS`, `CoreSlotProps`,
`Range`, `MarkSlot`, `OverlaySlot`, `signal`, `batch`, `event`, `isReactive`,
`Signal`, `Event`, and the old `MarkPatch`/`OptionalMarkFieldPatch` — **zero
importers each**.

- [ ] **Step 2: the adapter barrels**

```ts
// Re-export from core
export {denote, annotate, MarkputApi} from '@markput/core'
// `changed` is an Event: the subscription verb is `watch`. Without this re-export the
// §2.3 event is documented but unreachable from the published packages.
export {watch} from '@markput/core'
export type {Markup, Token, TextToken, MarkToken} from '@markput/core'
export type {Id, MarkNode, MarkPatch, NodeAnchor, TextNode, TreeNode} from '@markput/core'
```

- [ ] **Step 3: gate**

Run: `pnpm run format && pnpm test && pnpm run typecheck && pnpm run lint:check && pnpm run build`
Measured: **72 files, 1313 passed, 7 todo**; all clean. `build` is in this gate
specifically — the adapters' DTS bundles are rolled up from these barrels
(`rolldown-plugin-dts`, `codeSplitting: false`), so a barrel that typechecks can
still fail to bundle. The resulting tail export statement (S1.8's gate reads
this line) is, for both adapters:

```
export { type Id, type MarkNode, type MarkPatch, type MarkProps, type MarkToken, MarkedInput,
type MarkedInputProps, MarkputApi, type Markup, type NodeAnchor, type Option,
type OverlayHandler, type OverlayProps, type SlotProps, type Slots, type TextNode,
type TextToken, type Token, type TreeNode, annotate, denote, useMark, useMarkInfo,
useMarkput, useOverlay, watch };
```

- [ ] **Step 4: commit**

```bash
git add -A
git commit -m "feat(core)!: S1.7 execute the §2.3 export-disposition table

BREAKING: @markput/core's root export drops merge, DEFAULT_OPTIONS,
CoreSlotProps, Range, MarkSlot, OverlaySlot, MarkPatch's old shape, and the
reactive primitives with no external caller (signal, batch, event, isReactive,
Signal, Event). MarkputHandler and MarkController are gone.

Two of §2.3's rows are corrected against measurement: SlotRegistry STAYS (both
adapters augment it, which grep cannot see; dropping it collapses Slot to
unknown), and computed/effect/watch/Computed/SignalValues STAY (they are the
runtime of useMarkput, which §2.3 keeps).

Token/TextToken/MarkToken/TokenPath stay pending S1.8's render-loop move."
```

---

## Task 6: storybook — the US-5 story

**Files:** create `packages/storybook/src/pages/Api/Api.react.stories.tsx` and
`Api.react.spec.tsx`; update `pages/__snapshots__/stories.react.spec.tsx.snap`.

- [ ] **Step 1: the story**

Eight buttons, one per AC-5.1 scenario, all driven through the `MarkputApi` ref
with no global offsets. Three things in it are load-bearing:

**[HARD STOP] `insertMark('caret')` needs `onMouseDown` + `preventDefault`.**
Measured: without it the case fails. `SelectionController`'s `focusout` handler
clears the stored anchors, so a toolbar button that takes focus makes `'caret'`
resolve to `undefined` every time.

```tsx
			{/*
			 * `onMouseDown` + preventDefault is REQUIRED, not decoration: the selection
			 * controller clears its stored anchors on `focusout`, so a toolbar button that
			 * takes focus makes `insertMark('caret')` reject every time. It is the standard
			 * toolbar pattern and the only way §2.3's `'caret'` verb is usable from UI
			 * outside the editor.
			 */}
			<button
				type="button"
				data-testid="insert-at-caret"
				onMouseDown={e => e.preventDefault()}
				onClick={() => api.current?.insertMark('caret', {markup: MARKUP, value: 'carol', meta: 'u3'})}
			>
				insert at caret
			</button>
```

**[HARD STOP] the Block fixture must be two MARKS, not two lines.** Block rows
are top-level TOKENS: `'first row\nsecond row'` renders as ONE row and the
between-rows scenario is not exercised at all.

```tsx
// Block ROWS are top-level TOKENS, not newline-separated lines: two marks are two rows,
// and `'first row\nsecond row'` would be ONE text row — which is why the between-rows
// scenario needs this fixture and not a multi-line string.
export const Block: Story = {args: {layout: 'block', initial: '@[a](x)@[b](y)'}}
```

**[HARD STOP] lint.** Write `const node = nodes()[index]; if (node.kind !==
'text')` (not `node?.kind`) and `element().textContent` (not
`?? ''`) — `typescript(no-unnecessary-condition)` is error-level and the
pre-commit hook runs it.

The remaining buttons: `edit-meta` (`update({meta: 'edited'})`), `clear-meta`
(`update({meta: null})`), `remove-mark`, `replace-span`
(`replaceText({node: textAt(0), start: 0, end: 5}, 'Howdy')`), `replace-across`
(`replaceRange({node: textAt(0), offset: 6}, {after: nodes()[1]}, 'nobody')`),
`set-value`, `clear-value` (`setValue('')` — D-e), `insert-between-rows`
(`insertMark({after: nodes()[0]}, …)`), plus an `<output data-testid="value">`.

- [ ] **Step 2: the spec, one case per AC-5.1 scenario**

Eight cases asserting the exact resulting value, e.g.:

```tsx
	it('inserts a mark between block rows', async () => {
		await render(<Block />)
		expect(page.getByTestId('block').elements()).toHaveLength(2)
		await userEvent.click(page.getByTestId('insert-between-rows'))
		// BETWEEN the two rows, not appended: `{after: rows[0]}` is the only addressing form
		// for a between-row position, because block mode filters the empty text tokens that
		// would otherwise sit there (spec §2.3's NodeAnchor paragraph).
		expect(read()).toBe('@[a](x)@[row](r)@[b](y)')
	})
```

and, for the caret case, resolve the editable explicitly:
`document.querySelector<HTMLElement>('[contenteditable]')!`.

- [ ] **Step 3: the HTML snapshots — order matters**

**[HARD STOP]:** `pages/stories.react.spec.tsx` walks every story, so the first
run **writes** two snapshots for the new page, and any later fixture change
makes the suite RED with a genuine mismatch. Get the fixtures right first; then
run once, then read the diff (AGENTS.md: explain it before accepting it — here
it is "a new story page", and after the Block correction it is "one text row
became two mark rows"), then `pnpm -w exec vitest run
packages/storybook/src/pages/stories.react.spec.tsx -u`.

- [ ] **Step 4: gate**

Run: `pnpm run format && pnpm run lint:check && pnpm test && pnpm run typecheck`
Measured: **73 files, 1323 passed, 7 todo**; all clean. Re-run once on a
suite-level IMPORT failure with zero failed assertions; never on an assertion
failure.

- [ ] **Step 5: commit**

```bash
git add -A packages/storybook
git commit -m "test(storybook): S1.7 US-5 scenarios as a MarkputApi story"
```

---

## Task 7: website docs

**Files:** `guides/dynamic-marks.md`, `guides/keyboard-handling.md`,
`guides/nested-marks.md`, and the `useMark` snippets in
`development/{architecture,how-it-works,performance,rfc-nested-marks}.md`.

**[HARD STOP], measured:** typedoc regenerates `src/content/docs/api/**` during
**`pnpm run typecheck`** (`astro check` runs the starlight-typedoc plugin,
`astro.config.ts:96-98`), not only during the website build. So every task gate
from Task 2 onward leaves those pages dirty and they must be staged with that
task's commit. Good news the first draft got wrong: typedoc **does** delete
pages for removed exports — `api/classes/MarkController.md` and
`api/classes/MarkputHandler.md` were removed by the regeneration, and
`MarkputApi.md`, `MarkNode.md`, `TextNode.md`, `Id.md`, `MarkPatch.md`,
`NodeAnchor.md`, `TreeNode.md`, `watch.md` were added. No manual `git rm`.

- [ ] **Step 1: `guides/dynamic-marks.md`**

Retitle "Controller API" → "Mark node API" and replace the table:

| Property or method | Purpose |
| ------------------ | ------- |
| `id` | Stable identity, assigned at birth and never reused. |
| `markup` | The markup this mark was parsed with. |
| `value()` | Current `__value__`. |
| `meta()` | Current `__meta__`. |
| `slot()` | Current `__slot__` text, joined from the live children. |
| `children()` | The mark's child nodes. |
| `range()` | `{start, end}` of the mark in the current value. |
| `update(patch)` | Serialize a patch and replace the mark. `false` when read-only or when the mark has left the value. |
| `remove()` | Delete the mark. `false` under the same conditions. |

with the note that the reads are calls because they are the node's own reactive
fields; every `mark.value` → `mark.value()`; the patch samples become
`{meta: 'user:1'}` / `{meta: null}`; the read-only sample switches to
`useMarkput(s => s.props.readOnly)`; and the stale line "`remove()` and
`update()` return an edit result. A read-only editor returns `{ok: false,
reason: 'readOnly'}`" is deleted — they have returned `boolean` since before
this phase.

Add an **Editor API** section with the ref sample (including the
`onMouseDown`/`preventDefault` note — the API is unusable from a toolbar
without it) and a member table for `MarkputApi`, ending with the `changed` row:
"Subscribe with `watch(api.changed, fn)`." That sentence is `watch`'s caller,
and the reason it is re-exported.

- [ ] **Step 2: the falsified snippets elsewhere**

`guides/keyboard-handling.md`: `mark.update({meta: {kind: 'clear'}})` →
`{meta: null}`, `@{mark.value}` → `@{mark.value()}`.
`guides/nested-marks.md`: `mark.slot ?? mark.value` →
`(mark.slot() ?? mark.value())`, and its "Parent and child traversal is
intentionally not exposed through `useMark()`" paragraph is now false —
`mark.children()` walks downward; what does not exist is a parent link.
`development/performance.md:285`: `const {value, meta} = useMark()` destructures
the signal functions — becomes `const mark = useMark(); const value =
mark.value()`. `development/architecture.md:445`, `how-it-works.md:55`,
`rfc-nested-marks.md:12,21`: the `MarkController` mentions in *hook* snippets.

**Leave the internal-flow prose alone** (`store.refs`, `store.value.replace()`,
the edit-flow list): it is S1.8 step 7's and already two phases stale. Only what
S1.7 itself falsifies is in scope.

- [ ] **Step 3: gate**

```bash
pnpm run format
pnpm -F @markput/website run build          # measured: 49 pages, was 43
git status --short packages/website          # regenerated api/** — review and stage
pnpm test && pnpm run typecheck && pnpm run lint:check && pnpm run format:check
```

`pnpm exec oxfmt --check` on a docs file answers "All matched files may have
been excluded by ignore rules" — `packages/website/src/content/docs/` is in
`oxfmt.config.ts`'s `ignorePatterns`. That is the expected answer, not a
failure.

- [ ] **Step 4: commit**

```bash
git add -A packages/website
git commit -m "docs: S1.7 public API v2 — MarkNode reads, null-clear patches, MarkputApi"
```

---

## Task 8: hardening — mutation proof and the recorded gaps

- [ ] **Step 1: apply each mutation, confirm a NAMED test fails, revert, confirm green**

Twenty-two were run. Sixteen died immediately:

| # | mutation | killed by |
| --- | --- | --- |
| 1 | `serializeMark` treats `null` like an omitted key (meta) | `markNode.spec` "clears metadata without leaking placeholder text" |
| 2 | `serializeMark` treats an omitted key like a clear (meta) | `markNode.spec` "preserves an unpatched META when only the value changes" |
| 2b | same, slot | `markNode.spec` "preserves an unpatched slot when only the value changes" |
| 3 | `MarkNode.slot()` reads the construction-time token instead of the live children | `tree.spec` "slot() tracks the live children" |
| 4 | `MarkputApi.#live` always `true` | `MarkputApi.spec` "select() rejects an anchor whose node has left the tree" |
| 5b | `insertMark` returns the first mark in the tree | `MarkputApi.spec` "insertMark returns the mark it created…" |
| 6 | `replaceRange` drops the min/max normalization | `MarkputApi.spec` "replaceRange spans a mark and normalizes a reversed pair" |
| 7 | `toMarkInfo` returns `depth + 1` | **17 assertions in 3 browser files** — the `Nested` `data-depth` specs |
| 9 | `range()` returns the stored object | `tree.spec` "range() returns a copy…" |
| 10 | `MarkputApi.tx` calls `fn()` directly | 2 cases: the overlap rejection AND the single-emission case |
| 11 | `value()` reads `joinNodes(nodes())` | **9 core tests** |
| 12 | `markFor` drops the id check | 3 browser files |
| 13 | `select()` ignores the head anchor | `MarkputApi.spec` "select() spans two anchors" |
| F | `markup` reads a frozen literal | 9 tests |
| G | `select()` always returns `true` | `MarkputApi.spec` dangling-anchor case |
| 5 (re-fixtured) | `insertMark` skips the controlled early return | `MarkputApi.spec` controlled case — *only after Step 2* |

- [ ] **Step 2: the six survivors — four closed, one re-fixtured, three recorded**

**Survivor A — mutation 5, and the plan asserted it was gated.** "insertMark
returns undefined in controlled mode but still emits" passed under the mutation:
with a mark-free insertion offset the positional lookup answers `undefined`
anyway. **Closed by re-fixturing**, not by a new test: controlled `'@[a](m)b'`,
insert at `'start'`, so a mark already sits at the offset the lookup probes.
*Lesson, and it is the same one S1.4's plan learned: a "returns undefined" test
proves nothing unless the wrong path would return something else.*

**Survivors B, C, D — closed by three tests added here.**

```ts
	it('insertMark carries the slot through to the markup', () => {
		// Without this the `init.slot` passthrough is unproven — measured: dropping it from
		// `annotate` survives the whole suite.
		const {api} = setup('ab')
		const node = api.insertMark(
			{node: textAt(api, 0), offset: 1},
			{markup: SLOT_MARKUP, value: 'v', slot: 'inner'}
		)
		expect(api.value()).toBe('a#[v]{inner}b')
		expect(node?.slot()).toBe('inner')
	})

	it("insertMark at 'caret' with a RANGED selection inserts at the selection start", () => {
		// Discriminates `range().start` from `range().end`: every collapsed fixture agrees.
		const {api} = setup('abcd')
		const node = textAt(api, 0)
		api.select({node, offset: 1}, {node, offset: 3})
		expect(api.insertMark('caret', {markup: MARKUP, value: 'x'})?.kind).toBe('mark')
		expect(api.value()).toBe('a@[x]()bcd')
	})

	it('nodes() is reactive — §2.3 says so, and an effect must re-run on a structural change', () => {
		// Measured: without this, wrapping `TokenModel.nodes()` in `untracked` survives the
		// entire suite, so the "reactive" half of §2.3's read contract is unproven.
		const {api} = setup('hello')
		let runs = 0
		const stop = effect(() => {
			api.nodes()
			runs++
		})
		expect(runs).toBe(1)
		api.setValue('a@[x](m)b')
		expect(runs).toBe(2)
		stop()
	})
```

(The fixture's `options` gains a second entry `SLOT_MARKUP = '#[__value__]{__slot__}'`.)

**Survivors E, H, A′ — recorded in code, not invented around.** Each carries its
comment at the site (see Tasks 2 and 3 for the exact wording):

1. **`markFor`'s throw is unfalsifiable.** Returning a bogus node instead of
   throwing survives the whole suite — nothing reaches the error path, which is
   the same measurement that says the strict version is safe.
2. **`applyText`/`tx` `#ensureSeeded()`.** Dropping both survives: every fixture
   reaches those verbs through a mounted, already-seeded store. Kept for parity
   with `replace`/`applyStructural`, whose gates are the unmounted-store specs.
3. **`setValue`'s `-1` sentinel.** `{0, this.value().length}` survives: the two
   take the same `lowerReplace` branch whenever the props value and the tree
   projection agree, and an arrival is synchronous on the props watch, so they
   agree at every observable moment.

- [ ] **Step 3: full gates**

Run: `pnpm run format && pnpm test && pnpm run build && pnpm run typecheck && pnpm run lint:check && pnpm run format:check && pnpm -F @markput/website run build`
Measured final: **73 files, 1326 passed, 7 todo (1333)**; tsc 0 errors, lint
clean, format clean, build clean, website 49 pages.

- [ ] **Step 4: commit**

```bash
git add -A
git commit -m "test(core): S1.7 hardening — mutation-proven verbs and three recorded gaps"
```

---

## Contradictions found while writing and verifying this plan (report, do not paper over)

1. **§2.3's export table has TWO more wrong rows, and one of them is invisible
   to grep.** `SlotRegistry` is listed among the zero-importer drops but is
   load-bearing through module augmentation (8 JSX type errors when dropped),
   and the `signal`/`computed`/`watch`/`batch` row cannot coexist with keeping
   `useMarkput` (9 typecheck errors). That makes **five** corrected rows in
   total, counting the inventory's three. The table's method — "zero importers
   ⇒ drop" — is what failed: an augmentation is not an import, and the row's
   author did not read the hook the same section keeps.
2. **The roadmap's S1.7 section is stale in its central claim.** It still says
   positional snapshots and `replace(range, …)` "move to `@markput/core/compat`,
   frozen and documented for removal next major", and "Note the two lifetimes
   (spec D8): the *public compat entry* sunsets next major" — both killed by
   D8's amendment two sections earlier in the same document, whose own header
   says no compat artifact is built. Reading the S1.7 section alone would build
   the wrong phase.
3. **S1.8 step 3 is not "a four-line barrel edit" under D-c.** §11 poses the
   render-loop question as deciding between a barrel edit and a rewrite; this
   plan answers "S1.8", so step 3 IS the rewrite of
   `MarkSlot`/`resolveMarkSlot`/`renderTree`/`keyOf` plus 14 adapter files and 4
   storybook files, and it drags `bind.ts`/`commit.ts` with it. S1.8's
   "net −2,300 to −2,600 source lines, ~20 files deleted, ~35 edited" does not
   include that work and must be re-sized before S1.8 is planned.
4. **S1.8 step 5's "superseded modules" list shrinks to one item.**
   `MarkputHandler` is deleted by the table row that replaces it (Task 3) and
   `MarkController` by the decision that supersedes it (Task 2, D-d). Only
   `ValueModel` + `replaceInString` remain.
5. **§2.3's `MarkNode` sketch collides with the shipped node in two places and
   the spec does not say so.** `slot` is a positional record on the live node
   and a text accessor in §2.3 (resolved by the `slotRange` rename), and
   `markup` does not exist at all — the node carries `descriptor`. Anyone
   diffing `tree/types.ts` against §2.3 before this phase would conclude the
   node already matched. It did not.
6. **§2.3 gives `select`/`caret`/`replaceText` booleans with no stated
   meaning**, while `SelectionController.select` already returns a *different*
   predicate ("did the stored selection change"), which as a public contract is
   a trap. Settled in D-f; the spec should adopt the wording.
7. **§2.3's `input.changed: Event<…>` is a footgun and, as specified, is
   unreachable from the published packages.** `Event<T>` is callable as an
   emitter, so `api.changed(fn)` fires the event with the listener as payload
   and crashes `BlockController` at runtime; the subscription verb is `watch`,
   which the adapters did not re-export. Both barrels now do. The spec should
   either say "subscribe with `watch`" or give the host an `onChanged` method.
8. **§2.3's "`useMark()` … (no captured-token fallback)" is right for the wrong
   reason.** The predicted problem — React re-rendering a mark with a stale
   token — does not happen, measured; the strict resolution is green. So the
   clause holds, but not because a fallback was considered and rejected: nobody
   had measured it, and the first draft of this plan invented a 20-line detached
   stand-in for a failure mode that does not occur.
9. **`insertMark('caret')` is unusable from UI outside the editor without
   `preventDefault`.** `SelectionController` clears its anchors on `focusout`,
   so §2.3's `'caret'` verb — advertised as the ergonomic way to insert a
   mention — silently rejects for every toolbar button written the obvious way.
   Documented in the guide and in the story; a real API decision (preserve the
   last selection on blur?) is worth its own issue.
10. **Every gate that runs `pnpm run typecheck` mutates the repo.** `astro
    check` runs starlight-typedoc, which rewrites `packages/website/src/content/
    docs/api/**`. That is a checked-in directory, so "run the gate" and "leave
    the tree clean" are in conflict for every task, not just the docs task.

---

## Self-review notes (spec → plan)

- Covers §11's S1.7 scope line in full: §2.3 exports (`MarkputApi`, verbs, node
  views, selection, `changed` payload) — Tasks 1, 2, 3, 5; node-backed
  `useMark` — Task 2; the export table executed directly against the root with
  no compat entry — Task 5; storybook migration onto v2 shapes plus new US-5
  stories — Tasks 2 and 6; website docs — Task 7.
- **All three of §11's questions are answered with measurements** (D-a, D-b,
  D-c) and the three answers are **coupled**: D-a's token-shaped `toMarkInfo` is
  a consequence of D-c's render-loop deferral. Changing one requires re-deciding
  the others.
- **Seven tasks, seven commits, seven revert units** (numbering skips 4 — see
  D-d), with the Task 5 ⇒ Task 6 coupling named in the header. The suite,
  typecheck, lint and format are green at all seven boundaries, verified by
  checking each commit out and re-running.
- **Where a test cannot discriminate, it is said so:** three recorded gaps
  (`markFor`'s throw, `applyText`/`tx` seeding, `setValue`'s sentinel), each
  with its comment at the site. Four other survivors were closed by tests and
  one by re-fixturing.
- **Fixtures chosen to discriminate:** a controlled document with a mark AT the
  insertion offset (the only shape that gates `insertMark`'s controlled return);
  a document with a mark BEFORE the insertion point (the positional lookup); a
  RANGED selection (`range().start` vs `.end`); `'@[a](x)@[b](y)'` in block mode
  (the only shape where "between rows" means anything); an `effect` over
  `nodes()` (the only thing that proves §2.3's "reactive").
- **Deliberately deferred, with reasons above:** the adapter render loop and the
  snapshot names (D-c, S1.8 step 3); the internal offset shim (D8 — `setValue`
  and `replaceRange` deliberately ride it rather than duplicating it);
  `ValueModel` (S1.8 step 5); `TokenPath`/`tokenIndex` (S1.8 step 4);
  `features/tokens/README.md` and the internal-flow prose in
  `development/architecture.md` (S1.8 step 7); `input.clear()` (D-e); an
  `onChanged` subscribe method (contradiction 7); selection preservation across
  blur (contradiction 9).
- **The standing lesson from S1.6bcd held again**: the risk was not in the
  reasoning that felt hard. Of the five hard stops this plan *predicted*, two
  were false and one was right for the wrong reason. Of the twelve it actually
  hit, the expensive ones were sentences nobody thought about — `SlotRegistry`'s
  augmentation, `Event` being callable, block rows being tokens, and typedoc
  writing into the repo from `typecheck`.
</content>
</invoke>
