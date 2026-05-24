# Core Audit — Open Issues

Date: 2026-05-23
Scope: `packages/core/src/**` and adapter wiring.

Seven open issues against the current `next` branch, plus five deferred
items with documented rationale. Verified by re-reading each cited file
and running `pnpm test` (972 passed).

## Open

### 1. `createRowContent([])` crashes

`packages/core/src/features/block/createRowContent.ts:5`

```ts
const firstOption = options[0]
if (!firstOption.markup) return '\n' // throws on options=[]
```

Fix: `if (!firstOption?.markup) return '\n'`.

Callers: `BlockController#add` and `keyboard/blockEdit.ts` Enter handler.
Block-layout editor with explicit `options={[]}` crashes on add-row or
Enter.
Risk: safe.

### 2. Block keyboard infers rows from DOM child order

`packages/core/src/features/keyboard/blockEdit.ts:53, 158, 209, 243, 281`

Every block branch (delete, Enter, arrow nav, block beforeinput) does:

```ts
htmlChildren(container).findIndex(
    div => div === document.activeElement || div.contains(document.activeElement)
)
```

then indexes `store.tokens.current()` by that position. Row-edge checks
also use `caretDom.getCaretIndex(blockDiv)` against
`blockDiv.textContent.length`.

`store.dom` already exposes typed `locateNode(node)` (with reasons
`'control'`, `'outsideEditor'`, `'notIndexed'`), `pathElementsFor(address)`,
and `roleFor(element)` — none used here. Focus inside a
`controlFor`-registered element, drag handle, or custom block chrome is
silently treated as row text editing.

Fix: add a row locator to `store.dom` (or expose `locateNode`'s
`rowElement`) and route all five branches through it. Controls and
ambiguous DOM return a typed failure, not a row index.
Risk: behavior-change (small) — handlers stop firing on ambiguous focus,
which is the point.

### 3. Container listeners are one-shot

Features capture `store.dom.container()` once inside
`lifecycle.onMounted(...)` and bail when it's null:

- `features/keyboard/input.ts:17`
- `features/keyboard/blockEdit.ts:21`
- `features/keyboard/arrowNav.ts`
- `features/clipboard/ClipboardController.ts:17`
- `features/selection/SelectionController.ts:87`

`dom.container` is a signal. If `slots.container` swaps the host element
or it appears late, listeners stay bound to the old element or never
attach.

Fix: a shared `listenToContainer(store, setup)` that watches
`dom.container`, disposes the previous binding, and rebinds.
Risk: behavior-change (small) — only matters when the container changes
after mount.

### 4. Overlay ships a fake `MarkToken`

`features/overlay/createMarkFromOverlay.ts` builds a `MarkToken` with
empty `children`, fabricated `descriptor` (`segments: []`,
`gapTypes: []`, `hasSlot: false`, `index: 0`), and the `OverlayMatch`
position. Consumed by React and Vue `useOverlay` hooks to feed
`OverlayController.select`. The controller only reads `value`, `meta`,
and (text branch) `content` (`overlay/OverlayController.ts:98-118`).

Misleading payload type, dead public export.

Fix: change `select` to
`event<{value: string; meta?: string; match: OverlayMatch}>()`, delete
`createMarkFromOverlay`, drop the `packages/core/index.ts` re-export,
update both `useOverlay` hooks.
Risk: behavior-change (small, internal API).

### 5. Overlay trigger probing reads global selection

`features/overlay/OverlayController.ts:56` — `watch(value.current)` →
`#probeTrigger()` doesn't check whether the current selection belongs to
this editor.

`features/overlay/TriggerFinder.ts:23-25` reads `window.getSelection()`
in the constructor with no container scope.

The `selectionchange` effect at line 84 gates properly on
`container?.contains(document.activeElement)` — the value watcher and
`TriggerFinder` do not. Multi-editor pages: a value change in one editor
can latch overlay state onto a selection in another.

Fix: pass the container into `TriggerFinder.find`, reject selections
outside it, and add the same `contains(activeElement)` check inside the
`value.current` watcher.
Risk: behavior-change (small).

### 6. `PropsModel.set` accepts inherited keys

`features/state/PropsModel.ts:48-52`:

```ts
for (const key of Object.keys(values) as (keyof typeof this)[]) {
    if (!(key in this)) continue
    ;(this[key] as (v: unknown) => void)(values[key] as never)
}
```

`'set' in this` is true (it's a method); same for `constructor`,
`toString`, etc. Compile-time `Partial<SignalValues<typeof this>>` keeps
typed callers safe; runtime input is broader.

Fix: replace `key in this` with a static `Set<string>` whitelist of own
prop signal keys. Optionally verify the resolved value is a function
before invoking.
Risk: behavior-change (small) — silently drops non-signal keys instead of
executing them.

### 7. Stale feature READMEs

- `features/clipboard/README.md:7-10` — references `CopyFeature` (renamed
 `ClipboardController`) and `clearMarkupPaste` (deleted).
- `features/dom/README.md:3, 7, 18` — references `CaretModel` and
 `../caret/README.md` (don't exist), `dom.diagnostics` events (not exposed
 by current `DomModel`), and `splitsSurrogatePair` as an export from
 `textOffsets.ts` (now internal).
- `features/slots/README.md`, `features/parsing/parser/README.md` —
 partial drift; need a re-skim.

Fix: refresh in the same PR as the behavior changes above.
Risk: safe.

## Deferred

Real but intentionally out of scope. Restated here so this doc is the
single source of truth.

- **`features/parsing/preparsing/`** — `findGap` / `getClosestIndexes`
 have no non-spec consumers. Kept in tree per the May 14 cleanup plan.
- **`Parser` static + transform/escape API** — `Parser.parse`,
 `Parser.stringify`, `parser.transform`, `parser.escape`,
 `parser.unescape` are spec-only; `processTokensWithCallback` backs
 `transform` and `denote`. Public surface held stable.
- **`DomBoundaryHost` / `DomIndexerHost`** — single-implementer
 interfaces on `DomModel`. Merge worth its own plan; wider blast radius.
- **`Lifecycle.onMounted` orchestration** — collapsing to a flat watch
 chain requires turning `mounted`/`unmounted` from events into a boolean
 signal, which touches every framework adapter.
- **`TokenModel.#parser` computed** — had a separate plan
 (`docs/superpowers/plans/2026-05-14-tokenmodel-cleanup.md`) that's no
 longer in tree. Worth re-checking before opening a new plan.
