---
editUrl: false
next: false
prev: false
title: "OverlayHandler"
---

Defined in: [react/markput/src/lib/hooks/useOverlay.tsx:7](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/lib/hooks/useOverlay.tsx#L7)

## Properties

### choose()

```ts
choose: (pick) => boolean;
```

Defined in: [react/markput/src/lib/hooks/useOverlay.tsx:24](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/lib/hooks/useOverlay.tsx#L24)

The one accept path. `{option}` turns the caret's row into that option's row kind and
removes the trigger in the same splice; `{value, meta}` writes the trigger option's markup,
which is what [select](/api/interfaces/overlayhandler/#select) does.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `pick` | [`OverlayPick`](/api/type-aliases/overlaypick/) |

#### Returns

`boolean`

***

### close()

```ts
close: () => void;
```

Defined in: [react/markput/src/lib/hooks/useOverlay.tsx:12](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/lib/hooks/useOverlay.tsx#L12)

#### Returns

`void`

***

### entries

```ts
entries: readonly MenuEntry[];
```

Defined in: [react/markput/src/lib/hooks/useOverlay.tsx:18](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/lib/hooks/useOverlay.tsx#L18)

The row menu: one entry per option declaring a `menu`, already narrowed by what was typed
after the trigger. A menu component filters nothing.

***

### match

```ts
match:
  | OverlayMatch<Option<MarkProps, OverlayProps>>
  | undefined;
```

Defined in: [react/markput/src/lib/hooks/useOverlay.tsx:25](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/lib/hooks/useOverlay.tsx#L25)

***

### ref

```ts
ref: RefObject<HTMLElement | null>;
```

Defined in: [react/markput/src/lib/hooks/useOverlay.tsx:26](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/lib/hooks/useOverlay.tsx#L26)

***

### select()

```ts
select: (value) => void;
```

Defined in: [react/markput/src/lib/hooks/useOverlay.tsx:13](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/lib/hooks/useOverlay.tsx#L13)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `value` | \{ `meta?`: `string`; `value`: `string`; \} |
| `value.meta?` | `string` |
| `value.value` | `string` |

#### Returns

`void`

***

### style

```ts
style: object;
```

Defined in: [react/markput/src/lib/hooks/useOverlay.tsx:8](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/lib/hooks/useOverlay.tsx#L8)

#### left

```ts
left: number;
```

#### top

```ts
top: number;
```
