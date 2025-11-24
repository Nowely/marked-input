---
editUrl: false
next: false
prev: false
title: "OverlayHandler"
---

Defined in: [packages/markput/src/utils/hooks/useOverlay.tsx:8](https://github.com/Nowely/marked-input/blob/next/packages/markput/src/utils/hooks/useOverlay.tsx#L8)

## Properties

### close()

```ts
close: () => void;
```

Defined in: [packages/markput/src/utils/hooks/useOverlay.tsx:19](https://github.com/Nowely/marked-input/blob/next/packages/markput/src/utils/hooks/useOverlay.tsx#L19)

Used for close overlay.

#### Returns

`void`

***

### match

```ts
match: OverlayMatch<Option<MarkProps, OverlayProps>>;
```

Defined in: [packages/markput/src/utils/hooks/useOverlay.tsx:27](https://github.com/Nowely/marked-input/blob/next/packages/markput/src/utils/hooks/useOverlay.tsx#L27)

Overlay match details

***

### ref

```ts
ref: RefObject<HTMLElement>;
```

Defined in: [packages/markput/src/utils/hooks/useOverlay.tsx:28](https://github.com/Nowely/marked-input/blob/next/packages/markput/src/utils/hooks/useOverlay.tsx#L28)

***

### select()

```ts
select: (value) => void;
```

Defined in: [packages/markput/src/utils/hooks/useOverlay.tsx:23](https://github.com/Nowely/marked-input/blob/next/packages/markput/src/utils/hooks/useOverlay.tsx#L23)

Used for insert an annotation instead a triggered value.

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

Defined in: [packages/markput/src/utils/hooks/useOverlay.tsx:12](https://github.com/Nowely/marked-input/blob/next/packages/markput/src/utils/hooks/useOverlay.tsx#L12)

Style with caret absolute position. Used for placing an overlay.

#### left

```ts
left: number;
```

#### top

```ts
top: number;
```
