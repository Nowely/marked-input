# Every consumer writes `Atomic` themselves

Type: task
Status: resolved — shipped from `@markput/react`; the Vue twin rides with 26 (2026-08-27)
Blocked by: —

## Problem

`useControlRef()` is the registration a kind must make for a control it paints, and the wrapper
every consumer builds around it is not shipped. `insights.md:56-65`:

> **3. A control a kind paints must call `useControlRef()`, or it is document content.** P11 shipped
> believing atomicity was automatic; measured, **four of the seven** atomic kinds had no control
> root, and a click or an ArrowDown parked a blinking caret inside a properties grid where every
> keystroke was swallowed. The showcase carries **11** `useControlRef()` calls behind one
> hand-written `Atomic` wrapper.
> **Honest fix: docs — and one shipped component.** Core cannot infer it: a `<select>` inside a
> contenteditable is a legitimate thing to edit, which is exactly why `KEYBOARD_OWNERS` exists
> (`SelectionDriver.ts:327`). The gap that IS ours is that every consumer writes `Atomic` themselves.
> It is six lines and the showcase proved the shape; shipping it beside `useControlRef` costs one
> export and deletes a class of "I forgot on one of the seven".

One cite in that quote has gone stale: `KEYBOARD_OWNERS` is `SelectionDriver.ts:16` at `52ef65ae`,
not `:327`. The claim it supports is unchanged — the constant exists and lists
`select, input, textarea, [contenteditable="true"], [contenteditable=""]`.

Verified at `52ef65ae`: `useControlRef(` has exactly 11 call sites in
`packages/storybook/src/pages/Notion/notion/options.tsx`, and the hand-written wrapper is one
component at `:71`.

## Why it matters here

The failure mode is the one this effort spent six repair rounds on — a row that holds no editable
position — arriving through a consumer's oversight rather than through a core rule. It is the only
member of the "core cannot see what a component does" class whose fix is a component rather than a
diagnostic.

## Cost, and the reason it is not `ready-for-agent`

Six lines and one export per adapter — but it IS new published surface, and the showcase's own
wrapper is React-only today, so a Vue twin lands with it (see [26](26-vue-showcase-p12.md)). The
engineering default in AGENTS.md is not to add published surface without a current caller; the
caller here is every consumer who paints a control, which is a maintainer's call rather than an
agent's.

## Answer (2026-08-27)

**Shipped:** `Atomic` from `@markput/react`, one `<div>` taking `className` and `useControlRef()`.

**And the showcase's own copy came OUT**, which is what makes it an export rather than a second
implementation: `options.tsx` imports it now, so the shape has one home. The element is identical,
so no story snapshot moved — checked, not assumed.

**No Vue twin here, and the reason is not symmetry for its own sake.** `@markput/vue` publishes no
`useControlRef` at all, so a Vue consumer cannot register a control through the public API and a
wrapper over a primitive that package does not have would be the wrong half to ship first. That gap
is P12's, filed as [26](26-vue-showcase-p12.md), which already names Vue's `useControlRef` among
what it owes.

**On AGENTS.md's "no published surface without a current caller":** the caller is `options.tsx`,
which now imports it, and the case is the measured one this ticket carries — four of seven atomic
kinds shipped with no control root, and a click parked a blinking caret in a properties grid where
every keystroke was swallowed. `useControlRef` stays exported beside it: the hook marks ONE control,
the component marks a whole interior, and eight of the showcase's call sites are still the former.

Documented at `guides/row-kinds.md` → "Controls inside a row", with a fence the `docs` project
type-checks against the adapter source.
