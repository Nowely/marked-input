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
| `TMarkProps` | [`MarkProps`](/api/interfaces/markprops/) | Type of props for the global Mark component |
| `TOverlayProps` *extends* `CoreOption`\[`"overlay"`\] | [`OverlayProps`](/api/interfaces/overlayprops/) | Type of props for the global Overlay component |

## Properties

### className?

```ts
optional className: string;
```

Defined in: [react/markput/src/components/MarkedInput.tsx:44](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/components/MarkedInput.tsx#L44)

Additional classes

***

### defaultValue?

```ts
optional defaultValue: string;
```

Defined in: [react/markput/src/components/MarkedInput.tsx:65](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/components/MarkedInput.tsx#L65)

Initial value for uncontrolled mode

***

### draggable?

```ts
optional draggable: boolean | DraggableConfig;
```

Defined in: [react/markput/src/components/MarkedInput.tsx:77](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/components/MarkedInput.tsx#L77)

Enable drag interaction on block rows. Only effective when layout='block'.

#### Default

```ts
false
```

***

### layout?

```ts
optional layout: "block" | "inline";
```

Defined in: [react/markput/src/components/MarkedInput.tsx:73](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/components/MarkedInput.tsx#L73)

Layout mode: 'inline' renders tokens in a single flow, 'block' stacks each token as its own row.

#### Default

```ts
'inline'
```

***

### Mark?

```ts
optional Mark: ComponentType<TMarkProps>;
```

Defined in: [react/markput/src/components/MarkedInput.tsx:34](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/components/MarkedInput.tsx#L34)

Global component used for rendering markups (fallback for option.Mark)

***

### onChange()?

```ts
optional onChange: (value) => void;
```

Defined in: [react/markput/src/components/MarkedInput.tsx:67](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/components/MarkedInput.tsx#L67)

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

Defined in: [react/markput/src/components/MarkedInput.tsx:42](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/components/MarkedInput.tsx#L42)

Configuration options for markups and overlays.
Each option can specify its own component via option.Mark or option.Overlay.
Falls back to global Mark/Overlay components when not specified.

***

### Overlay?

```ts
optional Overlay: ComponentType<TOverlayProps>;
```

Defined in: [react/markput/src/components/MarkedInput.tsx:36](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/components/MarkedInput.tsx#L36)

Global component used for rendering overlays (fallback for option.Overlay)

***

### readOnly?

```ts
optional readOnly: boolean;
```

Defined in: [react/markput/src/components/MarkedInput.tsx:69](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/components/MarkedInput.tsx#L69)

Read-only mode

***

### ref?

```ts
optional ref: Ref<MarkputHandler>;
```

Defined in: [react/markput/src/components/MarkedInput.tsx:30](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/components/MarkedInput.tsx#L30)

Ref to handler

***

### showOverlayOn?

```ts
optional showOverlayOn: OverlayTrigger;
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
optional slotProps: SlotProps;
```

Defined in: [react/markput/src/components/MarkedInput.tsx:56](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/components/MarkedInput.tsx#L56)

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

Defined in: [react/markput/src/components/MarkedInput.tsx:51](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/components/MarkedInput.tsx#L51)

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

Defined in: [react/markput/src/components/MarkedInput.tsx:32](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/components/MarkedInput.tsx#L32)

Global component used for rendering text tokens (default: built-in Span)

***

### style?

```ts
optional style: CSSProperties;
```

Defined in: [react/markput/src/components/MarkedInput.tsx:46](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/components/MarkedInput.tsx#L46)

Additional style

***

### value?

```ts
optional value: string;
```

Defined in: [react/markput/src/components/MarkedInput.tsx:63](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/components/MarkedInput.tsx#L63)

Annotated text with markups
