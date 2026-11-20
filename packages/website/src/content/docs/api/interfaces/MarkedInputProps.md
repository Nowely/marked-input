---
editUrl: false
next: false
prev: false
title: "MarkedInputProps"
---

Defined in: [react/markput/src/components/MarkedInput.tsx:28](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/components/MarkedInput.tsx#L28)

Props for MarkedInput component.

## Example

```tsx
<MarkedInput<ChipProps>
  Mark={Chip}
  options={[{
    markup: '@[__value__]',
    mark: { label: 'Click me' }
  }]}
/>
```

## Type Parameters

| Type Parameter | Default type | Description |
| ------ | ------ | ------ |
| <a id="type-parameter-tmarkprops"></a> `TMarkProps` | [`MarkProps`](/api/interfaces/markprops/) | Type of props for the global Mark component |
| <a id="type-parameter-toverlayprops"></a> `TOverlayProps` *extends* `CoreOption`\[`"overlay"`\] | [`OverlayProps`](/api/interfaces/overlayprops/) | Type of props for the global Overlay component |

## Properties

### className?

```ts
className?: string;
```

Defined in: [react/markput/src/components/MarkedInput.tsx:44](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/components/MarkedInput.tsx#L44)

Additional classes

***

### defaultValue?

```ts
defaultValue?: string;
```

Defined in: [react/markput/src/components/MarkedInput.tsx:71](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/components/MarkedInput.tsx#L71)

Initial value for uncontrolled mode — the value the editor starts from when no `value`
prop is given. It is read once: setting it later does not move an editor that already
holds a value, and it is NOT what a controlled editor reverts to. Dropping `value`
(passing `undefined` after a string) keeps whatever is on screen; to go back to some
earlier text, pass it.

***

### draggable?

```ts
draggable?: boolean | DraggableConfig;
```

Defined in: [react/markput/src/components/MarkedInput.tsx:115](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/components/MarkedInput.tsx#L115)

Enable drag interaction on rows. Ineffective when `separator` is `null`.

#### Default

```ts
false
```

***

### history?

```ts
history?: boolean;
```

Defined in: [react/markput/src/components/MarkedInput.tsx:111](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/components/MarkedInput.tsx#L111)

Does the editor keep its own undo stack (ADR-0012). Ctrl/Cmd+Z undoes and Shift+Ctrl/Cmd+Z
redoes, in both value modes — in a controlled editor an entry is recorded only once the
parent has echoed the value back, so an emission your `onChange` declines leaves nothing
behind.

`false` turns both keys back into no-ops. It does NOT hand undo to the browser: the input
guard has swallowed native undo since ADR-0006, because a native undo would edit DOM the
model owns.

#### Default

```ts
true
```

***

### indent?

```ts
indent?: string;
```

Defined in: [react/markput/src/components/MarkedInput.tsx:99](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/components/MarkedInput.tsx#L99)

The indent unit a NESTED row leads with (ADR-0010): editor-level like `separator`, and
structural in the same sense — a leading run of it at a row's own start belongs to no
markup and no caret may enter it.

`''` turns nesting off, and with it row TYPING on every indented line: a line whose first
character is not an opener is a paragraph. Pass it when the document stores leading
indentation as content.

#### Default

```ts
'\t'
```

***

### Mark?

```ts
Mark?: ComponentType<TMarkProps>;
```

Defined in: [react/markput/src/components/MarkedInput.tsx:34](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/components/MarkedInput.tsx#L34)

Global component used for rendering markups (fallback for option.Mark)

***

### onChange?

```ts
onChange?: (value) => void;
```

Defined in: [react/markput/src/components/MarkedInput.tsx:73](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/components/MarkedInput.tsx#L73)

Change event handler

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `value` | `string` |

#### Returns

`void`

***

### options?

```ts
options?: Option<TMarkProps, TOverlayProps>[];
```

Defined in: [react/markput/src/components/MarkedInput.tsx:42](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/components/MarkedInput.tsx#L42)

Configuration options for markups and overlays.
Each option can specify its own component via option.Mark or option.Overlay.
Falls back to global Mark/Overlay components when not specified.

***

### Overlay?

```ts
Overlay?: ComponentType<TOverlayProps>;
```

Defined in: [react/markput/src/components/MarkedInput.tsx:36](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/components/MarkedInput.tsx#L36)

Global component used for rendering overlays (fallback for option.Overlay)

***

### readOnly?

```ts
readOnly?: boolean;
```

Defined in: [react/markput/src/components/MarkedInput.tsx:75](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/components/MarkedInput.tsx#L75)

Read-only mode

***

### ref?

```ts
ref?: Ref<MarkputHandle>;
```

Defined in: [react/markput/src/components/MarkedInput.tsx:30](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/components/MarkedInput.tsx#L30)

Ref to the editor API (spec §2.3)

***

### separator?

```ts
separator?: string | null;
```

Defined in: [react/markput/src/components/MarkedInput.tsx:88](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/components/MarkedInput.tsx#L88)

The structural row separator (issue 08, ADR-0011): editor-level, never part of any markup,
and the whole of what makes a document rows. Each piece between two separators is a row,
with its own drag grip and row menu.

`null` says the value never splits: one document, no rows, no row controls — a plain
annotated text field.

An empty string separates nothing: the editor reports it and renders the document as if it
were `null`.

#### Default

```ts
'\n'
```

***

### showOverlayOn?

```ts
showOverlayOn?: OverlayTrigger;
```

Defined in: [react/markput/src/components/MarkedInput.tsx:61](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/components/MarkedInput.tsx#L61)

Events that trigger overlay display

#### Default

```ts
'change'
```

***

### slotProps?

```ts
slotProps?: SlotProps;
```

Defined in: [react/markput/src/components/MarkedInput.tsx:56](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/components/MarkedInput.tsx#L56)

Props to pass to slot components

#### Example

```ts
slotProps={{ container: { onKeyDown: handler } }}
```

***

### slots?

```ts
slots?: Slots;
```

Defined in: [react/markput/src/components/MarkedInput.tsx:51](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/components/MarkedInput.tsx#L51)

Override internal components using slots

#### Example

```ts
slots={{ container: 'div' }}
```

***

### Span?

```ts
Span?: ComponentType<SpanProps>;
```

Defined in: [react/markput/src/components/MarkedInput.tsx:32](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/components/MarkedInput.tsx#L32)

Global component used for rendering text tokens (default: built-in Span)

***

### style?

```ts
style?: CSSProperties;
```

Defined in: [react/markput/src/components/MarkedInput.tsx:46](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/components/MarkedInput.tsx#L46)

Additional style

***

### value?

```ts
value?: string;
```

Defined in: [react/markput/src/components/MarkedInput.tsx:63](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/components/MarkedInput.tsx#L63)

Annotated text with markups
