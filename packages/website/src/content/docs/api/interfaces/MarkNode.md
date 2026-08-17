---
editUrl: false
next: false
prev: false
title: "MarkNode"
---

Defined in: [core/src/features/tokens/tree/types.ts:37](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L37)

## Properties

### children

```ts
readonly children: Signal<readonly TreeNode[]>;
```

Defined in: [core/src/features/tokens/tree/types.ts:45](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L45)

***

### descriptor

```ts
readonly descriptor: MarkupDescriptor;
```

Defined in: [core/src/features/tokens/tree/types.ts:40](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L40)

***

### id

```ts
readonly id: number;
```

Defined in: [core/src/features/tokens/tree/types.ts:39](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L39)

***

### kind

```ts
readonly kind: "mark";
```

Defined in: [core/src/features/tokens/tree/types.ts:38](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L38)

***

### markup

```ts
readonly markup: Markup;
```

Defined in: [core/src/features/tokens/tree/types.ts:42](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L42)

The public view of the descriptor, which is not a public type.

***

### meta

```ts
readonly meta: Signal<string | undefined>;
```

Defined in: [core/src/features/tokens/tree/types.ts:44](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L44)

***

### position

```ts
position: object;
```

Defined in: [core/src/features/tokens/tree/types.ts:53](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L53)

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

Defined in: [core/src/features/tokens/tree/types.ts:52](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L52)

Live slot POSITIONS, written by adoption like `position`; `slot()` is the public read
of the slot's TEXT, which is why the two carry different names. Slot text is
deliberately NOT stored: projection, snapshot and adoption equality all derive it from
children, so a stored copy would be an unread mirror nothing resyncs.

***

### value

```ts
readonly value: Signal<string>;
```

Defined in: [core/src/features/tokens/tree/types.ts:43](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L43)

## Methods

### range()

```ts
range(): object;
```

Defined in: [core/src/features/tokens/tree/types.ts:57](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L57)

See [TextNode.range](/api/interfaces/textnode/#range).

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

Defined in: [core/src/features/tokens/tree/types.ts:60](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L60)

#### Returns

`boolean`

***

### slot()

```ts
slot(): string | undefined;
```

Defined in: [core/src/features/tokens/tree/types.ts:55](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L55)

The slot's TEXT, joined from the live children. `undefined` for a slotless markup.

#### Returns

`string` \| `undefined`

***

### update()

```ts
update(patch): boolean;
```

Defined in: [core/src/features/tokens/tree/types.ts:59](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L59)

Rides a transaction; `false` in read-only mode or off the tree.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `patch` | [`MarkPatch`](/api/type-aliases/markpatch/) |

#### Returns

`boolean`
