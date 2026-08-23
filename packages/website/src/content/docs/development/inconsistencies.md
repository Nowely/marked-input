---
title: Known Inconsistencies
description: Behavior differences between MarkedInput and native input/textarea elements — re-measured against the single-host core
keywords: [inconsistencies, bugs, limitations, contenteditable, selection, keyboard, accessibility]
---

MarkedInput now renders as **one editing host**. The container is the only `contenteditable`; everything below it either
inherits editability or is explicitly atomic:

```html
<div contenteditable="true">
	<!-- THE editing host. Flips to "false" under readOnly -->
	<span>text</span>
	<!-- bare text surface: no attribute, inherits editability -->
	<mark contenteditable="false">value</mark>
	<!-- value-only mark: atomic by contract, no tabindex -->
	<span>text</span>
	<span>
		<!-- slot mark: root stays BARE -->
		<i contenteditable="false">control</i>
		<!-- only the controls around the slot are frozen -->
		<span>slot text</span>
		<!-- slot content lives in the ONE host -->
	</span>
	<span>text</span>
</div>
```

Who writes what: `bind.ts` writes the per-token topology (bare text surfaces, `ce=false` value marks, frozen
controls around a slot host); `SelectionDriver` owns the container's `contenteditable`, gated only by `readOnly`;
`TokenModel.control()` marks registered controls (grips, menus, overlays) `ce=false` at registration, because a control is
not document content.

Every input still goes through the guard: `beforeinput` is cancelled and lowered to a model edit
(`keyboard/beforeInput.ts` + `keyboard/input.ts`), which **fails closed** — an input type the guard cannot express as an
edit is dropped rather than left to mutate the host.

**Measurement scope.** The rows below were measured in Chromium (live storybook, trusted events) on 2026-08-11 for the
pre-migration state and 2026-08-12 for the post-migration state, plus the core/adapter suites. Chromium-only is a
maintainer decision (2026-08-10); Firefox and Safari users of the published packages exist and are not covered by any of
these measurements.

---

## Resolved by the single-host migration

| Defect (pre-migration, measured)                                                                                                                            | Post-migration state                                                                                                                                                                                                                                                                     |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Click steal** (never filed — found while re-measuring): clicking into a non-focused span never moved the caret, because the model re-applied stored anchors and stole focus back before Chromium placed the click. It also ate triple-click on any non-focused span. | **Gone — resolved before it was ever documented.** Its two sources (per-span focus + the `focusin` selection sync) no longer exist. Clicks into the first three spans land where clicked, every time.                                              |
| **Cross-mark delete** only touched the originating span. After the rewrite it was worse: a finished cross-mark drag left every host `ce=false` and focus on `BODY`, so Backspace was silently dropped.                                                | **Works.** A sweep from span 1 across a mark into span 2 followed by Backspace deletes the text **and** the mark, in one guarded `edit.replace`. The whole drag-time editability flip is deleted — one host has nothing to escape.                                        |
| **Tab trapped** in the field, cycling `<span contenteditable>` and `tabindex=0` marks (post-rewrite it was fully dead: focus reached the mark and was snapped back). | **Tab leaves the field**, natively — mark roots lost `tabindex`. Pinned by `keyboard.react.spec` / `keyboard.vue.spec` ("leaves the field on Tab"). *Caveat, measured:* a consumer whose `Mark` renders a real `<button>` still gets a tab stop — `ce=false` does not remove a native button from tab order. That is the consumer's element, not markput's. |
| **Home/End** trapped at span offset 0 / span end.                                                                                                            | **Full visual line.** One host means one line box for the browser's own line motion.                                                                                                                                                                                                     |
| **Word navigation** (Alt/Ctrl+Arrow) stopped dead at the span boundary.                                                                                     | **Crosses marks.** Alt+ArrowLeft word-jumps across marks; repeated presses keep moving.                                                                                                                                                                                                  |
| **Shift+Arrow** selection could not cross a mark (it grew to the span end and stuck).                                                                        | **Expected resolved by topology — not separately measured** in the post-migration sweep. Shift+Arrow is plain native selection extension inside one host, and the plain-arrow and drag-sweep equivalents were both verified; treat this row as inference, not measurement.                |
| **Drag selection** did not cross marks (mid-drag it did, via the `ce=false` flip, but mouseup left the editor dead).                                         | **Works, with no flip machinery.** The native sweep crosses `ce=false` atomics inside one host; focus never leaves the container, and the resulting selection is an ordinary editable range.                                                                                              |
| **Focus/blur churn**: every click on a different span fired `focusout`+`focusin` on the container (3 clicks + 1 exit → 3× focus / 4× blur).                  | **Single entry/exit.** The container is the only focusable element markput writes, and the `focusin` listener is deleted; only `focusout` remains. Derived from the topology and the deleted listener — event counts were not re-recorded.                                                 |

---

## Still open

### Triple-click selects the mark-bounded run, not the line

Chromium bounds paragraph selection at **any inline `contenteditable=false` atomic**. This was control-measured
*without markput*: a plain `<div contenteditable>` containing a bare inline `<span contenteditable="false">` shows the
same bound. It is an engine limit, not a markput DOM-topology problem, and nothing in the migration could have fixed it.
No workaround ships: faking it would mean owning paragraph selection ourselves.

### Empty-gap mouse targeting

The parser guarantees an empty `TextToken('')` between two adjacent marks, rendered as a bare `<span></span>`.

- **Arrow-reachable:** one caret stop, container-anchored between the two marks. `anchorFor` resolves it.
- **Not mouse-reachable:** on the live DOM that span computes to **0.0px wide**, so there is no pixel to click — clicks
  at the gap midpoint land on a neighbouring mark instead. (The design doc's "5/5 clicks land on the gap span" came from
  a static fixture and does not transfer; see the addendum in `docs/records/one-host-migration.md`.)

A ZWSP or min-width filler remains **rejected**: a filler is real text in the DOM, so it contaminates `range.toString()`
on every copy, and it costs a second arrow stop at every gap. Reach the gap with an arrow key.

### A click on a mark's own presentation lands at the mark's nearest EDGE

A consumer's mark styling can own pixels no token's text covers — the markdown `list` preset is
`display: block; padding-left: 1em`, so the 1em band left of the first glyph belongs to the mark's element and to no
text. Chromium hit-tests a click there to that element, and the model owns no position inside a mark's presentation, so
the boundary answers the mark's **near edge** instead. Typing then inserts *outside* the mark: on
`` - `Code snippets` and `code blocks` `` a click in the padding plus `X` yields `XCode snippets and code blocks` —
the row un-lists.

Until 2026-08-22 that same click **dropped the keystroke entirely**: the boundary's island guard read the inherited
`isContentEditable`, which a slot mark's bare root and every element below it get from the container, so it declined,
`domAnchors()` declined with it, and the fail-closed `beforeinput` guard cancelled the key with no model edit. Reading
the `contentEditable` **property** instead — a consumer's *explicit* island and nothing else — is the fix, and the near
edge is the documented fallback it uncovers.

Whether "start of the slot content" would be a better answer than "before the mark" is undecided; it is a change to
`nearestMarkEdge`, not to the guard.

### Native undo/redo is dead

Cmd+Z / Ctrl+Z does nothing — for mark deletion *and* for plain typing. Two independent reasons, both measured:

1. Every edit is `preventDefault()` + a model write, so the browser's undo stack is empty — there is nothing to undo.
2. `historyUndo` / `historyRedo` arrive as `beforeinput` types the guard cannot express as an edit, so the fail-closed
   guard cancels them.

Measured identical **before and after** the migration; the topology never had anything to do with it. The fix is an
editor-owned history, which is a separate feature. (The old page's "basic undo within a span works ✅" was false and has
been removed.)

### IME / composition is unhandled

`insertCompositionText` is not cancelable, so the guard lets it through by design — composition writes to the host
directly and the model reconciles afterwards. Unhandled by design; needs its own design pass.

### Markup injection via paste

Pasting the literal text `@[injected](primary:99)` creates a mark instead of inserting plain text. Mechanism is
unchanged by this migration: the paste is intercepted, lowered to a string splice, and the spliced window is re-parsed
(`keyboard/input.ts` → `tokens/tree/transactions.ts` → `valueBoundary.ts`), so pasted markup is markup.

### No focus ring

`outline: none` is set on the editor's surfaces in `packages/core/styles.module.css`; nothing draws a focus indicator in
its place. Unchanged by this migration.

### No ARIA role or accessible name

The container carries no `role`, no `aria-multiline`, no label. A screen reader does not announce it as an editable
text field. Unchanged by this migration — but the container is now the single focusable editing host, i.e. the natural
carrier for `role="textbox"` + `aria-multiline="true"`. That is a scoped follow-up task, not a topology problem.

### Chromium-only scope

All behavior above was measured in Chromium only (maintainer decision, 2026-08-10). Firefox previously measured
materially worse on gap carets and edge positions. Firefox and Safari users of `@markput/react` / `@markput/vue` exist;
their behavior is unverified.

---

## Works correctly

Re-verified subset only — each row is either in the post-migration live sweep or pinned by a suite. Rows that were
never re-verified are not listed.

| Behavior                          | State                                                                                                                                                    |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Typing and `onChange`             | Characters insert at the caret; the value updates per keystroke.                                                                                          |
| Enter inserts `\n`                | Enter is a newline **in the value**, not a DOM line break — the guard lowers `insertParagraph`/`insertLineBreak` to `'\n'`, so the browser never builds a `<div>`/`<br>` inside the host. |
| Caret navigation across marks     | Left/Right walk through a mark one position per keypress, natively — no dead stop, no double press, no custom arrow handler in the core at all.               |
| Select-all, then type / paste / delete | Ctrl+A selects the editor's whole contents (one host, one boundary) and the next input replaces the **whole value**. In block layout, Ctrl+A then Enter replaces the document with one fresh row — **BREAKING**, introduced by `603adfac`. |
| Cross-mark selection delete / replace | A selection spanning marks deletes or is replaced as one guarded edit, including the marks it covers.                                                 |
| Copy                              | `text/plain` is the native `range.toString()` over the one host, so it spans marks; markput also writes `text/html` and its own markup MIME so a copy/paste round-trip keeps the marks. |
</content>
