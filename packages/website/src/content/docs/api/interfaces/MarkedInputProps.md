---
editUrl: false
next: false
prev: false
title: "MarkedInputProps"
---

Defined in: [react/markput/src/components/MarkedInput.tsx:27](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/components/MarkedInput.tsx#L27)

Props for MarkedInput component.

## Example

```typescript
<MarkedInput<ChipProps>
  Mark={Chip}
  options={[{
    markup: '@[__value__]',
    mark: { label: 'Click me' }
  }]}
/>
```

## Extends

- `CoreMarkputProps`

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

Defined in: [react/markput/src/components/MarkedInput.tsx:41](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/components/MarkedInput.tsx#L41)

Additional classes

***

### defaultValue?

```ts
optional defaultValue: string;
```

Defined in: [common/core/src/shared/types.ts:46](https://github.com/Nowely/marked-input/blob/next/packages/common/core/src/shared/types.ts#L46)

Default value

#### Inherited from

```ts
CoreMarkputProps.defaultValue
```

***

### Mark?

```ts
optional Mark: ComponentType<TMarkProps>;
```

Defined in: [react/markput/src/components/MarkedInput.tsx:31](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/components/MarkedInput.tsx#L31)

Global component used for rendering markups (fallback for option.mark.slot)

***

### onChange()?

```ts
optional onChange: (value) => void;
```

Defined in: [common/core/src/shared/types.ts:48](https://github.com/Nowely/marked-input/blob/next/packages/common/core/src/shared/types.ts#L48)

Change event handler

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `value` | `string` |

#### Returns

`void`

#### Inherited from

```ts
CoreMarkputProps.onChange
```

***

### options?

```ts
optional options: Option<TMarkProps, TOverlayProps>[];
```

Defined in: [react/markput/src/components/MarkedInput.tsx:39](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/components/MarkedInput.tsx#L39)

Configuration options for markups and overlays.
Each option can specify its own slot component via mark.slot or overlay.slot.
Falls back to global Mark/Overlay components when not specified.

#### Overrides

```ts
CoreMarkputProps.options
```

***

### Overlay?

```ts
optional Overlay: ComponentType<TOverlayProps>;
```

Defined in: [react/markput/src/components/MarkedInput.tsx:33](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/components/MarkedInput.tsx#L33)

Global component used for rendering overlays (fallback for option.overlay.slot)

***

### readOnly?

```ts
optional readOnly: boolean;
```

Defined in: [common/core/src/shared/types.ts:50](https://github.com/Nowely/marked-input/blob/next/packages/common/core/src/shared/types.ts#L50)

Prevents from changing the value

#### Inherited from

```ts
CoreMarkputProps.readOnly
```

***

### ref?

```ts
optional ref: ForwardedRef<MarkedInputHandler>;
```

Defined in: [react/markput/src/components/MarkedInput.tsx:29](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/components/MarkedInput.tsx#L29)

Ref to handler

***

### showOverlayOn?

```ts
optional showOverlayOn: OverlayTrigger;
```

Defined in: [react/markput/src/components/MarkedInput.tsx:60](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/components/MarkedInput.tsx#L60)

Events that trigger overlay display

#### Default

```ts
'change'
```

#### Overrides

```ts
CoreMarkputProps.showOverlayOn
```

***

### slotProps?

```ts
optional slotProps: SlotProps;
```

Defined in: [react/markput/src/components/MarkedInput.tsx:55](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/components/MarkedInput.tsx#L55)

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

Defined in: [react/markput/src/components/MarkedInput.tsx:49](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/components/MarkedInput.tsx#L49)

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

Defined in: [react/markput/src/components/MarkedInput.tsx:43](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/components/MarkedInput.tsx#L43)

Additional style

***

### value?

```ts
optional value: string;
```

Defined in: [common/core/src/shared/types.ts:44](https://github.com/Nowely/marked-input/blob/next/packages/common/core/src/shared/types.ts#L44)

Annotated text with markups for mark

#### Inherited from

```ts
CoreMarkputProps.value
```
