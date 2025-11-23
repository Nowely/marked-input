---
editUrl: false
next: false
prev: false
title: "MarkedInputProps"
---

Defined in: [markput/src/components/MarkedInput.tsx:38](https://github.com/Nowely/marked-input/blob/aae09b7351f8965355f759c8665c77d5cadbc14f/packages/markput/src/components/MarkedInput.tsx#L38)

Props for MarkedInput component with hierarchical type support.

Type parameters:
- `TMarkProps` - Type of props for the global Mark component (default: MarkProps)
- `TOverlayProps` - Type of props for the global Overlay component (default: OverlayProps)

The global Mark and Overlay components serve as defaults when options don't specify
their own slot components. Each option can override these with option.slots.

Default types:
- TMarkProps = MarkProps: Type-safe base props (value, meta, nested, children)
- TOverlayProps = OverlayProps: Type-safe overlay props (trigger, data)

## Example

```typescript
// Using global Mark component with custom props type
interface ButtonProps { label: string; onClick: () => void }
<MarkedInput<ButtonProps>
  Mark={Button}
  options={[{
    markup: '@[__value__]',
    slotProps: { mark: { label: 'Click me', onClick: () => {} } }
  }]}
/>
```

## Extends

- `CoreMarkputProps`

## Type Parameters

| Type Parameter | Default type |
| ------ | ------ |
| `TMarkProps` | [`MarkProps`](/api/interfaces/markprops/) |
| `TOverlayProps` | [`OverlayProps`](/api/interfaces/overlayprops/) |

## Properties

### className?

```ts
optional className: string;
```

Defined in: [markput/src/components/MarkedInput.tsx:53](https://github.com/Nowely/marked-input/blob/aae09b7351f8965355f759c8665c77d5cadbc14f/packages/markput/src/components/MarkedInput.tsx#L53)

Additional classes

***

### defaultValue?

```ts
optional defaultValue: string;
```

Defined in: [core/src/shared/types.ts:46](https://github.com/Nowely/marked-input/blob/aae09b7351f8965355f759c8665c77d5cadbc14f/packages/core/src/shared/types.ts#L46)

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

Defined in: [markput/src/components/MarkedInput.tsx:42](https://github.com/Nowely/marked-input/blob/aae09b7351f8965355f759c8665c77d5cadbc14f/packages/markput/src/components/MarkedInput.tsx#L42)

Global component used for rendering markups (fallback for option.slots.mark)

***

### onChange()?

```ts
optional onChange: (value) => void;
```

Defined in: [core/src/shared/types.ts:48](https://github.com/Nowely/marked-input/blob/aae09b7351f8965355f759c8665c77d5cadbc14f/packages/core/src/shared/types.ts#L48)

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

Defined in: [markput/src/components/MarkedInput.tsx:51](https://github.com/Nowely/marked-input/blob/aae09b7351f8965355f759c8665c77d5cadbc14f/packages/markput/src/components/MarkedInput.tsx#L51)

Configuration options for markups and overlays.
Each option can specify its own slot components and props via option.slots and option.slotProps.
Falls back to global Mark/Overlay components when not specified.

#### Default

```ts
[{overlayTrigger: '@', markup: '@[__label__](__value__)', data: []}]
```

#### Overrides

```ts
CoreMarkputProps.options
```

***

### Overlay?

```ts
optional Overlay: ComponentType<TOverlayProps>;
```

Defined in: [markput/src/components/MarkedInput.tsx:44](https://github.com/Nowely/marked-input/blob/aae09b7351f8965355f759c8665c77d5cadbc14f/packages/markput/src/components/MarkedInput.tsx#L44)

Global component used for rendering overlays like suggestions, mentions, etc (fallback for option.slots.overlay)

***

### readOnly?

```ts
optional readOnly: boolean;
```

Defined in: [core/src/shared/types.ts:50](https://github.com/Nowely/marked-input/blob/aae09b7351f8965355f759c8665c77d5cadbc14f/packages/core/src/shared/types.ts#L50)

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

Defined in: [markput/src/components/MarkedInput.tsx:40](https://github.com/Nowely/marked-input/blob/aae09b7351f8965355f759c8665c77d5cadbc14f/packages/markput/src/components/MarkedInput.tsx#L40)

Ref to handler

***

### showOverlayOn?

```ts
optional showOverlayOn: OverlayTrigger;
```

Defined in: [markput/src/components/MarkedInput.tsx:72](https://github.com/Nowely/marked-input/blob/aae09b7351f8965355f759c8665c77d5cadbc14f/packages/markput/src/components/MarkedInput.tsx#L72)

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

Defined in: [markput/src/components/MarkedInput.tsx:67](https://github.com/Nowely/marked-input/blob/aae09b7351f8965355f759c8665c77d5cadbc14f/packages/markput/src/components/MarkedInput.tsx#L67)

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

Defined in: [markput/src/components/MarkedInput.tsx:61](https://github.com/Nowely/marked-input/blob/aae09b7351f8965355f759c8665c77d5cadbc14f/packages/markput/src/components/MarkedInput.tsx#L61)

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

Defined in: [markput/src/components/MarkedInput.tsx:55](https://github.com/Nowely/marked-input/blob/aae09b7351f8965355f759c8665c77d5cadbc14f/packages/markput/src/components/MarkedInput.tsx#L55)

Additional style

***

### value?

```ts
optional value: string;
```

Defined in: [core/src/shared/types.ts:44](https://github.com/Nowely/marked-input/blob/aae09b7351f8965355f759c8665c77d5cadbc14f/packages/core/src/shared/types.ts#L44)

Annotated text with markups for mark

#### Inherited from

```ts
CoreMarkputProps.value
```
