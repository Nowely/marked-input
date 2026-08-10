---
editUrl: false
next: false
prev: false
title: "MarkNode"
---

Defined in: [core/src/features/tokens/tree/types.ts:35](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L35)

## Properties

### children

```ts
readonly children: Signal<readonly TreeNode[]>;
```

Defined in: [core/src/features/tokens/tree/types.ts:43](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L43)

***

### descriptor

```ts
readonly descriptor: MarkupDescriptor;
```

Defined in: [core/src/features/tokens/tree/types.ts:38](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L38)

***

### id

```ts
readonly id: number;
```

Defined in: [core/src/features/tokens/tree/types.ts:37](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L37)

***

### kind

```ts
readonly kind: "mark";
```

Defined in: [core/src/features/tokens/tree/types.ts:36](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L36)

***

### markup

```ts
readonly markup: Markup;
```

Defined in: [core/src/features/tokens/tree/types.ts:40](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L40)

Spec §2.3: the public view of the descriptor, which is not a public type.

***

### meta

```ts
readonly meta: Signal<string | undefined>;
```

Defined in: [core/src/features/tokens/tree/types.ts:42](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L42)

***

### position

```ts
position: object;
```

Defined in: [core/src/features/tokens/tree/types.ts:52](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L52)

#### end

```ts
end: number;
```

#### start

```ts
start: number;
```

***

### slotRange

```ts
slotRange:
  | {
  end: number;
  start: number;
}
  | undefined;
```

Defined in: [core/src/features/tokens/tree/types.ts:51](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L51)

Live slot POSITIONS, written by adoption like `position`. Named `slotRange` since
S1.7, because `slot()` is now the public read of the slot's TEXT (spec §2.3) and one
name cannot be both. Slot text is still deliberately NOT stored: projection, snapshot
and adoption equality all derive it from children, so a stored copy would be an unread
mirror nothing resyncs.

***

### value

```ts
readonly value: Signal<string>;
```

Defined in: [core/src/features/tokens/tree/types.ts:41](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L41)

## Methods

### range()

```ts
range(): object;
```

Defined in: [core/src/features/tokens/tree/types.ts:56](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L56)

Spec §2.3. See [TextNode.range](/api/interfaces/textnode/#range).

#### Returns

`object`

##### end

```ts
end: number;
```

##### start

```ts
start: number;
```

***

### remove()

```ts
remove(): boolean;
```

Defined in: [core/src/features/tokens/tree/types.ts:59](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L59)

#### Returns

`boolean`

***

### slot()

```ts
slot(): string | undefined;
```

Defined in: [core/src/features/tokens/tree/types.ts:54](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L54)

Spec §2.3: the slot's TEXT, joined from the live children. `undefined` for a slotless markup.

#### Returns

`string` \| `undefined`

***

### update()

```ts
update(patch): boolean;
```

Defined in: [core/src/features/tokens/tree/types.ts:58](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L58)

Spec §2.3. Rides a transaction (spec D5); `false` in read-only mode or off the tree.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `patch` | [`MarkPatch`](/api/type-aliases/markpatch/) |

#### Returns

`boolean`
