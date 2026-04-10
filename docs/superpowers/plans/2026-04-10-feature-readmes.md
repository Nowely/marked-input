# Feature READMEs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a README.md to every feature directory in `packages/core/src/features/` that currently lacks one, and fix the outdated `events/README.md`.

**Architecture:** Each README follows a consistent template matching the style of the existing `caret/README.md` — concise, with a title, one-line description, Components/Exports section, and a brief Usage snippet. The `store/README.md` also needs updating (references `Store.create(props)` which no longer exists). The `parsing/` feature already has comprehensive READMEs and is left as-is.

**Tech Stack:** Markdown documentation files

---

## README Template

Every new README must follow this structure (matching `caret/README.md` style):

```markdown
# [Feature Name] Feature

[1-2 sentence description of what the feature does and why it exists]

## Components

- **ClassName/functionName**: [Brief description]
- **ClassName/functionName**: [Brief description] (if multiple exports)

## Usage

[Short code example showing import and basic usage, if applicable]
```

**Rules:**
- Keep each README under 50 lines
- No placeholders — every section must have real content
- Import paths use `@markput/core` or relative paths as appropriate
- Code examples must reference actual exports from the feature's `index.ts`

---

## Current State

| Feature | Has README? | Action Needed |
|---------|-------------|---------------|
| arrownav | No | Create |
| block-editing | No | Create |
| caret | Yes | None (good) |
| clipboard | No | Create |
| drag | No | Create |
| editable | No | Create |
| editing | No | Create |
| events | Yes (outdated) | Update |
| focus | No | Create |
| input | No | Create |
| lifecycle | No | Create |
| mark | No | Create |
| navigation | No | Create |
| overlay | No | Create |
| parsing | Yes (3 READMEs) | None (comprehensive) |
| selection | No | Create |
| slots | No | Create |
| store | Yes (slightly outdated) | Update |

**Total: 14 new READMEs + 2 updates = 16 files**

---

### Task 1: Create arrownav/README.md

**Files:**
- Create: `packages/core/src/features/arrownav/README.md`

- [ ] **Step 1: Create README**

```markdown
# ArrowNav Feature

Handles left/right arrow key navigation between text spans and marks in non-drag mode. When the caret reaches the boundary of a text span, it shifts focus to the previous/next focusable element, skipping non-editable marks.

## Components

- **ArrowNavFeature**: Feature class that listens for `keydown` events and manages arrow-left/arrow-right navigation, plus delegates Ctrl+A / Cmd+A to `selectAllText`

## Usage

The feature is automatically registered and enabled by the Store. It activates only when drag mode is off (`store.state.drag()` is false). No direct usage is needed — it hooks into the editor's event system internally.
```

- [ ] **Step 2: Verify file was created**

Run: `ls packages/core/src/features/arrownav/README.md`
Expected: file exists

---

### Task 2: Create block-editing/README.md

**Files:**
- Create: `packages/core/src/features/block-editing/README.md`

- [ ] **Step 1: Create README**

```markdown
# Block Editing Feature

Provides full editing support in drag/block mode where each token is rendered as a separate block-level element. Handles keyboard input, cursor positioning, text insertion, deletion, and merging of blocks — all with raw-value position mapping.

## Components

- **BlockEditFeature**: Feature class that handles arrow key navigation between blocks, Backspace/Delete to merge or delete blocks, Enter to split blocks, and BeforeInput events in block mode
- **getCaretRawPosInBlock**: Gets the caret's absolute raw-value position within a block
- **getDomRawPos**: Converts a raw-value position to a DOM position within a block
- **getDomRawPosInMark**: Converts a raw-value position to a DOM position within a nested mark
- **setCaretAtRawPos**: Sets the caret at an absolute raw-value position in a block

## Usage

The feature is registered by the Store and activates when drag mode is enabled. Raw position utilities are used internally for mapping between DOM cursor positions and raw-value offsets.
```

- [ ] **Step 2: Verify file was created**

Run: `ls packages/core/src/features/block-editing/README.md`
Expected: file exists

---

### Task 3: Create clipboard/README.md

**Files:**
- Create: `packages/core/src/features/clipboard/README.md`

- [ ] **Step 1: Create README**

```markdown
# Clipboard Feature

Provides copy, cut, and paste operations with rich markup support. On copy, writes three MIME types to the clipboard (`text/plain`, `text/html`, `application/x-markput`) to preserve markup fidelity on internal paste.

## Components

- **CopyFeature**: Feature class handling `copy` and `cut` events — serializes selected tokens to markup/plain/HTML and writes to clipboard; on cut, also deletes the selected tokens
- **captureMarkupPaste**: Captures markput MIME data from a ClipboardEvent
- **consumeMarkupPaste**: Reads and clears captured markput paste data for a container
- **clearMarkupPaste**: Clears captured markput paste data without reading
- **selectionToTokens**: Maps a browser Selection to the subset of tokens it covers, returning boundary offsets

## Usage

```typescript
import {selectionToTokens} from '@markput/core'

const range = selectionToTokens(tokens, selection)
// range: { startToken, endToken, startOffset, endOffset }
```

The `CopyFeature` is registered by the Store automatically. The custom MIME type (`application/x-markput`) preserves full markup syntax on internal copy/paste operations.
```

- [ ] **Step 2: Verify file was created**

Run: `ls packages/core/src/features/clipboard/README.md`
Expected: file exists

---

### Task 4: Create drag/README.md

**Files:**
- Create: `packages/core/src/features/drag/README.md`

- [ ] **Step 1: Create README**

```markdown
# Drag Feature

Manages the drag-and-drop block editing mode where each row/token is rendered as a separate draggable block. Subscribes to drag action events and dispatches operations like reorder, add, delete, duplicate, and merge.

## Components

- **DragFeature**: Feature class that subscribes to `store.event.dragAction` and dispatches drag operations
- **getAlwaysShowHandleDrag**: Extracts `alwaysShowHandle` from drag configuration
- **EMPTY_TEXT_TOKEN**: Constant used as placeholder when no rows exist

## Operations (internal)

The feature uses pure functions from `operations.ts` for manipulating the raw value: `reorderDragRows`, `addDragRow`, `deleteDragRow`, `duplicateDragRow`, `mergeDragRows`, `canMergeRows`, `getMergeDragRowJoinPos`.

## Usage

The feature is registered by the Store and activates when drag mode is enabled. Drag actions are dispatched via `store.event.dragAction`.
```

- [ ] **Step 2: Verify file was created**

Run: `ls packages/core/src/features/drag/README.md`
Expected: file exists

---

### Task 5: Create editable/README.md

**Files:**
- Create: `packages/core/src/features/editable/README.md`

- [ ] **Step 1: Create README**

```markdown
# Editable Feature

Keeps the DOM in sync with token state by managing `contentEditable` attributes and `textContent` on rendered elements. Reacts to `readOnly` changes, selection state, and sync events.

## Components

- **ContentEditableFeature**: Reactive feature that sets `contentEditable` on text spans (non-drag) or text/mark rows (drag mode), and syncs `textContent` for all text spans including deeply nested marks
- **isTextTokenSpan**: Identifies bare `<span>` elements representing text tokens (no attributes or only `contenteditable`)

## Usage

The feature is registered by the Store and runs automatically on state changes. `isTextTokenSpan` is used internally by other features to identify editable text spans.
```

- [ ] **Step 2: Verify file was created**

Run: `ls packages/core/src/features/editable/README.md`
Expected: file exists

---

### Task 6: Create editing/README.md

**Files:**
- Create: `packages/core/src/features/editing/README.md`

- [ ] **Step 1: Create README**

```markdown
# Editing Feature

Provides shared text editing utilities used by other features: creating new block rows, replacing trigger text with annotated markup, and deleting mark tokens.

## Components

- **createRowContent**: Generates the raw string content for a new block row by annotating the first option's markup with empty values
- **createNewSpan**: Replaces a matched trigger in a text span with an annotated markup string
- **deleteMark**: Removes a mark token and its surrounding text spans, merging adjacent text spans, updating token state, and scheduling focus recovery

## Usage

```typescript
import {createRowContent} from '@markput/core'

const content = createRowContent(options)
// Returns annotated markup string for a new empty row
```

These utilities are used internally by InputFeature, BlockEditFeature, and SystemListenerFeature.
```

- [ ] **Step 2: Verify file was created**

Run: `ls packages/core/src/features/editing/README.md`
Expected: file exists

---

### Task 7: Update events/README.md

**Files:**
- Modify: `packages/core/src/features/events/README.md`

- [ ] **Step 1: Rewrite README with accurate content**

The current README references `EventBus`, `EventKey`, and `Symbol`-based events which no longer exist. Replace with accurate content about `SystemListenerFeature`.

```markdown
# Events Feature

Central event wiring that connects store events to data flow. Handles change detection, token deletion, overlay selection, inner value updates, and re-parsing.

## Components

- **SystemListenerFeature**: Feature class that subscribes to store events and orchestrates data flow:
  - **change event** — syncs DOM content back to token state, calls `onChange`, and triggers re-parse
  - **delete event** — removes a token by position from the raw value
  - **innerValue signal** — re-parses the new value into tokens and calls `onChange`
  - **select event** — handles overlay selection by creating annotated markup and replacing trigger text

## Usage

The feature is registered by the Store and runs automatically. It acts as the bridge between raw DOM events and the reactive store state.
```

- [ ] **Step 2: Verify file content is accurate**

Read the file and confirm it no longer references `EventBus`, `EventKey`, or `Symbol`.

---

### Task 8: Create focus/README.md

**Files:**
- Create: `packages/core/src/features/focus/README.md`

- [ ] **Step 1: Create README**

```markdown
# Focus Feature

Manages focus tracking and recovery within the editor. Tracks the currently focused element, restores focus/caret position after re-renders, and handles auto-focus when the editor is empty.

## Components

- **FocusFeature**: Feature class that:
  - Listens for `focusin`/`focusout`/`click` events on the container
  - Subscribes to `recoverFocus` events and restores focus/caret from recovery descriptors (handles stale DOM nodes, next/prev navigation, child index offset)
  - Subscribes to `afterTokensRendered` to trigger sync and focus recovery when a Mark is active
  - Auto-focuses the first child on click when the editor is empty

## Usage

The feature is registered by the Store automatically. Focus recovery is triggered by other features through `store.event.recoverFocus`.
```

- [ ] **Step 2: Verify file was created**

Run: `ls packages/core/src/features/focus/README.md`
Expected: file exists

---

### Task 9: Create input/README.md

**Files:**
- Create: `packages/core/src/features/input/README.md`

- [ ] **Step 1: Create README**

```markdown
# Input Feature

Core input handling for the contentEditable editor in non-drag mode. Attaches `keydown`, `paste`, and `beforeinput` handlers and processes text editing operations including mark deletion, span input, and paste with markup preservation.

## Components

- **InputFeature**: Feature class handling Backspace/Delete on marks and span boundaries, BeforeInput events (insertText, deleteContent*, insertFromPaste, insertReplacementText), paste with markput custom MIME support, and select-all replacement
- **handleBeforeInput**: Processes `beforeinput` events for text insertion and deletion
- **handlePaste**: Handles paste events with markput MIME support
- **replaceAllContentWith**: Replaces entire editor content and schedules focus recovery
- **applySpanInput**: Generic span content mutation for various `inputType` values

## Usage

The feature is registered by the Store and activates in non-drag mode. Exported helper functions are used by BlockEditFeature for drag-mode editing.
```

- [ ] **Step 2: Verify file was created**

Run: `ls packages/core/src/features/input/README.md`
Expected: file exists

---

### Task 10: Create lifecycle/README.md

**Files:**
- Create: `packages/core/src/features/lifecycle/README.md`

- [ ] **Step 1: Create README**

```markdown
# Lifecycle Feature

Orchestrates the enable/disable lifecycle of all features. Watches store events to enable features on first update and disable all features on unmount, with guards against double-enable/disable.

## Components

- **Lifecycle**: Class that manages feature lifecycle:
  - Watches `store.event.updated` to enable all registered features on first update
  - Watches `store.event.unmounted` to disable all features on unmount
  - `enable()` — enables all features in `store.features`
  - `disable()` — disables all features
  - Internal flags guard against double-enable/disable

## Usage

The Lifecycle instance is created by the Store and manages all feature lifecycles automatically. No direct interaction is needed from other features or framework wrappers.
```

- [ ] **Step 2: Verify file was created**

Run: `ls packages/core/src/features/lifecycle/README.md`
Expected: file exists

---

### Task 11: Create mark/README.md

**Files:**
- Create: `packages/core/src/features/mark/README.md`

- [ ] **Step 1: Create README**

```markdown
# Mark Feature

Provides the API for framework-level mark components to interact with their token. `MarkHandler` is instantiated by React/Vue wrappers to expose reactive getters/setters for mark token properties.

## Components

- **MarkHandler**: Class instantiated per mark component with reactive access to `content`, `value`, `meta`, `slot`, `readOnly`, plus computed `depth`, `hasChildren`, `parent`, `tokens`. Methods:
  - `change({content, value?, meta?})` — batch update multiple fields and emit change event
  - `remove()` — delete the mark from the value
- **MarkOptions**: Configuration type (`controlled` flag for controlled mode)
- **RefAccessor**: Generic interface for framework ref objects (`{ current: T | null }`)

## Usage

```typescript
import {MarkHandler} from '@markput/core'

// Used internally by framework wrappers:
const handler = new MarkHandler(refAccessor, store)
handler.change({content: 'new content', value: 'new value'})
```

Framework users interact with marks through React/Vue wrapper components, not directly with `MarkHandler`.
```

- [ ] **Step 2: Verify file was created**

Run: `ls packages/core/src/features/mark/README.md`
Expected: file exists

---

### Task 12: Create navigation/README.md

**Files:**
- Create: `packages/core/src/features/navigation/README.md`

- [ ] **Step 1: Create README**

```markdown
# Navigation Feature

Provides focus navigation between editor elements. Walks forward or backward from the current element to find the nearest focusable element, skipping non-editable marks.

## Components

- **shiftFocusPrev**: On left arrow, walks backward from the current element to find the nearest focusable element and focuses it with caret at the end
- **shiftFocusNext**: On right arrow, walks forward from the current element to find the nearest focusable element and focuses it with caret at the beginning

## Usage

```typescript
import {shiftFocusNext, shiftFocusPrev} from '@markput/core'

// Move focus to next focusable element
shiftFocusNext(currentElement, container)

// Move focus to previous focusable element
shiftFocusPrev(currentElement, container)
```

Used by `ArrowNavFeature` and `FocusFeature` for keyboard navigation and focus recovery.
```

- [ ] **Step 2: Verify file was created**

Run: `ls packages/core/src/features/navigation/README.md`
Expected: file exists

---

### Task 13: Create overlay/README.md

**Files:**
- Create: `packages/core/src/features/overlay/README.md`

- [ ] **Step 1: Create README**

```markdown
# Overlay Feature

Manages the autocomplete/suggestion overlay. Detects overlay triggers using `TriggerFinder`, manages the overlay open/close lifecycle, and provides utilities for filtering suggestions and keyboard navigation.

## Components

- **OverlayFeature**: Reactive feature that checks for overlay triggers on text/selection changes, manages overlay open/close (Escape key, outside click), and tracks the input span for overlay operations
- **createMarkFromOverlay**: Creates a `MarkToken` from an `OverlayMatch` result
- **filterSuggestions**: Filters a string array by case-insensitive substring match
- **navigateSuggestions**: Keyboard navigation (up/down/enter) through suggestion lists with wrap-around

## Usage

```typescript
import {filterSuggestions, navigateSuggestions} from '@markput/core'

const filtered = filterSuggestions(['Apple', 'Banana', 'Cherry'], 'ap')
// Returns: ['Apple']

const result = navigateSuggestions(action, {index: 0, total: 3})
// Returns: {index: 1} for 'next' action
```

The `OverlayFeature` is registered by the Store. It uses `TriggerFinder` from the caret feature for trigger detection.
```

- [ ] **Step 2: Verify file was created**

Run: `ls packages/core/src/features/overlay/README.md`
Expected: file exists

---

### Task 14: Create selection/README.md

**Files:**
- Create: `packages/core/src/features/selection/README.md`

- [ ] **Step 1: Create README**

```markdown
# Selection Feature

Manages text selection state, particularly cross-element drag selection across multiple contentEditable elements. Detects when a selection spans multiple spans and temporarily disables `contentEditable` to allow coherent browser selection rendering.

## Components

- **TextSelectionFeature**: Feature class that detects cross-element drag selection (mousedown + mousemove) and sets `store.state.selecting('drag')` to trigger ContentEditableFeature adjustments
- **isFullSelection**: Checks if the current browser selection covers content within the container
- **selectAllText**: Implements Ctrl+A / Cmd+A to select all content in the container (non-drag mode only)

## Usage

The feature is registered by the Store automatically. `selectAllText` is also called by `ArrowNavFeature` for Ctrl+A handling.
```

- [ ] **Step 2: Verify file was created**

Run: `ls packages/core/src/features/selection/README.md`
Expected: file exists

---

### Task 15: Create slots/README.md

**Files:**
- Create: `packages/core/src/features/slots/README.md`

- [ ] **Step 1: Create README**

```markdown
# Slots Feature

Implements the component slot/customization system that allows framework wrappers to override default HTML elements (container, block, span, overlay, mark) with custom components.

## Components

- **createSlots**: Factory function that creates slot objects for `container`, `block`, `span`, `overlay`, and `mark`. Each slot has `use()` (reactive) and `get()` (non-reactive) methods returning `[Component, props]` tuples
- **resolveSlot**: Resolves a named slot to its component (defaulting to `'div'` or `'span'`)
- **resolveSlotProps**: Resolves named slot props with data-attribute conversion
- **resolveMarkSlot**: Resolves the mark component for a given token (text → Span, mark → option's Mark or global Mark)
- **resolveOverlaySlot**: Resolves the overlay component from option/global/default
- **resolveOptionSlot**: Resolves slot prop configs that can be either an object or a function `(baseProps) => props`

## Usage

```typescript
import {createSlots} from '@markput/core'

const slots = createSlots(options, store)
const [Container, containerProps] = slots.container.use()
```

Slots are created by the Store and consumed by framework wrappers (React/Vue) to render customizable components.
```

- [ ] **Step 2: Verify file was created**

Run: `ls packages/core/src/features/slots/README.md`
Expected: file exists

---

### Task 16: Update store/README.md

**Files:**
- Modify: `packages/core/src/features/store/README.md`

- [ ] **Step 1: Rewrite README with accurate content**

The current README references `Store.create(props)` which doesn't match the current API. Update to reflect the actual Store architecture.

```markdown
# Store Feature

The central orchestrator of the markput system. Aggregates reactive state, computed values, events, DOM refs, node proxies, features, lifecycle, slots, and supporting classes.

## Components

- **Store**: Main state container that manages:
  - **Reactive state** (`store.state`) — 20+ signals for tokens, value, selection, overlay, options, readOnly, callbacks, styling, slots
  - **Computed** (`store.computed`) — derived values: `hasMark`, `parser`, `containerClass`, `containerStyle`
  - **Events** (`store.event`) — 12 typed events: change, parse, delete, select, clearOverlay, checkOverlay, sync, recoverFocus, dragAction, updated, afterTokensRendered, unmounted
  - **DOM refs** (`store.refs`) — container and overlay HTMLElement references
  - **Node proxies** (`store.nodes`) — `focus` and `input` NodeProxy instances
  - **Features** (`store.features`) — all feature instances
  - **Lifecycle** (`store.lifecycle`) — feature enable/disable manager
  - **Slots** (`store.slot`) — component customization system
  - **`setState()`** — batch-update method for multiple state signals

## Usage

```typescript
import {Store} from '@markput/core'

const store = new Store(options)
store.setState({value: 'Hello @[world](test)', readOnly: false})
```

The Store is created by framework wrappers and passed to all features. Features communicate exclusively through `store.state`, `store.event`, and `store.nodes`.
```

- [ ] **Step 2: Verify file content is accurate**

Read the file and confirm it no longer references `Store.create(props)` or `EventBus`.

---

### Task 17: Final verification

- [ ] **Step 1: Verify all features have READMEs**

Run: `for dir in packages/core/src/features/*/; do echo "$(basename "$dir"): $(ls "$dir"README.md 2>/dev/null && echo 'YES' || echo 'NO')"; done`
Expected: All 18 features show YES

- [ ] **Step 2: Commit all READMEs**

```bash
git add packages/core/src/features/*/README.md
git commit -m "docs(core): add README to all feature directories"
```
