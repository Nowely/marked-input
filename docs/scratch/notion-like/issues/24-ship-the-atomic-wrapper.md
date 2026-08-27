# Every consumer writes `Atomic` themselves

Type: task
Status: needs-triage
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
