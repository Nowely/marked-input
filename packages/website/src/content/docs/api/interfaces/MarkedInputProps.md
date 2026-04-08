---
editUrl: false
next: false
prev: false
title: "MarkedInputProps"
---

Defined in: [react/markput/src/components/MarkedInput.tsx:34](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/components/MarkedInput.tsx#L34)

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
| `TMarkProps` | [`MarkProps`](/api/interfaces/markprops/) | Type of props for the global Mark component |
| `TOverlayProps` | [`OverlayProps`](/api/interfaces/overlayprops/) | Type of props for the global Overlay component |

## Properties

### className?

```ts
optional className: string;
```

Defined in: [react/markput/src/components/MarkedInput.tsx:50](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/components/MarkedInput.tsx#L50)

Additional classes

***

### defaultValue?

```ts
optional defaultValue: string;
```

Defined in: [react/markput/src/components/MarkedInput.tsx:71](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/components/MarkedInput.tsx#L71)

Initial value for uncontrolled mode

***

### drag?

```ts
optional drag: 
  | boolean
  | {
  alwaysShowHandle: boolean;
};
```

Defined in: [react/markput/src/components/MarkedInput.tsx:80](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/components/MarkedInput.tsx#L80)

Enable drag mode: each individual token (mark or text) becomes its own draggable row.
One mark per row, one text fragment per row.
Adjacent marks need no separator; adjacent text rows are separated by `\n\n`.

***

### Mark?

```ts
optional Mark: ComponentType<TMarkProps>;
```

Defined in: [react/markput/src/components/MarkedInput.tsx:40](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/components/MarkedInput.tsx#L40)

Global component used for rendering markups (fallback for option.Mark)

***

### onChange()?

```ts
optional onChange: (value) => void;
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
optional options: Option<TMarkProps, TOverlayProps>[];
```

Defined in: [react/markput/src/components/MarkedInput.tsx:48](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/components/MarkedInput.tsx#L48)

Configuration options for markups and overlays.
Each option can specify its own component via option.Mark or option.Overlay.
Falls back to global Mark/Overlay components when not specified.

***

### Overlay?

```ts
optional Overlay: ComponentType<TOverlayProps>;
```

Defined in: [react/markput/src/components/MarkedInput.tsx:42](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/components/MarkedInput.tsx#L42)

Global component used for rendering overlays (fallback for option.Overlay)

***

### readOnly?

```ts
optional readOnly: boolean;
```

Defined in: [react/markput/src/components/MarkedInput.tsx:75](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/components/MarkedInput.tsx#L75)

Read-only mode

***

### ref?

```ts
optional ref: Ref<MarkputHandler>;
```

Defined in: [react/markput/src/components/MarkedInput.tsx:36](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/components/MarkedInput.tsx#L36)

Ref to handler

***

### showOverlayOn?

```ts
optional showOverlayOn: OverlayTrigger;
```

Defined in: [react/markput/src/components/MarkedInput.tsx:67](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/components/MarkedInput.tsx#L67)

Events that trigger overlay display

#### Default

```ts
'change'
```

***

### slotProps?

```ts
optional slotProps: SlotProps;
```

Defined in: [react/markput/src/components/MarkedInput.tsx:62](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/components/MarkedInput.tsx#L62)

Props to pass to slot components

#### Example

```ts
slotProps={{ container: { onKeyDown: handler }, span: { className: 'custom' } }}
```

***

### slots?

```ts
optional slots: Slots;
```

Defined in: [react/markput/src/components/MarkedInput.tsx:57](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/components/MarkedInput.tsx#L57)

Override internal components using slots

#### Example

```ts
slots={{ container: 'div', span: 'span' }}
```

***

### Span?

```ts
optional Span: ComponentType<MarkProps>;
```

Defined in: [react/markput/src/components/MarkedInput.tsx:38](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/components/MarkedInput.tsx#L38)

Global component used for rendering text tokens (default: built-in Span)

***

### style?

```ts
optional style: CSSProperties;
```

Defined in: [react/markput/src/components/MarkedInput.tsx:52](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/components/MarkedInput.tsx#L52)

Additional style

***

### value?

```ts
optional value: string;
```

Defined in: [react/markput/src/components/MarkedInput.tsx:69](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/components/MarkedInput.tsx#L69)

Annotated text with markups
