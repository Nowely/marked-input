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

Defined in: [react/markput/src/lib/hooks/useOverlay.tsx:29](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/lib/hooks/useOverlay.tsx#L29)

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

Defined in: [react/markput/src/lib/hooks/useOverlay.tsx:30](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/lib/hooks/useOverlay.tsx#L30)

***

### mode

```ts
mode: "insert" | "turnInto" | undefined;
```

Defined in: [react/markput/src/lib/hooks/useOverlay.tsx:23](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/lib/hooks/useOverlay.tsx#L23)

Which gesture choosing an entry is on THIS row — `'insert'` on a row holding only the
trigger, `'turnInto'` on a row with text. A label: `choose` runs the same splice either way.

***

### ref

```ts
ref: RefObject<HTMLElement | null>;
```

Defined in: [react/markput/src/lib/hooks/useOverlay.tsx:31](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/lib/hooks/useOverlay.tsx#L31)

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
