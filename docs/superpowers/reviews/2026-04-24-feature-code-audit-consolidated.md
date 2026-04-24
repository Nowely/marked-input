# Consolidated Feature Code Audit: Store Entrypoint

Date: 2026-04-24
Scope: `packages/core/src/store/Store.ts`, all core feature modules, and selected React/Vue integration points that affect feature behavior.
Sources:

- `docs/superpowers/reviews/2026-04-24-feature-code-audit.md`
- `docs/superpowers/reviews/2026-04-24-feature-code-audit-round-2.md`

## Review Status

This document consolidates two review passes. The second pass used one search subagent and one verification subagent. The verifier re-checked the first audit and all new candidate findings against source code. No finding was rejected. Findings marked "verified with nuance" are real issues, but the exact severity depends on whether the intended contract is public API behavior or UI-only behavior.

No production source code was changed by these audits.

## Executive Summary

`Store` itself is simple and mostly not the problem. The risky part is the implicit contract between:

- serialized value state
- mutable token objects and token positions
- DOM child indexes
- caret recovery anchors
- block-mode wrappers
- framework render timing

The current feature split has good intent, but many features still compute raw string edits, DOM locations, controlled/uncontrolled behavior, and caret recovery independently. That makes the system harder to reason about than it needs to be.

The main simplification direction is clear: centralize value mutations, centralize DOM/token location, and make row-editing a neutral editing concern instead of a drag concern.

## Priority Map

1. High: `MarkHandler` edits can leave token positions stale, then removal can slice the wrong range.
2. High: DOM/token mapping is fragmented and fragile across `NodeProxy`, DOM reconciliation, block raw-position helpers, and caret recovery.
3. High: Container-bound listeners bind once and do not follow `slots.container` changes.
4. High: Overlay caret recovery ignores per-option `Mark` and is gated by global `Mark`.
5. Medium: Full-value edit logic is scattered across features.
6. Medium: Drag and block row operations expose unchecked raw indexes and are owned by the wrong feature.
7. Medium: `createRowContent([])` can crash.
8. Medium: Overlay trigger probing can use global selection outside the editor.
9. Medium: Public APIs and adapter boundaries are loose: `mark.remove`, `MarkHandler.content`, `PropsFeature.set`, React render-time prop sync.
10. Low: Initial parsing is duplicated.
11. Low: Feature docs are stale and editor-shell tests are much thinner than parser tests.

## Findings

### High: `MarkHandler` edits leave stale token positions

Verification: confirmed with nuance.

`MarkHandler` mutates token fields in place and emits `value.change()`:

- `packages/core/src/features/mark/MarkHandler.ts:33`
- `packages/core/src/features/mark/MarkHandler.ts:42`
- `packages/core/src/features/mark/MarkHandler.ts:51`
- `packages/core/src/features/mark/MarkHandler.ts:80`
- `packages/core/src/features/mark/MarkHandler.ts:91`

When focus is not editable, `ValueFeature` serializes tokens but does not reparse them:

- `packages/core/src/features/value/ValueFeature.ts:30`
- `packages/core/src/features/value/ValueFeature.ts:32`
- `packages/core/src/features/value/ValueFeature.ts:38`
- `packages/core/src/features/value/ValueFeature.ts:39`

`MarkFeature.remove` later slices by cached token positions:

- `packages/core/src/features/mark/MarkFeature.ts:38`
- `packages/core/src/features/mark/MarkFeature.ts:39`

Impact: changing mark value or meta to a different serialized length can make later removal delete the wrong substring.

Recommendation: reparse accepted value after public mark mutations, or make removal identity-based by rebuilding the token tree/string while omitting the target token.

### High: DOM/token mapping is fragile and duplicated

Verification: confirmed.

`NodeProxy` maps inline DOM identity by child-index parity:

- `packages/core/src/shared/classes/NodeProxy.ts:25`
- `packages/core/src/shared/classes/NodeProxy.ts:29`

Missing or unsupported targets return `-1`, which makes `isMark` true because `-1 % 2 !== 0`:

- `packages/core/src/shared/classes/NodeProxy.ts:51`

Callers then consume the index as if it were valid:

- `packages/core/src/features/value/ValueFeature.ts:43`
- `packages/core/src/features/overlay/OverlayFeature.ts:112`
- `packages/core/src/features/editing/utils/deleteMark.ts:16`

Block DOM reconciliation depends on child offsets and `data-testid`:

- `packages/core/src/features/dom/DomFeature.ts:123`
- `packages/core/src/features/dom/DomFeature.ts:124`
- `packages/core/src/features/dom/DomFeature.ts:125`
- `packages/core/src/features/dom/DomFeature.ts:133`

Block raw-position mapping also interprets local DOM offsets as token character offsets:

- `packages/core/src/features/keyboard/rawPosition.ts:58`
- `packages/core/src/features/keyboard/rawPosition.ts:68`
- `packages/core/src/features/keyboard/blockEdit.ts:364`
- `packages/core/src/features/keyboard/blockEdit.ts:385`
- `packages/core/src/features/keyboard/blockEdit.ts:404`

Impact: custom marks, nested focusable elements, wrappers, or block slot changes can break editing and caret behavior.

Recommendation: add one checked DOM/token locator, for example:

```ts
type LocatedToken = {
  mode: 'inline' | 'block'
  index: number
  token: Token
  element: HTMLElement
}
```

Features should consume this locator instead of parity checks, unchecked child indexes, or local `findIndex(div => ...)` loops. Use explicit structural attributes such as `data-markput-block`, `data-markput-token`, and `data-markput-text` instead of `data-testid`.

### High: Container-bound listeners are one-shot

Verification: confirmed.

Interactive features capture `store.slots.container()` only during enable:

- `packages/core/src/features/keyboard/input.ts:10`
- `packages/core/src/features/keyboard/arrowNav.ts:7`
- `packages/core/src/features/keyboard/blockEdit.ts:17`
- `packages/core/src/features/caret/focus.ts:5`
- `packages/core/src/features/clipboard/ClipboardFeature.ts:41`

Features are enabled on mount:

- `packages/core/src/store/Store.ts:58`

But `slots.container` is mutable:

- `packages/core/src/features/slots/SlotsFeature.ts:35`

Impact: if the container ref appears late or changes because slots/remounts change, listeners stay attached to the old element or never attach.

Recommendation: add a `listenToContainer(store, setup)` helper that watches `slots.container`, disposes previous listeners, and rebinds to the current element.

### High: Overlay caret recovery ignores per-option `Mark` and global `Mark` gating is too narrow

Verification: confirmed.

Parsing is enabled when a global `Mark` exists or any option has `Mark`:

- `packages/core/src/features/mark/MarkFeature.ts:12`
- `packages/core/src/features/mark/MarkFeature.ts:15`

Overlay recovery checks only the global `Mark`:

- `packages/core/src/features/overlay/OverlayFeature.ts:90`
- `packages/core/src/features/overlay/OverlayFeature.ts:124`

Caret recovery is also skipped entirely when global `Mark` is missing:

- `packages/core/src/features/caret/focus.ts:28`
- `packages/core/src/features/caret/focus.ts:30`

Impact: inserting an annotation for an option-local mark can parse as a mark while recovery follows the plain-text path or never runs, misplacing the caret.

Recommendation: centralize "will this option render as a mark?" and use it in parser setup, slot resolution, overlay recovery, and render-time recovery gating.

### Medium: Full-value edit logic is scattered

Verification: confirmed.

Multiple features compute serialized value edits and caret recovery independently:

- drag: `packages/core/src/features/drag/DragFeature.ts:42`
- inline input/change: `packages/core/src/features/keyboard/input.ts:78`
- inline markup paste: `packages/core/src/features/keyboard/input.ts:151`
- full-selection replace: `packages/core/src/features/keyboard/input.ts:249`
- clipboard cut: `packages/core/src/features/clipboard/ClipboardFeature.ts:65`
- overlay insert: `packages/core/src/features/overlay/OverlayFeature.ts:117`
- mark delete: `packages/core/src/features/editing/utils/deleteMark.ts:32`
- block input: `packages/core/src/features/keyboard/blockEdit.ts:370`
- block paste: `packages/core/src/features/keyboard/blockEdit.ts:391`
- block delete: `packages/core/src/features/keyboard/blockEdit.ts:409`

Impact: controlled/uncontrolled handling, `onChange`, parsing refresh, and caret recovery are repeated and can diverge.

Recommendation: introduce a single `ValueFeature.apply()` style command that owns commit policy and recovery scheduling.

### Medium: Drag and block row editing have unclear ownership and unsafe indexes

Verification: confirmed.

Block keyboard editing imports drag row operations:

- `packages/core/src/features/keyboard/blockEdit.ts:7`
- `packages/core/src/features/keyboard/blockEdit.ts:99`
- `packages/core/src/features/keyboard/blockEdit.ts:102`
- `packages/core/src/features/keyboard/blockEdit.ts:222`

`DragAction` exposes raw indexes:

- `packages/core/src/shared/types.ts:155`
- `packages/core/src/shared/types.ts:159`

Delete and duplicate do not validate indexes:

- `packages/core/src/features/drag/operations.ts:32`
- `packages/core/src/features/drag/operations.ts:35`
- `packages/core/src/features/drag/operations.ts:42`
- `packages/core/src/features/drag/operations.ts:43`

Impact: block editing depends on drag internals, and stale/direct drag actions can crash or corrupt value slicing.

Recommendation: move row operations to a neutral editing module or value command group. Validate indexes at the feature boundary and make pure operations total: invalid inputs return the original value.

### Medium: `createRowContent([])` can crash

Verification: confirmed.

`createRowContent` assumes `options[0]` exists:

- `packages/core/src/features/editing/createRowContent.ts:4`
- `packages/core/src/features/editing/createRowContent.ts:5`
- `packages/core/src/features/editing/createRowContent.ts:6`

Callers include drag add and block Enter:

- `packages/core/src/features/drag/DragFeature.ts:53`
- `packages/core/src/features/keyboard/blockEdit.ts:219`

Impact: a plain-text block editor with empty `options` can crash on add-row or Enter.

Recommendation: make `createRowContent` total:

```ts
const firstOption = options[0]
if (!firstOption?.markup) return '\n'
```

### Medium: Overlay trigger probing can use unrelated global selection

Verification: confirmed with nuance.

On `value.change`, overlay probing does not check whether selection belongs to this editor:

- `packages/core/src/features/overlay/OverlayFeature.ts:41`
- `packages/core/src/features/overlay/OverlayFeature.ts:46`

`TriggerFinder` reads global selection state:

- `packages/core/src/features/caret/TriggerFinder.ts:23`
- `packages/core/src/features/caret/TriggerFinder.ts:24`
- `packages/core/src/features/caret/TriggerFinder.ts:25`

The `selectionchange` path has a container active-element check:

- `packages/core/src/features/overlay/OverlayFeature.ts:75`
- `packages/core/src/features/overlay/OverlayFeature.ts:77`

Impact: multi-editor pages or programmatic mark changes can make overlay state depend on unrelated document selection.

Recommendation: pass a container/focus boundary into `TriggerFinder.find` and reject selections outside that boundary for all trigger sources.

### Medium: Overlay selection manufactures a mostly unused fake token

Verification: confirmed.

Framework overlay hooks build a `MarkToken`, but `OverlayFeature.select` only needs value/meta/content:

- `packages/core/src/features/overlay/OverlayFeature.ts:99`
- `packages/core/src/features/overlay/OverlayFeature.ts:102`
- `packages/core/src/features/overlay/OverlayFeature.ts:103`

The helper fabricates misleading descriptor and position fields:

- `packages/core/src/features/overlay/createMarkFromOverlay.ts:11`
- `packages/core/src/features/overlay/createMarkFromOverlay.ts:14`
- `packages/core/src/features/overlay/createMarkFromOverlay.ts:18`

Recommendation: change overlay select payload to direct data such as `{value: string; meta?: string; match: OverlayMatch}` and delete fake token construction.

### Medium: Mark editing API has confusing fields

Verification: confirmed.

`MarkHandler.content` mutates `token.content` and emits a value change:

- `packages/core/src/features/mark/MarkHandler.ts:29`
- `packages/core/src/features/mark/MarkHandler.ts:33`
- `packages/core/src/features/mark/MarkHandler.ts:91`

Serialization ignores mark `content` and rebuilds from descriptor, value, meta, and slot:

- `packages/core/src/features/parsing/parser/utils/toString.ts:30`
- `packages/core/src/features/parsing/parser/utils/toString.ts:33`

Impact: setting `content` can look like a serialized value edit but not actually change serialized markup.

Recommendation: remove `content` from the public mutation API or document it as display-only. Prefer explicit `value`, `meta`, and `slot` operations.

### Medium: `mark.remove` is typed wider than its name implies

Verification: confirmed with nuance.

The event accepts any `Token`:

- `packages/core/src/features/mark/MarkFeature.ts:25`

Tests remove a text token through `mark.remove`:

- `packages/core/src/features/mark/MarkFeature.spec.ts:35`
- `packages/core/src/features/mark/MarkFeature.spec.ts:41`

Impact: this may be an intentional generic token deletion primitive, but the name says mark removal while behavior is raw-position token removal.

Recommendation: type it as `MarkToken`, hide it behind `MarkHandler.remove()`, or move generic deletion into a clearly named edit/value command.

### Medium: `PropsFeature.set()` is loose at runtime

Verification: confirmed.

`PropsFeature.set()` accepts arbitrary keys, checks `key in this`, and invokes the property as a function:

- `packages/core/src/features/props/PropsFeature.ts:42`
- `packages/core/src/features/props/PropsFeature.ts:46`
- `packages/core/src/features/props/PropsFeature.ts:50`

Impact: compile-time types are good, but runtime input is broader than the intended prop signal map. Because the guard is `key in this`, inherited/prototype keys such as `set` or `constructor` can also pass the existence check and then be invoked as if they were prop signals.

Recommendation: use a literal whitelist of own prop signal keys and ignore everything else.

### Medium: React adapter mutates store props during render

Verification: confirmed.

React `MarkedInput` calls `store.props.set(props)` during component render:

- `packages/react/markput/src/components/MarkedInput.tsx:83`
- `packages/react/markput/src/components/MarkedInput.tsx:84`

Feature watchers can react synchronously after mount:

- `packages/core/src/features/value/ValueFeature.ts:20`
- `packages/core/src/features/parsing/ParseFeature.ts:68`

Impact: this can trigger render-time update warnings and parser/token sync churn from unstable object prop identities.

Recommendation: move prop synchronization into an effect or an explicit external-store bridge. Add equality handling for `options`, `slots`, and `slotProps` if identity churn is common.

### Low: Initial parsing happens twice

Verification: confirmed.

`ValueFeature.enable()` commits and parses initial value:

- `packages/core/src/features/value/ValueFeature.ts:18`
- `packages/core/src/features/value/ValueFeature.ts:78`
- `packages/core/src/features/value/ValueFeature.ts:79`

`ParsingFeature.enable()` immediately syncs and parses again:

- `packages/core/src/features/parsing/ParseFeature.ts:32`
- `packages/core/src/features/parsing/ParseFeature.ts:34`
- `packages/core/src/features/parsing/ParseFeature.ts:46`

Impact: low for short values, but ownership is unclear.

Recommendation: make one feature responsible for initial token write.

### Low: Feature docs and test depth lag behind the code

Verification: confirmed.

Stale docs examples:

- `packages/core/src/features/clipboard/README.md:7`
- `packages/core/src/features/dom/README.md:7`
- `packages/core/src/features/slots/README.md:15`
- `packages/core/src/features/parsing/parser/README.md:19`
- `packages/core/src/features/parsing/parser/README.md:108`

Thin test areas:

- `packages/core/src/features/keyboard/blockEdit.ts`
- `packages/core/src/features/keyboard/rawPosition.ts`
- `packages/core/src/features/drag/operations.ts`
- `packages/core/src/features/overlay/OverlayFeature.ts`
- `packages/core/src/features/editing/createRowContent.ts`

Impact: parser behavior is well characterized, but editor shell behavior is not. Refactors in feature orchestration will be riskier without characterization tests.

Recommendation: add focused tests before changing architecture, then update or delete stale feature READMEs after behavior stabilizes.

## Consolidated Simplification Plan

1. Add characterization tests for the highest-risk behavior.

Start with mark edit then remove, overlay select with option-local `Mark` and no global `Mark`, invalid focus targets, block raw-position mapping, container replacement, and drag invalid indexes.

2. Centralize value mutation.

Add a `ValueFeature.apply()` or equivalent command that handles controlled/uncontrolled mode, `onChange`, parsing refresh, and caret recovery. Keep domain-specific edit computation local, but centralize committing.

3. Introduce a DOM/token locator.

Replace `NodeProxy` parity checks, unchecked child indexes, and duplicated block active-row lookup with a checked locator. Unsupported DOM shapes should return `undefined` instead of pretending index `-1` is a mark.

4. Move row editing out of drag.

Create a neutral row-edit module under editing or value commands. Drag and keyboard should both call it.

5. Rebind listeners when the container changes.

Use a helper that watches `slots.container` and owns listener disposal/rebinding for keyboard, caret focus, clipboard, and block edit.

6. Simplify overlay APIs.

Use a real "mark component resolution" helper for caret recovery and render-time recovery gating, then replace fake overlay tokens with direct select payload data.

7. Tighten public/runtime boundaries.

Clarify `MarkHandler.content`, narrow or rename `mark.remove`, whitelist own `PropsFeature.set` keys, and move React prop sync out of render.

8. Clean stale docs.

After behavior changes land, update feature READMEs and website development docs so they describe the current architecture, not legacy names.

## Test Backlog

- `MarkHandler.value` longer/shorter edits followed by remove preserve surrounding text.
- `MarkHandler.meta` longer/shorter edits followed by remove preserve surrounding text.
- Overlay select places caret correctly with global `Mark`.
- Overlay select places caret correctly with only option-local `Mark`.
- Overlay caret recovery runs when there is no global `Mark` but the selected option has `Mark`.
- Invalid or nested focus target does not crash value change or delete.
- Container ref replacement rebinds keyboard, focus, clipboard, and block edit listeners.
- `createRowContent([])` and `createRowContent([{}])` return newline.
- Drag delete/duplicate/reorder/add handle negative, too-large, and empty-row indexes.
- Block Enter works with `options={[]}`.
- Block insert/paste/delete map wrapped text nodes to the correct raw positions.
- DOM reconciliation does not depend on `data-testid`.
- React `MarkedInput` prop sync does not cause render-time update warnings.
- `PropsFeature.set()` ignores unknown keys, inherited keys, and prototype keys without throwing or invoking non-signal methods.

## Acceptance Criteria For Cleanup

- No feature reads a token by unchecked DOM child index.
- No code path treats `focus.index === -1` as a valid mark.
- All serialized value writes use one mutation command.
- Token positions are refreshed or avoided after public mark mutations.
- Overlay insertion behaves the same with global `Mark` and option-local `Mark`.
- Overlay caret recovery is not gated solely by global `Mark`.
- Container listener rebinding is covered by tests.
- Row operations are owned outside the drag feature and reject invalid indexes.
- Feature READMEs no longer reference legacy names or nonexistent APIs.
