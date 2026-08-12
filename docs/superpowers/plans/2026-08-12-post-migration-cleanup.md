# Post-Migration Cleanup & Controlled-Mode De-Hacking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the defect/debt backlog accumulated by the one-host migration's review rounds, then delete the controlled-mode echo machinery — the second-largest entry in the hack inventory.

**Architecture:** Stage A ships independent small fixes (each its own commit, no ordering constraints). Stage B resolves the block-mode gap/caret semantics cluster with a measure-first probe. Stage C is the heavy piece: re-examine the echo protocol / `#committed` / lazy seeding triad now that the tree is the only address space, fix the two known controlled-mode defects inside it, and delete what the fixes obsolete. Stage D covers native-interaction edges and a11y. Stage E restores measurement honesty in docs and coverage.

**Tech Stack:** TypeScript dependency-free core, hand-rolled signals, vitest browser-mode specs (real Chromium), storybook suites per framework.

**Prior art:** the one-host migration branch (`next..b0`, 20 commits, plan `2026-08-11-one-host-migration.md`). Its review loops caught 8+ defects the pins missed; keep the same two-stage review discipline. Standing constraints unchanged: `store/**`, exported barrels, and `Store`/`MarkputApi` surface need their own ⚠ APPROVAL; comments are present-tense truths; every commit green on its own (`vitest run` full suite — the storybook suites are green now, there is no expected-red window in this plan).

**Gates (all, before claiming any task done):**

```bash
pnpm exec vitest run             # 70 files / 1387 passed / 7 todo baseline
pnpm run typecheck
pnpm run build
pnpm run lint:check
pnpm run format:check
```

---

## Stage A — independent small fixes (any order, one commit each)

### Task A1: forward-Delete at a row start merges backward

`blockEdit.ts` `handleDelete` runs the identical merge branch for Backspace and Delete when `caretAtStart` — so forward-Delete at the start of row N merges N into N−1 (backward), where native semantics merge N+1 into N (forward at row END) or do nothing at row start. Newly reachable since cross-row caret movement went native.

**Files:** `packages/core/src/features/keyboard/blockEdit.ts`, `blockEdit.spec.ts`

- [ ] **Step 1: failing pins.** Block doc `one\n\ntwo\n\n`: (a) caret at START of row 1, Delete → the branch must NOT merge backward — decide the contract first: match native expectations = Delete at row start deletes forward within the row (guard falls through to the guard pipeline), Delete at row END merges row N+1 into N. Pin both: `Delete at a row start edits forward, not a backward merge`; `Delete at a row end merges the next row in`.
- [ ] **Step 2: run** → the first pin red (backward merge happens).
- [ ] **Step 3: implement.** In `handleDelete`, split the key direction: Backspace keeps `caretAtStart → mergeOrFocusNeighbor(index)`; Delete gains `caretAtEnd → mergeOrFocusNeighbor(index + 1)` (verify `mergeOrFocusNeighbor`'s index convention against its body first) and no longer fires on `caretAtStart`.
- [ ] **Step 4: gates; commit** `fix(keyboard): forward-Delete merges forward at a row end, not backward at its start` (BREAKING note: Delete-at-row-start behavior changes).

### Task A2: three row-creating caret conventions → one

Measured divergence: `applyDragAction` `add` → caret at the new row's START; `addDragRow` (blockEdit Enter on a mark row) → caret AFTER the inserted content; select-all+Enter → offset 0. One user-visible convention should hold: the caret lands INSIDE the fresh row's editable slot.

**Files:** `packages/core/src/features/block/operations.ts`, `operations.spec.ts`, `keyboard/blockEdit.ts`, `blockEdit.spec.ts`

- [ ] **Step 1:** write the contract pin per path (three cases asserting the resolved anchor's owner is the fresh row's slot text node — the select-all+Enter pin already asserts this shape; mirror it for the other two).
- [ ] **Step 2: run** → the divergent paths red.
- [ ] **Step 3:** unify: `startOf(...) + slot offset` for all three (derive the slot offset the way the select-all arm does; `createRowContent`'s shape decides — read it first).
- [ ] **Step 4: gates; commit** (BREAKING: caret after "add row" moves for two paths; list old→new).

### Task A3: the 24px gutter with draggable:false

`SlotsFeature.ts` reserves the grip gutter only when `isBlock && draggable`, but since gate unification the grip renders (as a menu trigger) in block mode regardless — with `draggable:false` it sits outside the padded area (`.SidePanel` is `left:-24px`).

**Files:** `packages/core/src/features/slots/SlotsFeature.ts`, its spec, one storybook snapshot regen expected

- [ ] **Step 1:** failing pin: block + `draggable:false` mount → the container carries the gutter padding class/style (read SlotsFeature to see what it actually toggles).
- [ ] **Step 2-3:** gate the gutter on `isBlock()` alone.
- [ ] **Step 4:** regen affected snapshots (attribute-level diff only), gates, commit.

### Task A4: `placeAtHandle` honesty and the `api.focus()` no-op window

`SelectionDriver.placeAtHandle` returns `true` whenever the handle is alive and the node found, even when the subsequent placement declines — `focusFirst` then returns without reaching its container-focus fallback, so `api.focus()` can focus nothing. ⚠ APPROVAL: `api.focus()` is public surface; behavior change needs the maintainer's yes before the commit.

**Files:** `packages/core/src/features/tokens/dom/SelectionDriver.ts`, `SelectionDriver.spec.ts`

- [ ] **Step 1:** failing pin: a store whose first root's handle is alive but placement declines (mid-pendingStructural window — reuse the latch fixture pattern from `commitPipeline.spec`) → `focusFirst()` must still land focus on the container.
- [ ] **Step 2-3:** thread the placement boolean: `placeAtHandle` returns what `#applySelection`'s placement answered (or falls through); `focusFirst` falls back to `container.focus()` on false. Keep `selectNode`'s dedupe semantics intact (read the comment at the call site first).
- [ ] **Step 4:** gates; commit with the ⚠ approval recorded in the body.

### Task A5: cut `TokenHandle.focus()` ⚠ APPROVAL

Zero production callers since the migration (last caller died in T8's `focusRow` cleanup). `TokenHandle` is Store-reachable: get the maintainer's explicit yes, then delete the method + its spec cases; grep evidence in the commit body.

### Task A6: delete the committed bench artifacts

`packages/core/**/parser.bench.result.json` + friends — 1569 lines of repository noise (hack-inventory entry 10). Zero behavior. Verify nothing imports them (`rg -l "bench.result"`), delete, commit `chore(core): drop committed bench artifacts`.

---

## Stage B — block-mode gap semantics (measure first)

### Task B1: probe — the block bracket-token filter vs caret answers

Block mode filters the empty bracket/gap text tokens from the tree (`tree/valueBoundary.ts` — the filter predates the migration). Consequence measured during the final review: after deleting the only char between two adjacent marks in block layout, the restored caret resolves through `anchorAt`'s right-affine fallback to the DOCUMENT END (offset 21) instead of the deletion site (offset 14) — the `'left'` arm would answer 14, but globally flipping it regressed inline controlled mode (that conflict is settled: `anchorAt` takes an explicit side; only select-all's start seed passes 'left').

- [ ] **Step 1: probe, no production code.** A throwaway spec enumerating block caret answers after edits at every gap/edge offset in `plain\n\n@[m](1)X@[n](2)` and 2-3 sibling shapes, under three designs: (a) status quo; (b) the repair path (`resolveMappedAnchor`) passing `'left'` ONLY in block layout; (c) block stops filtering bracket tokens (the filter's reason must be re-read first — find why it exists: `git log -S "filter" tree/valueBoundary.ts` + the spec that pins it).
- [ ] **Step 2: report the probe table and STOP.** Design (c) changes block's whole address space — maintainer decision. Designs (a) vs (b): pick by the table. The task ends with a written recommendation; the fix lands as its own follow-up task with the chosen design.

---

## Stage C — editable mark values (feature, needs its own design pass)

Measured 2026-08-12 (both branches, real Chromium) and independently confirmed by the maintainer on `next`: a consumer cannot make a mark's own text editable. It is **pre-existing, not a migration regression**; when it first broke was not bisected and does not matter for the design below. `contentEditable` + `onInput` on the mark element is structurally dead under one host — a `contenteditable=true` element nested inside another editable element is **not its own editing host**, so `beforeinput`/`input` target the container and the mark's own listener never runs. On `next` the same pattern destroyed the mark instead (no island guard existed).

Design direction to evaluate (do NOT implement without the maintainer's design pass): a consumer-declared `contenteditable` on a value-only mark root means "this element's text IS the value". Core then keeps the attribute (`editableState` stops stomping it), exempts the island on BOTH tiers (the keydown tier must read the caret, not `event.target` — measured gap), stops dragging the caret out of the island (`hasEditableAncestorBefore` misses the case where the island IS the mark root), and routes the edit to `node.update({value})`.

Two competing shapes for the last step — pick before writing code:
- **model-owned** (recommended, keeps "the DOM is never read back into the value"): the guard computes the new value string from the target range + data and calls `update`; positions inside an editable mark become addressable in the boundary reader.
- **DOM read-back**: after the browser edits the island, read its `textContent` and call `update`. Smaller, but introduces the one thing the core has never had.

Open question either shape must answer with a measurement: does the caret survive the re-parse/re-render, given the DOM under the caret is the consumer's own.

---

## Stage D — native edges

### Task D1: native select-all escape from consumer islands (probe first)

Measured: Ctrl+A inside an explicit-`ce=true` island — the model correctly stays out, but the NATIVE chord moves focus island→container with a collapsed caret at document start. Probe what Chromium does with nested editing hosts + selectAll, then decide: intercept-and-scope (preventDefault + programmatic island range) or accept-and-document. STOP after the probe with a recommendation.

### Task D2: mark-FIRST value docs — invisible selection highlight

Measured: select-all on `@[m](1)\n\nplain\n\n` (value-doc, react adapter) gives a non-collapsed selection whose `toString()` is `""` — the highlight may be invisible while typing still replaces. Reproduce, diagnose (likely the parent-anchored endpoints select element boundaries with no text between in THAT shape), fix or document.

### Task D3: kill the write asymmetry at mark boundaries

Measured after the near-edge caret fix: a caret at a mark's START boundary costs two DOM selection writes per mousedown, at its END one. Harmless today (no drag row regressed), but it is the same churn class that made the first near-edge attempt break drags. The principled fix is a re-place skip: `#applySelection` compares against `domAnchors()` and does not rewrite a selection that already means the same position. Hot path with many pinned specs — pin first, then change.

---

## Stage E — measurement honesty & coverage

### Task E1: measure the two inference-labeled inconsistencies rows

`inconsistencies.md` marks Shift+Arrow and the focus/blur counts as "expected resolved — not separately measured". Measure both in live Chromium (the T10a sweep script pattern), update the rows to measured status (or file what fails).

### Task E2: vue non-draggable grip coverage

The vue adapter's `draggable:false` grip path has zero tests (react has one snapshot). Add the vue mirror pin.

### Task E3: the adopt twin pins — decision memo

`adopt.spec.ts` pins two wrong adoptions (window twin-confusion; the in-slot deletion case kills the wrong sibling). Not new, but the migration's anchor work makes the cost visible. Write the reproduction + the fix options (window bound for slot recursion was DESIGNED but never implemented — the spec exists) as a memo for the maintainer; implementation only after an explicit yes. No code in this task.

---

## Explicitly OUT of this plan

- **The controlled-mode echo cluster** (hack-inventory #5/#6/#7 + its two measured defects: two edits in one task lose the first character; typing a character equal to the following text leaves the caret before it). Maintainer decision 2026-08-12: not now.
- **ARIA / `role="textbox"`** on the container. Maintainer decision 2026-08-12: not interesting.
- Editor-owned undo history (needs its own design; undo is dead in both topologies, measured).
- IME/composition (uncancelable `insertCompositionText`; own design).
- `shared/signals` replacement (hack-inventory #9 — breaks the dependency-free promise; maintainer decision first).
- Adapter dedup (react/vue ~90%; the Suggestions keydown semantics DIFFER — semantics decision, not a move).
- `prepack.js` overwriting the Vite build (hack-inventory #11 — own issue).
- Block-selection mode (approved LATER feature).
- **Click-selects-the-mark** (ProseMirror-style NodeSelection for inline atomics: click highlights the whole mark, Backspace deletes it). Raised 2026-08-12 after the near-edge caret fix; no decision taken. Related to block-selection mode — decide them together.
- PropsModel JSX-absent-key spread claim (`readOnly` un-set requires explicit false) — needs an adapter-contract decision; memo-only if touched.

## Self-review notes

- Stage C is the only stage with cross-task ordering (C1 → C2 → C3); A and D/E tasks are independent.
- Approval markers: A4 (api.focus behavior), A5 (TokenHandle surface), C2's onChange-semantics fork, D3 (if MarkputApi grows), E3 (pin flips). B1 and D1 end in STOP-with-recommendation by design.
- The C1-before-C2 discipline is the lesson of the migration: the echo cluster's specs are thin exactly where its hacks live; pinning first is what made the big deletions safe last time.
