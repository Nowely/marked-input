# Block vs. inline: factual census

Taken 2026-08-22 on branch `b0`, HEAD `e6433bce`, by a read-only survey agent.
Facts and measurements only; line counts are `wc -l`.

## 1. `packages/core/src/features/block/` — 6 source files + 1 spec + 1 README

| File | wc -l | Exports |
| --- | --- | --- |
| `index.ts` | 2 | `BlockController`, `getAlwaysShowHandle`, `BLOCK_MENU_ITEMS` |
| `config.ts` | 4 | `getAlwaysShowHandle(draggable)` |
| `menu.ts` | 12 | `BLOCK_MENU_ITEMS` |
| `operations.ts` | 35 | `addRowUnanchored` (only) |
| `BlockController.ts` | 92 | `BlockController` |
| `BlockStore.ts` | 147 | `BlockStore` |
| `BlockController.spec.ts` | 390 | — (23 tests) |

Total source (excluding spec/README): **292 lines**.

**`BlockController`** (`BlockController.ts`)

- `readonly action = event<DragAction>()` (:9) — the single ingress.
- `#stores = new WeakMap<TreeNode, BlockStore>()` (:25) — per-row UI state
  keyed by the row **node object**, no prune (self-collecting).
- `get(node: TreeNode): BlockStore` (:81-92) — lazily creates a `BlockStore`
  with a live index reader `() => this.tokens.rootIndexOf(node.id) ?? -1`.
- The one `watch` (:31-77) lowers `DragAction` onto **node verbs**, not
  composed strings:
  - `reorder` → `this.tokens.nodes().at(action.source)?.moveTo(to)` (:46),
    gated by `props.draggable()` (:38)
  - `delete` → `rows.at(action.index)?.remove()` (:58)
  - `duplicate` → `rows.at(action.index)?.duplicate()` (:62)
  - `add` (normal) → `rows.at(...)?.insertAfter(this.props.separator())` (:70)
  - `add` (empty tree / negative afterIndex) → `addRowUnanchored(...)` +
    `tokens.setValue(result.value, result.row)` (:74-76)
- Layout guard at :34 — `if (!this.props.layout.isBlock()) return`.

**`DragAction`** verbs, `shared/types.ts:113-117`: `reorder{source,target}`,
`add{afterIndex}`, `delete{index}`, `duplicate{index}`. Four verbs total.

**`BlockStore`** — pure per-row **UI/DOM** state, no tree knowledge:

- `refs.container` (:27-29)
- `state`: `isHovered`, `isDragging`, `dropPosition`, `menuOpen`,
  `menuPosition` (:31-37)
- `attachContainer` / `attachGrip` / `attachMenu` (:53, :67, :77) —
  declarative `wireListeners` (:9-24)
- verbs `closeMenu`, `addBlock`, `deleteBlock`, `duplicateBlock` (:86-89),
  each emitting a `DragAction` through the injected `#action`
- HTML5 drag handlers `#onContainerDragOver/DragLeave/Drop`,
  `#onGripDragStart/DragEnd/Click`, `#onMenuOutsideMouseDown`,
  `#onMenuKeyDown` (:91-142)

**`operations.ts`** holds exactly one function —
`addRowUnanchored(read, rows, afterIndex, separator)` (:21-36). Everything
else (`deleteDragRow`, `mergeDragRows`, `canMergeRows`, `applyDragAction`) is
gone, per the feature README. It never takes a raw value; the doc reaches it
as a `SliceRead = (from, to) => string` backed by `tokens.valueBetween`.

**`menu.ts`** — `BLOCK_MENU_ITEMS` is a 3-item content contract in core
(`Add below`/`Duplicate`/`Delete`) pairing label + icon class string + a
`(store: BlockStore) => void` verb (:9-13). Both adapters map it.

Wired in `store/Store.ts:25` —
`readonly block = new BlockController(this.props, this.tokens)`,
unconditional (there is no "block feature is off" state; the guard is inside
the watch).

Public API re-export: `packages/core/index.ts:32` —
`export {BLOCK_MENU_ITEMS, getAlwaysShowHandle} from './src/features/block'`.
`BlockController`/`BlockStore` types are **not** publicly exported; adapters
reach them via `Store`.

## 2. Every layout-mode guard in `packages/core/src`

**Exactly 6 runtime `isBlock()` call sites** in non-test core code (the rest
of the `isBlock` hits are comments or the type declaration).

| file:line | Guard | What it changes |
| --- | --- | --- |
| `features/state/PropsModel.ts:29-35` | `layout` signal definition | Also the `separator` signal at :41 (default `'\n\n'`, "applied in BLOCK layout only") |
| `features/slots/SlotsFeature.ts:42` | `isBlock() && !!draggable()` | Container gets `paddingLeft: 24` (DRAG_HANDLE_WIDTH) — the grip gutter |
| `features/tokens/tree/valueBoundary.ts:71` | `deps.isBlock?.() === true ? deps.separator?.() : undefined` | **The parse fork**: `separator !== undefined ? parseRowsValue(...) : parseValue(...)` (:73). The only place the row parse is chosen |
| `features/tokens/seam/TokenModel.ts:356` | `isBlock` in the ONE props watch tuple `(value, parser, isBlock, separator)` | A layout flip with an unchanged value routes to `boundary.reparse()` (:362) |
| `features/tokens/seam/TokenModel.ts:568` | `isBlock: () => this.props.layout.isBlock()` fed into `createBoundary` | Wires the above |
| `features/keyboard/input.ts:57` | `handleDeleteKey` early return | Inline-only Backspace/Delete; block's is `blockEdit.handleDelete` |
| `features/keyboard/input.ts:114` | `handleBeforeInput` tail early return | Inline-only beforeinput splice; block's is `handleBlockBeforeInput` |
| `features/block/BlockController.ts:34` | watch gate | All four drag/menu actions |
| `features/keyboard/blockEdit.ts:70` | keydown listener | Block-only Backspace/Delete/Enter |
| `features/keyboard/blockEdit.ts:86` | beforeinput listener (capture) | Block-only beforeinput |

**Notably NOT layout-guarded** (checked): Ctrl+A select-all (`input.ts:47`,
comment at :45-46 "Layout-independent on purpose"), paste (`input.ts:18`,
`:133`), DOM indexing/binding, `TokenHandle`, `SelectionDriver`.
`dom/commit.ts:34` states the old DOM-walk `isBlock` and its frame alignment
are **gone** — replaced by `ElementSource` id-keyed consignment.

### `features/keyboard/blockEdit.ts` — 229 lines (+ spec 418 lines)

Compared with `input.ts` (139 lines) and shared `beforeInput.ts` (192 lines).

**Shares** (imports from `./beforeInput`, blockEdit.ts:8-14):
`anchorsForInput`, `anchorsFromInputEvent`, `dropUnexpressedInput`,
`isConsumerKeyOrigin`, `replacementForInput`. `beforeInput.ts` exports 7
helpers; blockEdit uses 5, input.ts uses 6.

**Duplicates / parallels `input.ts`:**

- A second `keydown` listener on the same container with the same
  `isConsumerKeyOrigin` gate (blockEdit :75 vs input :43) — the comment at
  :71-74 says it is "the same consumer-origin test … and for the same reason".
- A second `beforeinput` capture listener on the same container
  (blockEdit :82-91 vs input :23-30).
- A parallel replacement pipeline: `replacementForInput` → `undefined` →
  `dropUnexpressedInput` → `anchorsForInput` → `edit.replace`
  (`replaceBlockRange` :199-213 vs `handleBeforeInput` tail :116-130). The
  comment at :188-190: "The SAME inputType→replacement table as `input.ts`".
- A parallel Backspace/Delete arm (`handleDelete` :94-125) against
  `input.ts`'s `handleDeleteKey` (:56-81).
- A parallel all-selected arm (`handleEnter` :135-141:
  `tokens.setValue('', 0)`) against `input.ts:90-110`.

**Unique to blockEdit (no inline analogue):**

- `findActiveRow` two-tier row resolution (:48-66), `rowFromAnchor` (:38-46),
  `anchorOwner` (:30-35), `rowHandle` (:21-27) — 46 lines of "which row is
  the caret in".
- `handleEnter` inserting `props.separator()` at the caret (:156-157).
- `mergeOrFocusNeighbor` (:215-229) → `a.mergeWith(b)`.
- `focusRow` (:160-164).
- `insertParagraph` fail-closed drop (:183-186).
- No arrow-key arm — comment :77 "one host makes cross-row caret movement
  native"; `blockEdit.spec.ts:41,57` pin that arrows are left to the browser.

## 3. Rows and separators in the token tree — Row IS a first-class node

Since #291 ("the row separator is structural — block layout cuts over to
RowNodes") and ADR-0009.

**Parser side** (`features/tokens/parser/`):

- `RowToken` — `parser/types.ts:46-59`: `{type:'row', content, position, id?,
  children: Token[], terminated: boolean}`. Docblock :37-45: "A Row is never
  an inline child — `Token` stays `TextToken | MarkToken`".
- `Parser.parseRows(value, separator): RowToken[]` — `Parser.ts:108-116`.
  Throws on empty separator. `Parser.parse` (inline) closes trailing gaps at
  end-of-input with an empty separator list (:79).
- `parser/core/RowBuilder.ts` (185 lines) — the whole row pass:
  `acceptMatches` (:18), `rowPass` to a fixpoint (:36-61), `findSeparators` =
  occurrences outside every accepted match extent (:70-88),
  `closeTrailingGaps` (:100-123), `groupRows` (:135-186). `groupRows`
  guarantees each row's `children` start and end with a text token
  (:168-173) — an empty row carries **one** empty text child, never zero.
- **There is no separator token.** A separator is consumed into the owning
  row's `content`/`position` and surfaces as `RowNode.terminator`.

**Tree side** (`features/tokens/tree/`):

- `RowNode` — `tree/types.ts:58-80`: `kind:'row'`, `id`,
  `children: Signal<readonly TreeNode[]>`, `terminator: string` (plain field,
  `''` only on the document-final row), `position` **including** the trailing
  separator, plus the five structural verbs
  `remove/duplicate/insertAfter/mergeWith/moveTo`.
- `TreeNode = TextNode | MarkNode | RowNode` (`tree/types.ts:50`).
- Projection: `joinNodes` row arm = `joinNodes(children) + node.terminator`
  (`tree/tree.ts:204-207`); `sliceWithin` treats the separator span as plain
  text at `[position.end - terminator.length, position.end)` (:174-185).
- `rootIndexOf(roots, id)` — `tree/tree.ts:124-135`, doc: "the block row
  index".
- **Row-only plan functions in `tree/siblings.ts` (157 lines):** `mergePlan`
  (:16-29, row-only guard at :21 — merging = deleting the first row's
  separator, reparse decides), `removePlan` (:38-45, document-final row
  borrows the previous row's separator), `movePlan` (:62-126, root rotation +
  `Pairing`, with a row-normalization block :85-104), `entryAnchor`
  (:137-157, row arm incl. "row opening with a mark" descent).
- **Adoption** (`tree/adopt.ts`): `parseRowsValue` with a
  `bareParser = new Parser([])` fallback (:34-37 — a paragraph-only block
  editor is legal); row pairing on **kind alone** (:91-95, "a row carries no
  descriptor"); `snapshotNodeEquals` row arm compares `terminator` + children
  (:274-280); `pairEquals` row arm compares **children only**, because a
  reorder legally flips `terminated` (:346-360).
- `anchors.ts:16` — `let owner: MarkNode | RowNode`; :33-35 a row's separator
  span is unanchorable and falls back to the row's own boundary, exactly like
  a slotless mark's interior.
- **DOM**: `DomModel.#entryOf` (:216-228) — a row's boundary descends to its
  edge **child**, because a row's own handle is the block wrapper.
  `bind.ts:146` — `if (node.kind !== 'row') applyMountState(...)`: a row
  wrapper stays **bare** (neither text surface nor mark root), never frozen
  atomic.
- `renderSubscription.ts:17-22` — mark → `[value, meta, children]`; row →
  `children`; text → `undefined`.
- `slots/resolveSlot.ts:72-75` — `resolveMarkSlot` **throws** on a RowNode:
  "A RowNode has no mark slot. Render row.children() instead."

**Block mode consumes it** by: (a) the parse fork at `valueBoundary.ts:71-73`;
(b) `Container` mapping `nodes()` to `<Block>` instead of `<Token>`; (c)
`BlockController` calling row-node verbs; (d) `blockEdit` resolving rows via
`rootIndexOf`.

**Stale documentation found:** three comments still claim block mode filters
empty text tokens — `tree/types.ts:12`, `tree/anchors.ts:39-43`,
`tree/types.ts:147` — plus backlog issue `09-block-gap-caret.md`. No such
filter exists in `valueBoundary.ts`/`adopt.ts`; `groupRows`
(`RowBuilder.ts:168-173`) now *adds* edge text tokens instead. → ticket 07.

## 4. Adapter duplication

Block-specific components, both adapters, 1:1 by name:

| Component | React (lines) | Vue (lines) |
| --- | --- | --- |
| Block | `Block.tsx` — 70 | `Block.vue` — 78 |
| BlockMenu | `BlockMenu.tsx` — 44 | `BlockMenu.vue` — 39 |
| DragHandle | `DragHandle.tsx` — 53 | `DragHandle.vue` — 52 |
| DropIndicator | `DropIndicator.tsx` — 25 | `DropIndicator.vue` — 29 |
| (fork site) Container | `Container.tsx` — 43 | `Container.vue` — 56 |
| (mark path) Token | `Token.tsx` — 94 | `Token.vue` — 88 |

Block-specific total: React **192**, Vue **198**. Whole adapter src: React
748, Vue 768.

**How they reach core state** — identical shape, framework-idiomatic
wrappers:

- React: `useMarkput(s => { const blockStore = s.block.get(node); return
  {blockStore, isDragging: blockStore.state.isDragging, ...} })`
  (`Block.tsx:22-31`, `BlockMenu.tsx:11-20`, `DragHandle.tsx:12-23`,
  `DropIndicator.tsx:9-12`).
- Vue: `const blockStore = store.block.get(props.node)` at setup, then
  `useMarkput(() => blockStore.state.X)` per signal (`Block.vue:18-23`,
  `BlockMenu.vue:13-16`, `DragHandle.vue:13-18`, `DropIndicator.vue:11-13`).

`store.block.get(node).state.*` / `.attach*` — **4 components × 2 frameworks
= 8 call sites**.

**Genuinely duplicated logic (not just markup):**

- `alwaysShowHandle ? SidePanelAlways : isHovered && !isDragging &&
  SidePanelVisible` — `DragHandle.tsx:34` ≡ `DragHandle.vue:39`.
- `draggable={!!draggable}` + aria-label fork — `DragHandle.tsx:44-46` ≡
  `DragHandle.vue:45-47`.
- `opacity: isDragging ? 0.4 : 1` merged with `slotProps.style` —
  `Block.tsx:54` ≡ `Block.vue:25-28`.
- `dropPosition !== position → null` + `{top:-1}/{bottom:-1}` —
  `DropIndicator.tsx:15-22` ≡ `DropIndicator.vue:24-27`.
- The consign-once memo discipline — `Block.tsx:40` ≡ `Block.vue:40`, with
  near-identical comments.
- Layout fork in Container — `Container.tsx:34-39` ≡ `Container.vue:49-54`.
- Chrome registration as control roots: `tokens.control()` refs in BlockMenu,
  DragHandle, DropIndicator on both sides.

**Already deduplicated into core:** `BLOCK_MENU_ITEMS`,
`getAlwaysShowHandle`, `renderSubscription`, `cx`, `styles.module.css` class
names, the gutter padding (`SlotsFeature`).

**One asymmetry:** Vue's `Block.vue` types its prop as plain `TreeNode` and
forks in-template on `node.kind === 'row'` with a `<Token v-else>` fallback
(:55-58, :71-74); React's `Block.tsx` declares a local
`export type BlockRow = Extract<TreeNode, {kind:'row'}>` (:15) and casts in
`Container.tsx:37`. Neither type is exported from core.

**Storybook:** `packages/storybook/src/pages/Drag/` — `Drag.stories.ts`
(100), `Drag.spec.ts` (963), `TodoMark` react/vue fixtures. `layout: 'block'`
also in `renderCount.spec.ts:146,180` and `Clipboard.stories.ts:27`.

## 5. The mark/row facility asymmetry

Mark = `MarkNode` (`tree/types.ts:102-131`), parser-side `MarkToken`. Node
kinds are exactly three: `'text' | 'mark' | 'row'`.

### Facilities a Mark has that a Row does not

| Facility | Where | Row equivalent |
| --- | --- | --- |
| `descriptor: MarkupDescriptor` + `markup: Markup` | `tree/types.ts:105-107` | none — ADR-0009: a paragraph is a Row with no markup, no option, no Mark component |
| `value: Signal<string>`, `meta: Signal<string\|undefined>` | :108-109 | none |
| Slot: `slotRange`, `slot()` | :117, :120 | none |
| `update(patch: MarkPatch)` (`MarkCommands`) | :124, `types.ts:175-177` | none; rows get only the 5 `NodeCommands` |
| Per-option config: `options[descriptor.index]` → `Mark` component + props | `resolveSlot.ts:77-82` | `resolveMarkSlot` throws on a row (:72-75) |
| Consumer hooks `useMark()` / `useMarkInfo()` / `toMarkInfo` | throw if `kind !== 'mark'` | no `useRow`/`useBlock` hook in either adapter |
| Atomicity / editable policy (`ce=false` root, chrome freeze) | `dom/bind.ts:225-291` | skipped: `bind.ts:146` `if (node.kind !== 'row')` |
| Adjacency swallow (`adjacentMark`) for Backspace/Delete | `TokenModel.ts:249` | n/a; blockEdit relies on it being row-safe (:202-204) |
| `TokenChildren` slot-host registration (`tokens.children(ownerId)`) | `Token.tsx:64`, `Token.vue:59` | a Block renders `node.children()` directly — no child-sequence host |
| Overlay targeting (options / `showOverlayOn`) | `features/overlay/` | none |
| Repaint subscription `[value, meta, children]` | `renderSubscription.ts:19` | row gets `children` only (:21) |

### Facilities a Row has that a Mark does not

| Facility | Where |
| --- | --- |
| `terminator: string` (the consumed separator) | `tree/types.ts:69` |
| Per-row UI store `BlockStore` (hover/drag/drop/menu signals) | `BlockStore.ts:31-37`; nothing analogous for marks |
| Drag/drop DOM wiring (`attachContainer`/`attachGrip`/`attachMenu`) | `BlockStore.ts:53,67,77` |
| The grip button + gutter | `DragHandle.tsx/.vue`; gutter at `SlotsFeature.ts:25,42` |
| The 3-item context menu | `block/menu.ts`, `BlockMenu.tsx/.vue` |
| Drop indicator | `DropIndicator.tsx/.vue`, `BlockStore.#onContainerDragOver` |
| A dedicated wrapper slot: `slots.block` / `slotProps.block` | `resolveSlot.ts:12,14-17`; `SlotsFeature.ts:50-53` (`SlotName = 'container' \| 'block'` — no `'mark'` SlotName) |
| `moveTo` actually reachable (`Pairing`-bearing reorder) | `BlockController.ts:46` → `siblings.movePlan` |
| Row-only removal/merge plans | `siblings.ts:16-45` |
| Row-index addressing: `rootIndexOf`, `setValue(text, enterRoot)` | `TokenModel.ts:283, 239` |
| Being the consignment key for the wrapper element | `Block.tsx:40`, `Block.vue:40`; ADR-0009:30-34 |

**Shared by both** (`NodeCommands`, `tree/types.ts:149-165`): `remove`,
`duplicate`, `insertAfter`, `mergeWith`, `moveTo` — plus `id`, `position`,
`range()`, `children: Signal`.

## 6. Docs / ADRs / scratch specs touching block-row unification

**ADRs:** `0009-the-separator-is-structural.md` (the direct one — separator
structural, RowNode the only root kind in block layout, Enter inserts the
separator, merge deletes it, row pairing on kind, pair gate on children;
defers nested rows in slots and inline separator).
`0007-row-identity-travels-with-the-row.md` (a row owns its state;
permutation is a `Pairing`; "core owns row DOM" deferred as a **new decision,
not an oversight**). `0008` is cited by `blockEdit.ts:54-58`.

**`docs/scratch/token-born-edit/spec.md`** (271 lines) — the arc. **G3**
(:25-26): "the Row stops being a stopgap. One model…". G4 (efficiency)
withdrawn (:27-30). Constraint :34-37: frameworks keep the rendering role,
core does not own document DOM. :38-39: breaking changes allowed, "the Row
representation and the public API are all in scope". Its issue 08 (168 lines)
holds the full record of the rejected "mark == row" alternative.

**CONTEXT.md** — Row (:73-77, "carries no Markup"), Separator (:79-83),
Block layout (:69-71), Mark (:19-21), Relationships :99 ("A **Mark** is a
**Token**; a **Row** is **Block layout**'s top-level node") — Row is *not*
currently declared a Token. Flagged ambiguity :110: `slots.block`,
`slotProps.block`, `BlockStore`, `BlockController`, `blockIndex`, `isBlock`
are published/contract names, "none of them is a rename target".

**Open backlog issues touching block/rows:**

- `03-forward-delete-at-row-start.md` — ready-for-agent
- `05-grip-gutter-ignores-draggable-false.md` — ready-for-agent; matches
  `SlotsFeature.ts:42` vs `DragHandle` :27/:44
- `09-block-gap-caret.md` — needs-info; premise stale (→ ticket 07)
- `15-block-row-whose-slot-starts-with-a-mark.md` — ready-for-human; likely
  moot post-ADR-0009 (→ ticket 07)

**Feature README:** `features/block/README.md` — BlockController/BlockStore/
`getAlwaysShowHandle`, the "why node verbs, not a composed document"
argument, and the note that `block/` left ADR-0003's allowlist (which itself
no longer exists).
