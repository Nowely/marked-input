---
editUrl: false
next: false
prev: false
title: "MarkedInputProps"
---

Defined in: [react/markput/src/components/MarkedInput.tsx:32](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/components/MarkedInput.tsx#L32)

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

### block?

```ts
optional block: boolean;
```

Defined in: [react/markput/src/components/MarkedInput.tsx:73](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/components/MarkedInput.tsx#L73)

Enable Notion-like draggable blocks with drag handles for reordering

***

### className?

```ts
optional className: string;
```

Defined in: [react/markput/src/components/MarkedInput.tsx:46](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/components/MarkedInput.tsx#L46)

Additional classes

***

### defaultValue?

```ts
optional defaultValue: string;
```

Defined in: [react/markput/src/components/MarkedInput.tsx:67](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/components/MarkedInput.tsx#L67)

Initial value for uncontrolled mode

***

### Mark?

```ts
optional Mark: ComponentType<TMarkProps>;
```

Defined in: [react/markput/src/components/MarkedInput.tsx:36](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/components/MarkedInput.tsx#L36)

Global component used for rendering markups (fallback for option.mark.slot)

***

### onChange()?

```ts
optional onChange: (value) => void;
```

Defined in: [react/markput/src/components/MarkedInput.tsx:69](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/components/MarkedInput.tsx#L69)

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

Defined in: [react/markput/src/components/MarkedInput.tsx:44](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/components/MarkedInput.tsx#L44)

Configuration options for markups and overlays.
Each option can specify its own slot component via mark.slot or overlay.slot.
Falls back to global Mark/Overlay components when not specified.

***

### Overlay?

```ts
optional Overlay: ComponentType<TOverlayProps>;
```

Defined in: [react/markput/src/components/MarkedInput.tsx:38](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/components/MarkedInput.tsx#L38)

Global component used for rendering overlays (fallback for option.overlay.slot)

***

### readOnly?

```ts
optional readOnly: boolean;
```

Defined in: [react/markput/src/components/MarkedInput.tsx:71](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/components/MarkedInput.tsx#L71)

Read-only mode

***

### ref?

```ts
optional ref: Ref<MarkputHandler>;
```

Defined in: [react/markput/src/components/MarkedInput.tsx:34](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/components/MarkedInput.tsx#L34)

Ref to handler

***

### showOverlayOn?

```ts
optional showOverlayOn: OverlayTrigger;
```

Defined in: [react/markput/src/components/MarkedInput.tsx:63](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/components/MarkedInput.tsx#L63)

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

Defined in: [react/markput/src/components/MarkedInput.tsx:58](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/components/MarkedInput.tsx#L58)

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

Defined in: [react/markput/src/components/MarkedInput.tsx:53](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/components/MarkedInput.tsx#L53)

Override internal components using slots

#### Example

```ts
slots={{ container: 'div', span: 'span' }}
```

***

### style?

```ts
optional style: CSSProperties;
```

Defined in: [react/markput/src/components/MarkedInput.tsx:48](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/components/MarkedInput.tsx#L48)

Additional style

***

### value?

```ts
optional value: string;
```

Defined in: [react/markput/src/components/MarkedInput.tsx:65](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/components/MarkedInput.tsx#L65)

Annotated text with markups
