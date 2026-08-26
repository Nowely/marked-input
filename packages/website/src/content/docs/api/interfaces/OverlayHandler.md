---
editUrl: false
next: false
prev: false
title: "OverlayHandler"
---

Defined in: [react/markput/src/lib/hooks/useOverlay.tsx:7](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/lib/hooks/useOverlay.tsx#L7)

## Properties

### activate()

```ts
activate: () => () => void;
```

Defined in: [react/markput/src/lib/hooks/useOverlay.tsx:29](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/lib/hooks/useOverlay.tsx#L29)

Bind the list's keyboard protocol — arrows move the highlight, Enter chooses — to the
editing host, and return the unbind. OPT-IN, because an overlay that is not a list must not
swallow those keys: the built-in component calls it on mount, and a custom one calls it to
get the same contract.

#### Returns

```ts
(): void;
```

##### Returns

`void`

***

### active

```ts
active: number;
```

Defined in: [react/markput/src/lib/hooks/useOverlay.tsx:22](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/lib/hooks/useOverlay.tsx#L22)

Index into [OverlayHandler.rows](/api/interfaces/overlayhandler/#rows) of the highlighted row; NaN when none is.

***

### choose()

```ts
choose: (pick) => boolean;
```

Defined in: [react/markput/src/lib/hooks/useOverlay.tsx:35](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/lib/hooks/useOverlay.tsx#L35)

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

### match

```ts
match:
  | OverlayMatch<Option<MarkProps, OverlayProps>>
  | undefined;
```

Defined in: [react/markput/src/lib/hooks/useOverlay.tsx:36](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/lib/hooks/useOverlay.tsx#L36)

***

### ref

```ts
ref: RefObject<HTMLElement | null>;
```

Defined in: [react/markput/src/lib/hooks/useOverlay.tsx:37](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/lib/hooks/useOverlay.tsx#L37)

***

### rows

```ts
rows: readonly OverlayRow[];
```

Defined in: [react/markput/src/lib/hooks/useOverlay.tsx:20](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/lib/hooks/useOverlay.tsx#L20)

THE LIST the open overlay offers, already narrowed by what was typed after the trigger: the
matched option's `overlay.data` when it declares any, and the ROW MENU — every option
carrying a `menu` — when it declares none. An overlay component filters nothing and knows
neither source; it paints `label` and hands `pick` back to [OverlayHandler.choose](/api/interfaces/overlayhandler/#choose).

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
