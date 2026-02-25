---
editUrl: false
next: false
prev: false
title: "MarkedInputProps"
---

Defined in: [react/markput/src/components/MarkedInput.tsx:12](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/components/MarkedInput.tsx#L12)

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

Defined in: [react/markput/src/components/MarkedInput.tsx:17](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/components/MarkedInput.tsx#L17)

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

Defined in: [react/markput/src/components/MarkedInput.tsx:14](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/components/MarkedInput.tsx#L14)

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

Defined in: [react/markput/src/components/MarkedInput.tsx:16](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/components/MarkedInput.tsx#L16)

Configuration options for markups and overlays

#### Overrides

```ts
CoreMarkputProps.options
```

***

### Overlay?

```ts
optional Overlay: ComponentType<TOverlayProps>;
```

Defined in: [react/markput/src/components/MarkedInput.tsx:15](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/components/MarkedInput.tsx#L15)

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
optional ref: Ref<MarkedInputHandler>;
```

Defined in: [react/markput/src/components/MarkedInput.tsx:13](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/components/MarkedInput.tsx#L13)

***

### showOverlayOn?

```ts
optional showOverlayOn: OverlayTrigger;
```

Defined in: [react/markput/src/components/MarkedInput.tsx:21](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/components/MarkedInput.tsx#L21)

Events that trigger overlay display

#### Overrides

```ts
CoreMarkputProps.showOverlayOn
```

***

### slotProps?

```ts
optional slotProps: SlotProps;
```

Defined in: [react/markput/src/components/MarkedInput.tsx:20](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/components/MarkedInput.tsx#L20)

***

### slots?

```ts
optional slots: Slots;
```

Defined in: [react/markput/src/components/MarkedInput.tsx:19](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/components/MarkedInput.tsx#L19)

***

### style?

```ts
optional style: CSSProperties;
```

Defined in: [react/markput/src/components/MarkedInput.tsx:18](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/components/MarkedInput.tsx#L18)

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
