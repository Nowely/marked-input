---
editUrl: false
next: false
prev: false
title: "MarkNode"
---

Defined in: [core/src/features/tokens/tree/types.ts:40](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L40)

## Properties

### children

```ts
readonly children: Signal<readonly TreeNode[]>;
```

Defined in: [core/src/features/tokens/tree/types.ts:48](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L48)

***

### descriptor

```ts
readonly descriptor: MarkupDescriptor;
```

Defined in: [core/src/features/tokens/tree/types.ts:43](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L43)

***

### id

```ts
readonly id: number;
```

Defined in: [core/src/features/tokens/tree/types.ts:42](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L42)

***

### kind

```ts
readonly kind: "mark";
```

Defined in: [core/src/features/tokens/tree/types.ts:41](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L41)

***

### markup

```ts
readonly markup: Markup;
```

Defined in: [core/src/features/tokens/tree/types.ts:45](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L45)

The public view of the descriptor, which is not a public type.

***

### meta

```ts
readonly meta: Signal<string | undefined>;
```

Defined in: [core/src/features/tokens/tree/types.ts:47](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L47)

***

### position

```ts
position: object;
```

Defined in: [core/src/features/tokens/tree/types.ts:56](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L56)

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

Defined in: [core/src/features/tokens/tree/types.ts:55](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L55)

Live slot POSITIONS, written by adoption like `position`; `slot()` is the public read
of the slot's TEXT, which is why the two carry different names. Slot text is
deliberately NOT stored: projection, snapshot and adoption equality all derive it from
children, so a stored copy would be an unread mirror nothing resyncs.

***

### value

```ts
readonly value: Signal<string>;
```

Defined in: [core/src/features/tokens/tree/types.ts:46](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L46)

## Methods

### duplicate()

```ts
duplicate(): boolean;
```

Defined in: [core/src/features/tokens/tree/types.ts:65](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L65)

#### Returns

`boolean`

***

### insertAfter()

```ts
insertAfter(text): boolean;
```

Defined in: [core/src/features/tokens/tree/types.ts:66](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L66)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `text` | `string` |

#### Returns

`boolean`

***

### mergeWith()

```ts
mergeWith(next): boolean;
```

Defined in: [core/src/features/tokens/tree/types.ts:67](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L67)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `next` | [`TreeNode`](/api/type-aliases/treenode/) |

#### Returns

`boolean`

***

### range()

```ts
range(): object;
```

Defined in: [core/src/features/tokens/tree/types.ts:60](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L60)

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

Defined in: [core/src/features/tokens/tree/types.ts:64](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L64)

See NodeCommands.

#### Returns

`boolean`

***

### slot()

```ts
slot(): string | undefined;
```

Defined in: [core/src/features/tokens/tree/types.ts:58](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L58)

The slot's TEXT, joined from the live children. `undefined` for a slotless markup.

#### Returns

`string` \| `undefined`

***

### update()

```ts
update(patch): boolean;
```

Defined in: [core/src/features/tokens/tree/types.ts:62](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L62)

Rides a transaction; `false` in read-only mode or off the tree.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `patch` | [`MarkPatch`](/api/type-aliases/markpatch/) |

#### Returns

`boolean`
