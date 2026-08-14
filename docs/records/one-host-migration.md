# One host — the single-contenteditable migration

**Historical record.** Measured 2026-08-11 on branch `b0` (post-#273), Chromium via Playwright with trusted input events, fixtures from committed snapshots; the post-migration addendum is from 2026-08-12. The migration shipped as PR #274. Estimates are labelled as such. The original rendered document is at `git show f384c5e6:docs/adr/0002-one-host-migration.html`.

Migrating markput from **N contenteditable hosts** (one per text token) to **one editing host**, taking the block feature onto tree anchors with it.

10 defect classes measured · 1 new critical, undocumented · 0 ZWSP fillers required · ≈−1300 lines with block (est.).

## Verdict

The N-host layout is not merely awkward at boundaries — **its focus machinery actively fights the mouse today**: clicking from one text span into an adjacent one never places the caret (a stack-proven, previously undocumented defect), Tab is fully dead, and a finished cross-mark drag leaves the whole editor non-editable with focus on `BODY`. None of these states can exist under one host: they all require a focus transition between spans, and one host has no such transition.

The single-host probes came back **cheaper than planned**: caret positions at empty gaps exist natively even _without_ ZWSP fillers (element-anchored), native sweep crosses `ce=false` marks with no flip machinery, and delete over a cross-mark selection is cancelable — guardable into `edit.replace`. The one cost that stays is IME (uncancelable) and undo (dead in both worlds — the editor must own history regardless).

Block comes along by necessity: `findActiveRow` reads `document.activeElement` (5 call sites) and dies under one host, while its cross-row arrow handlers are hand-rolled caret transport that one host makes native. The framing is **one task: one host + block speaks tree anchors** — staged as independently green commits.

## Measured: N hosts today

### Re-measurement of `inconsistencies.md` — proven

The defect page was written against the pre-rewrite tree and never re-measured. Re-measured 2026-08-11 against the live storybook (`MarkedInput/Configured` and `Default`), Chromium, real trusted input events. Verdicts: **6 stand, 3 are worse than documented, 1 changed shape, 1 is new**. The "Works Correctly" table lost an entry.

| #   | Documented defect                                              | Measured now                                                                                                                                                                                                                                                                                                                                                                                       | Verdict                |
| --- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| —   | **Not documented:** click across a mark into the adjacent span | The caret **never moves** — the model re-applies its stored anchors and steals focus back before Chromium places the clicked caret. Reproduced on every attempt, incl. human-like mouse approach. Clicks landing on the _container_ (line gaps) work, because Chromium then places the caret _before_ the focus events. Same mechanism eats triple-click on a non-focused span.                    | NEW · critical         |
| 3   | Undo cannot restore deleted marks                              | Confirmed — and wider: **Cmd+Z is a no-op for every guarded edit including plain typing inside one span**. The doc's "Works Correctly: basic undo within a span ✅" is false post-rewrite (all input is `preventDefault()` + model write, so the native undo stack is empty).                                                                                                                      | worse                  |
| 4   | Cross-mark delete only affects first span                      | Now it affects **nothing**: after a cross-mark sweep the keys go to `BODY` (see #10), so Backspace and typing over the selection are silently dropped.                                                                                                                                                                                                                                             | worse                  |
| 5   | Tab cycles internal elements                                   | Tab is now **fully dead**: focus reaches the mark (`focusin BUTTON` in the trace) and is immediately snapped back to the span by the same steal mechanism. It neither leaves the field nor cycles.                                                                                                                                                                                                 | changed · still broken |
| 6   | Home/End trapped within span                                   | Confirmed: Home → offset 0 of the current span, End → its last offset (`span0`: 0 / 26).                                                                                                                                                                                                                                                                                                           | stands                 |
| 7   | Word navigation stuck at span boundary                         | Confirmed: Alt+ArrowLeft walks 12→10→6→0, then repeats do nothing.                                                                                                                                                                                                                                                                                                                                 | stands                 |
| 8   | Shift+Arrow selection can't cross marks                        | Confirmed, milder detail: selection grows to the span end ("g ") and sticks — no focus jump to the mark (the doc's 3rd-press jump no longer happens).                                                                                                                                                                                                                                              | stands                 |
| 9   | Triple-click selects span, not line                            | Confirmed on the focused span (selects exactly the span). On any _other_ span the triple-click is consumed whole by the click steal (selection doesn't change at all). **[superseded — see the post-migration addendum: the span-boundary reading is wrong. Chromium bounds paragraph selection at any inline `ce=false` atomic (control-measured without markput), so one host does NOT fix it]** | stands+                |
| 10  | Drag selection doesn't cross marks                             | Mid-drag it **works now** — the `ce=false` flip does its job and the highlight crosses the mark. But after mouseup **every host stays `ce=false` and focus is on `BODY`**: the editor is dead until a click collapses the selection (`clearIfCollapsed` never fires on a ranged selection). Select-then-type and select-then-delete are impossible.                                                | new failure mode       |
| 11  | Focus/blur churn on span switch                                | Confirmed: 3 in-editor clicks + 1 outside → **3× focusin, 4× focusout** on the container (the story's `onFocus`/`onBlur` console shows the same churn).                                                                                                                                                                                                                                            | stands                 |
| 12  | Multi-line paste fires onInput ×5                              | Mechanism (`execCommand`) is gone from the tree; single `edit.replace` in a batch. Event count not re-measured — not billed to N hosts.                                                                                                                                                                                                                                                            | likely gone            |

### Anatomy of the click steal — stack-proven

Instrumented run: per-element `focus()` patch + `Selection` method patches with stacks, capture-phase event log. Caret stored at `span2:14`; user clicks into `span1` (" suggestions…"). Timestamps are ms within the interaction.

| t   | actor    | what                                                                                                                                                                      |
| --- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 150 | Chromium | `mousedown` on span1 — DOM selection still the old `span2:14`                                                                                                             |
| 150 | Chromium | `focusout` span2 → `focusin` span1 (focus first; the click's caret would be placed _after_ focus settles)                                                                 |
| 150 | **core** | focusout microtask: `activeElement === BODY` mid-transition → **`selection.clear()`** (`SelectionDriver.ts:252-256`)                                                      |
| 150 | **core** | focusin sync reads the **stale** DOM range (`span2:14`) → `selection.select(old)` — after the clear this is a _change_, so the anchors watch fires (`:242-250`, `:71-74`) |
| 150 | **core** | `#applySelection → placeCaret → focusIfNeeded`: **span2.focus() steals focus back**; `removeAllRanges + addRange(span2:14)` (`caret.ts:142`, `TokenHandle.ts:97`)         |
| 151 | Chromium | `mouseup`; the click's own caret placement in span1 never happens                                                                                                         |
| 151 | Chromium | one coalesced `selectionchange`: final caret `span2:14` — the user's click did nothing                                                                                    |

Every step requires a focus transition between two editing hosts. Under one host, moving the caret between text nodes changes no `activeElement`, fires no focusin/focusout, and the entire chain — clear, stale sync, re-apply, steal — has no trigger. This defect is not fixable by patching: the focusin sync _cannot know_ whether the DOM range it reads is stale, because the browser only reveals the clicked caret after focus settles.

### The dead editor after a finished sweep — proven

```
afterDrag      = { selText: "lickable marked world!", ce: "false,false", active: "BODY" }
Backspace ↓
afterBackspace = { domText: unchanged, selText: unchanged, ce: "false,false", active: "BODY" }
```

The flip (`isUserSelecting` → all hosts `ce=false`) is what lets the highlight cross marks mid-drag — and it is also what kills the editor afterwards: with the pressed host frozen non-editable, focus falls to `BODY`, container listeners never see another key, and `clearIfCollapsed` waits for a collapse that select-then-type users never produce.

## Measured: one host

### Post-migration verification (2026-08-12) — measured

The migration shipped. Live sweep on the react storybook (`MarkedInput/Configured`), Chromium, trusted events — **6 of 8 PASS**. Two probe claims below did NOT transfer from fixture to live DOM; both are corrected here and marked _superseded_ where they were originally stated. History below this section is left as written.

Live sweep of the defects this migration existed to kill:

| #   | Check                                                                             | Result                                                                                                                                                                                                                                                       |
| --- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Click into each of the first three text spans in turn — caret lands where clicked | **PASS** — the click steal is dead                                                                                                                                                                                                                           |
| 2   | Sweep span 1 → across a mark → span 2, then Backspace                             | **PASS** — text and mark deleted; no dead editor                                                                                                                                                                                                             |
| 3   | Tab from inside the field                                                         | **PASS** — focus leaves. A consumer `<button>` mark keeps its own native tab stop                                                                                                                                                                            |
| 4   | Home / End                                                                        | **PASS** — whole visual line, across marks                                                                                                                                                                                                                   |
| 5   | Alt+ArrowLeft repeatedly                                                          | **PASS** — word-jumps across marks, never sticks                                                                                                                                                                                                             |
| 6   | Triple-click selects the visual line, not one span                                | **FAIL** — **engine limit, not markput**. Chromium bounds paragraph selection at ANY inline `ce=false` atomic; reproduced in a control page with no markput at all (plain `<div contenteditable>` + bare inline `<span ce=false>`). No DOM topology fixes it |
| 7   | Arrow Left/Right through a mark                                                   | **PASS** — one keystroke per position, no dead stops                                                                                                                                                                                                         |
| 8   | Click between two adjacent marks — caret in the empty gap                         | **FAIL** — on the LIVE DOM the bare gap span computes to **0.0px wide**; 5/5 clicks land elsewhere. The gap stays **arrow-reachable** (one container-anchored stop, as probed). Filler still rejected: real text contaminates `range.toString()` on copy     |

#### Two probe claims refuted by the live DOM

**Gap clicks — fixture vs live.** "5/5 clicks land on the bare gap span" was measured on a static fixture whose gap span had layout. In the shipped renderer the empty `TextToken('')` span has zero width, so there is no pixel to hit. Arrow reachability (one stop, container-anchored) held exactly as probed, and that is what makes the position usable without a filler.

**Triple-click — not this migration's to fix.** The N-host table recorded it as a per-span block-boundary artifact. The control experiment says otherwise: paragraph selection stops at any inline `ce=false` atomic in Chromium regardless of how many hosts exist. It is reclassified as an engine limit and stays open.

#### Anchor-family fixes landed after the sweep

- `cdba8215` — a collapsed `beforeinput` target range must resolve to ONE anchor: reading both affinities against a single boundary named the same position twice, which downstream read as a zero-length RANGE and deleted nothing.
- `3e5af051` — slot-host edge boundaries anchor INSIDE the slot, so an edit at a transparent mark's leading edge lands in the slot rather than before the mark's markup.
- `b12149f2` — collapsed edits trust the model caret over the canonicalized target range: Chromium canonicalizes a collapsed target range to the earliest visually equivalent position, erasing the side-of-boundary distinction the model's own caret keeps.

### Single-host probes — proven

Fixture built from the committed snapshot DOM (`packages/storybook/src/pages/__snapshots__/stories.react.spec.tsx.snap` — flat `<span>text</span><mark>…` shape, no invented chrome), served over HTTP, driven with trusted events in Chromium. Scope is Chromium-only by maintainer decision (2026-08-10).

#### Empty gap between two `ce=false` marks — the parser-guaranteed case

The parser guarantees empty `TextToken('')` around top-level marks, so this decides whether a ZWSP filler is mandatory. **It is not.** The earlier "ZWSP + min-width or bust" verdict came from the pre-rewrite fixture with invented `[ ]` chrome — on the committed DOM shape the bare gap is reachable by both arrows and clicks: **[superseded — see the post-migration addendum above: the click column does not transfer to the live DOM, where the gap span is 0px wide; arrow reachability holds]**

Caret reachability at the empty gap; 5 clicks at gap-midpoint ±2px, arrows traversing the full line:

| Fixture case                                      | Arrow stops at the gap                                         | Click hits (5 tries)    | Caret anchor produced               |
| ------------------------------------------------- | -------------------------------------------------------------- | ----------------------- | ----------------------------------- |
| **A — bare empty `<span>`**                       | **1 stop** — `DIV:2` (container-anchored, between the marks)   | **5/5** → `gapSpan:0`   | element boundary (span / container) |
| B — ZWSP in the span                              | 2 stops — `gap:0` and `gap:1` (an extra keypress for the user) | 5/5 → ZWSP text node    | text node                           |
| C — ZWSP + `inline-block; min-width:1px`          | 2 stops — same as B                                            | 5/5 → ZWSP text node    | text node                           |
| D1 — bare empty span at document edge, mark leads | reachable — `editor:0`                                         | edge click → `editor:0` | element boundary (container)        |
| D2 — same with ZWSP                               | 2 stops (ZWSP:1, ZWSP:0)                                       | edge click → `ZWSP:0`   | text node                           |

**Element-anchored boundaries already resolve — zero fillers ship.** Bare gaps produce **element-anchored** caret positions (`gapSpan:0`, `DIV:2`, `editor:0`), not text-node positions — and `anchorFor` resolves all three today: `(gapSpan, 0)` via the element-boundary arm (`textOffsets.ts:17,44-46`), `(container, k)` via `fromContainerAnchor` → `{before: roots[k]}` (`domBoundary.ts:46-48,152-157`). No ZWSP, no clipboard contamination, no double arrow stop. One invariant to preserve: container child index ↔ root index stays 1:1, i.e. empty text tokens keep rendering their bare `<span>` (committed behavior). _Proven by code._

#### Native selection across atomics — no flip machinery

```
sweep across <mark ce=false>m</mark> inside one host:
  selText = "bcXYmde"   ← mark text included, selection crossed
  active  = editor      ← focus never left; no ce flip, no dead state

Backspace over that selection:
  beforeinput { inputType: "deleteContentBackward", cancelable: true, targetRange spans the mark }
```

The entire `isUserSelecting` sweep flip (~64 production lines + 14 spec references) exists to let a drag escape the host it started in. One host has nothing to escape. And the delete that is silently dropped today becomes an ordinary guarded `edit.replace` with anchors spanning the mark.

#### Native undo after guarded edits — measured in both worlds

Guarded typing (preventDefault + manual DOM write, exactly the markput pipeline shape) followed by Cmd+Z: **zero events fire, nothing changes** — identically in the live N-host storybook and the single-host fixture. Undo is an editor-owned-history problem in either topology; the migration neither fixes nor worsens it. It stops being billed to N hosts.

#### Target DOM shape

```
TODAY — N hosts (committed snapshot)
<div> — no attributes, not an editing host
  span ce=true      text token — own host
  mark tabindex=0   atomic by accident
  span ce=true      own host
  mark tabindex=0
  span ce=true      own host

TARGET — one host
<div contenteditable=true> — THE editing host
  span              bare — inherits editable
  mark ce=false     atomic by contract
  span              bare
  mark ce=false
  span              bare
```

Slot marks stay transparent: inside a mark root, everything _not_ on the path to the child wrapper gets `ce=false`; the slot content itself remains editable (it holds ordinary text tokens). A childless value-only mark is entirely `ce=false`. Today's atomicity is a side effect of "my parent is not an editing host"; the target makes it an explicit contract.

## Design — what the migration deletes, replaces, and builds

Prior art: CodeMirror 6 is exactly this target — one `contenteditable`, native selection, `ce=false` widgets, atomic ranges for caret normalisation. CM5 shipped the opposite design and the team abandoned it on a rewrite. ProseMirror, Slate, Quill, Lexical, TipTap: all one host. Notion is the deliberate counter-example — `contenteditable` per block — and its price is visible in-product: cross-block selection snaps to whole blocks, and clipboard, undo and most of the keyboard are custom (observed behavior; source closed). markput is _cheaper_ than CM6 here: with no `MutationObserver` and every input path already `preventDefault()` + `edit.replace()`, a beforeinput guard replaces the DOM observer entirely.

| Mechanism                                          | Today                                                                                                                                            | Under one host                                                                                                                                                                                   | Status         |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------- |
| `editableState.ts` per-span `ce=true`              | the only production `contentEditable` write in the workspace                                                                                     | container-level policy: host `ce=true`, atomics `ce=false`, slot path transparent                                                                                                                | replaced       |
| `isUserSelecting` sweep flip                       | ~64 lines + 14 spec refs; source of the dead-editor state                                                                                        | nothing to escape — native sweep crosses atomics (measured)                                                                                                                                      | deleted        |
| focusin/focusout selection sync + microtask clear  | source of the click steal (stack-proven)                                                                                                         | one host = one focus boundary; sync reduces to `selectionchange` only                                                                                                                            | mostly deleted |
| `arrowNav.ts` mark skipping                        | Left/Right handler moving focus between hosts                                                                                                    | caret normaliser over atomic boundaries + element-anchored gap positions (≈ CM6 `atomicRanges`); **not** a deletion                                                                              | replaced       |
| `blockEdit.ts` `findActiveRow` via `activeElement` | 5 call sites; dies under one host (activeElement = container)                                                                                    | row = root of the selection anchor's node, via existing `domAnchors()` — works under _both_ topologies, can land first                                                                           | replaced       |
| `blockEdit.ts` cross-row Arrow handlers            | ~56 lines of manual caret transport incl. `placeCaretAtX` ±4px magic                                                                             | native — one host has no boundary to hand-carry the caret across                                                                                                                                 | deleted        |
| `block/operations.ts` string synthesis             | slices props-first `value()` by tree positions; caret from pre-edit offsets clamped by `Math.min` (pinned wrong in `BlockController.spec.ts:56`) | drag verbs as anchor-based `edit.replace`; caret is an anchor, not an arithmetic guess                                                                                                           | replaced       |
| beforeinput guard                                  | —                                                                                                                                                | ~151 lines, 47/47 cancelable cases (prior session). Does **not** cover IME (`insertCompositionText` uncancelable — composition stays unhandled by design) or native undo (dead anyway, measured) | built          |

### Line delta — estimates, count in place per commit

|                                                  |           |
| ------------------------------------------------ | --------- |
| Sweep flip + editable policy (`dom/`)            | −64       |
| Focus sync / steal machinery (`SelectionDriver`) | −80 est.  |
| `blockEdit` cross-row arrows + `findActiveRow`   | −90 est.  |
| `block/operations.ts` string synthesis path      | −120 est. |
| beforeinput guard                                | +151      |
| Caret normaliser (replaces `arrowNav`)           | +60 est.  |

Direct effect of the host migration alone: −15…−110 net production lines (−185…−200 gross). With the "which host am I in" machinery across `dom/` and `keyboard/` and the block address-space fix: plausibly −400…−600; block feature total today is 956 core + 372 adapter lines. Doing host + block together ≈ **−1300 production lines** (estimate). Spec/story migration on top: ~425 spec + 114 storybook selector lines.

### Why block cannot stay behind

The coupling is two-way. One host kills `findActiveRow` (every block keybinding routes through it), so block must be touched. And block's cross-row arrow handlers are precisely the code one host makes native — rebuilding them on tree anchors first would be building code destined for deletion. The shared seam already exists: `domAnchors()` resolves the live DOM selection to tree anchors under both topologies, and `blockEdit.ts:148` already uses it. Row identity moves from `activeElement` to "root of the selection anchor" as the _first_ commit, green under N hosts, before any host change.

## Breaking changes — every one explicit

Published packages (`@markput/react`, `@markput/vue` at 0.14.3) have real users. `@markput/core` is unpublished — its internals are fair game. Anything reachable from `MarkputApi` is not cut on zero-in-repo-caller evidence.

| Change                                                                                                                                                                                                                                    | Who sees it                                                                                                               | Cost / gain                                                            |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| **break** DOM shape: container becomes the single `contenteditable`; text spans lose their attribute; mark roots get `ce=false` and lose `tabindex=0`                                                                                     | consumers with CSS/tests keyed to `span[contenteditable]` or relying on focusable marks; storybook selectors (~114 lines) | the entire migration — this _is_ the change                            |
| **break** `onFocus`/`onBlur` via `slotProps.container` fire once per real entry/exit instead of per span switch                                                                                                                           | consumers who (accidentally) depended on churn — 3 clicks fired 3×/4× today                                               | defect #11 becomes the correct behavior with zero debounce code        |
| **break** Tab leaves the field (native single-host behavior); marks are no longer tab stops                                                                                                                                               | keyboard users; anyone relying on Tab reaching a mark                                                                     | defect #5 disappears; mark focus for a11y needs its own decision later |
| **break** caret after a block drag-delete lands at the start of the row that replaced the deleted one — `BlockController.spec.ts:56` currently pins the stale-offset answer (end of document / mid-word)                                  | block-mode users (behavior improves); the pinned spec flips                                                               | fixes the designed-in bug for free once drag verbs are anchor-based    |
| **break** block keybindings route by selection, not `activeElement`; grip/menu/keyboard gates unify (`isBlock && draggable` ambiguity resolved one way)                                                                                   | consumers setting `layout:'block'` with `draggable:false` — today the menu opens and every action is silently swallowed   | one owner for "which row", instead of seven derivations                |
| Not a break, called out: **IME stays unhandled** (`insertCompositionText` is not cancelable) and **undo stays dead** — measured identical in both topologies; each needs its own future task (composition handling; editor-owned history) | —                                                                                                                         | —                                                                      |
| Not a break, called out: scope is **Chromium-only** (maintainer decision 2026-08-10); Firefox measured materially worse on gap carets and edge positions, and Safari/Firefox users of the published packages exist                        | —                                                                                                                         | —                                                                      |

## Staged plan — each commit green on its own

1. **Row identity seam** _(green under N hosts)_ — `findActiveRow` → "root of the selection anchor" via existing `domAnchors()` + `rootIndexOf`. Works under both topologies; lands before any host change. Kills the `activeElement` dependency at all 5 call sites.
2. **Drag operations speak anchors** _(breaking: caret fix)_ — `operations.ts` string synthesis → anchor-based `edit.replace` verbs; caret becomes an anchor. The `BlockController.spec.ts:56` pin flips to the correct position. Address-space hazard (props-first `value()` sliced by tree positions) disappears with the slicing.
3. **Host flip** _(breaking: DOM shape)_ — container `ce=true`; editable policy (bare spans, `ce=false` atomics, transparent slot path); beforeinput guard (~151 lines, 47 cases); caret normaliser replaces `arrowNav` — `anchorFor` already resolves element-anchored gap boundaries (verified by code reading). Delete: sweep flip, focus-sync steal machinery, cross-row arrow handlers. Defects #4–#11 + the click steal die here.
4. **Gate unification** _(breaking: draggable semantics)_ — one owner for block gating (`isBlock`/`draggable`); the swallowed-action state becomes impossible. The four meanings of `isBlock()` reduced to layout + routing.
5. **Spec & story migration** — ~425 spec lines + 114 storybook selector lines re-pointed at the single-host DOM; the 14 flip spec references retire with the flip. `inconsistencies.md` rewritten from this document's measurements.

**Measure-first obligations already discharged.** Both probes the plan depended on ran 2026-08-11: the defect list was re-measured live, and the empty-gap caret question resolved in favor of zero fillers — the `anchorFor` element-boundary check passed by code reading. The remaining unknown before commit 3 is the intra-host drag-and-drop case, unmeasurable headlessly on macOS.
