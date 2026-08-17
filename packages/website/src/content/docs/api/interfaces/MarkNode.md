---
editUrl: false
next: false
prev: false
title: "MarkNode"
---

Defined in: [core/src/features/tokens/tree/types.ts:39](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L39)

## Properties

### children

```ts
readonly children: Signal<readonly TreeNode[]>;
```

Defined in: [core/src/features/tokens/tree/types.ts:47](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L47)

***

### descriptor

```ts
readonly descriptor: MarkupDescriptor;
```

Defined in: [core/src/features/tokens/tree/types.ts:42](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L42)

***

### id

```ts
readonly id: number;
```

Defined in: [core/src/features/tokens/tree/types.ts:41](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L41)

***

### kind

```ts
readonly kind: "mark";
```

Defined in: [core/src/features/tokens/tree/types.ts:40](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L40)

***

### markup

```ts
readonly markup: Markup;
```

Defined in: [core/src/features/tokens/tree/types.ts:44](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L44)

The public view of the descriptor, which is not a public type.

***

### meta

```ts
readonly meta: Signal<string | undefined>;
```

Defined in: [core/src/features/tokens/tree/types.ts:46](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L46)

***

### position

```ts
position: object;
```

Defined in: [core/src/features/tokens/tree/types.ts:55](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L55)

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

Defined in: [core/src/features/tokens/tree/types.ts:54](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L54)

Live slot POSITIONS, written by adoption like `position`; `slot()` is the public read
of the slot's TEXT, which is why the two carry different names. Slot text is
deliberately NOT stored: projection, snapshot and adoption equality all derive it from
children, so a stored copy would be an unread mirror nothing resyncs.

***

### value

```ts
readonly value: Signal<string>;
```

Defined in: [core/src/features/tokens/tree/types.ts:45](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L45)

## Methods

### duplicate()

```ts
duplicate(): boolean;
```

Defined in: [core/src/features/tokens/tree/types.ts:64](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L64)

#### Returns

`boolean`

***

### insertAfter()

```ts
insertAfter(text): boolean;
```

Defined in: [core/src/features/tokens/tree/types.ts:65](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L65)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `text` | `string` |

#### Returns

`boolean`

***

### range()

```ts
range(): object;
```

Defined in: [core/src/features/tokens/tree/types.ts:59](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L59)

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

Defined in: [core/src/features/tokens/tree/types.ts:63](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L63)

See NodeCommands.

#### Returns

`boolean`

***

### slot()

```ts
slot(): string | undefined;
```

Defined in: [core/src/features/tokens/tree/types.ts:57](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L57)

The slot's TEXT, joined from the live children. `undefined` for a slotless markup.

#### Returns

`string` \| `undefined`

***

### update()

```ts
update(patch): boolean;
```

Defined in: [core/src/features/tokens/tree/types.ts:61](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L61)

Rides a transaction; `false` in read-only mode or off the tree.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `patch` | [`MarkPatch`](/api/type-aliases/markpatch/) |

#### Returns

`boolean`
