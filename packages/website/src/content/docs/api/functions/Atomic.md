---
editUrl: false
next: false
prev: false
title: "Atomic"
---

```ts
function Atomic(__namedParameters): Element;
```

Defined in: [react/markput/src/components/Atomic.tsx:22](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/components/Atomic.tsx#L22)

A region of a row's component that is EDITOR UI rather than document content: a properties
grid, a board, a card, a table of contents. Everything a row's component paints sits inside the
one contenteditable container, so a panel the editor knows nothing about is text the caret
enters and the browser edits — a click or an ArrowDown parks a blinking caret in it and every
keystroke after that is swallowed.

It is [useControlRef](/api/functions/usecontrolref/) on one wrapper. The hook is what a SINGLE control takes — a
checkbox, a toggle arrow, a language `<select>` — and this is the shape for the other case, a
whole interior that holds no document surface at all. Both were written by hand in every
consumer that paints one, and forgetting on one kind of seven is the measured failure: when the
showcase's atomic kinds first shipped, four of the seven had no control root.

SAYING SO IS A CALL, NOT A DERIVATION, and core cannot make it: a `<select>` inside a
contenteditable is a legitimate thing to edit, which is why the selection driver keeps a list of
elements that own the keyboard.

## Parameters

| Parameter | Type |
| ------ | ------ |
| `__namedParameters` | \{ `children?`: `ReactNode`; `className?`: `string`; \} |
| `__namedParameters.children?` | `ReactNode` |
| `__namedParameters.className?` | `string` |

## Returns

`Element`
