---
editUrl: false
next: false
prev: false
title: "MarkedInputProps"
---

Defined in: [packages/markput/src/components/MarkedInput.tsx:28](https://github.com/Nowely/marked-input/blob/next/packages/markput/src/components/MarkedInput.tsx#L28)

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

Defined in: [packages/markput/src/components/MarkedInput.tsx:42](https://github.com/Nowely/marked-input/blob/next/packages/markput/src/components/MarkedInput.tsx#L42)

Additional classes

***

### defaultValue?

```ts
optional defaultValue: string;
```

Defined in: [packages/core/src/shared/types.ts:46](https://github.com/Nowely/marked-input/blob/next/packages/core/src/shared/types.ts#L46)

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

Defined in: [packages/markput/src/components/MarkedInput.tsx:32](https://github.com/Nowely/marked-input/blob/next/packages/markput/src/components/MarkedInput.tsx#L32)

Global component used for rendering markups (fallback for option.mark.slot)

***

### onChange()?

```ts
optional onChange: (value) => void;
```

Defined in: [packages/core/src/shared/types.ts:48](https://github.com/Nowely/marked-input/blob/next/packages/core/src/shared/types.ts#L48)

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

Defined in: [packages/markput/src/components/MarkedInput.tsx:40](https://github.com/Nowely/marked-input/blob/next/packages/markput/src/components/MarkedInput.tsx#L40)

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

Defined in: [packages/markput/src/components/MarkedInput.tsx:34](https://github.com/Nowely/marked-input/blob/next/packages/markput/src/components/MarkedInput.tsx#L34)

Global component used for rendering overlays (fallback for option.overlay.slot)

***

### readOnly?

```ts
optional readOnly: boolean;
```

Defined in: [packages/core/src/shared/types.ts:50](https://github.com/Nowely/marked-input/blob/next/packages/core/src/shared/types.ts#L50)

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

Defined in: [packages/markput/src/components/MarkedInput.tsx:30](https://github.com/Nowely/marked-input/blob/next/packages/markput/src/components/MarkedInput.tsx#L30)

Ref to handler

***

### showOverlayOn?

```ts
optional showOverlayOn: OverlayTrigger;
```

Defined in: [packages/markput/src/components/MarkedInput.tsx:61](https://github.com/Nowely/marked-input/blob/next/packages/markput/src/components/MarkedInput.tsx#L61)

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

Defined in: [packages/markput/src/components/MarkedInput.tsx:56](https://github.com/Nowely/marked-input/blob/next/packages/markput/src/components/MarkedInput.tsx#L56)

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

Defined in: [packages/markput/src/components/MarkedInput.tsx:50](https://github.com/Nowely/marked-input/blob/next/packages/markput/src/components/MarkedInput.tsx#L50)

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

Defined in: [packages/markput/src/components/MarkedInput.tsx:44](https://github.com/Nowely/marked-input/blob/next/packages/markput/src/components/MarkedInput.tsx#L44)

Additional style

***

### value?

```ts
optional value: string;
```

Defined in: [packages/core/src/shared/types.ts:44](https://github.com/Nowely/marked-input/blob/next/packages/core/src/shared/types.ts#L44)

Annotated text with markups for mark

#### Inherited from

```ts
CoreMarkputProps.value
```
