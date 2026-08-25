---
editUrl: false
next: false
prev: false
title: "MarkNode"
---

Defined in: [core/src/features/tokens/tree/types.ts:227](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L227)

## Properties

### children

```ts
readonly children: Signal<readonly TreeNode[]>;
```

Defined in: [core/src/features/tokens/tree/types.ts:235](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L235)

***

### descriptor

```ts
readonly descriptor: MarkupDescriptor;
```

Defined in: [core/src/features/tokens/tree/types.ts:230](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L230)

***

### id

```ts
readonly id: number;
```

Defined in: [core/src/features/tokens/tree/types.ts:229](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L229)

***

### kind

```ts
readonly kind: "mark";
```

Defined in: [core/src/features/tokens/tree/types.ts:228](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L228)

***

### markup

```ts
readonly markup: Markup;
```

Defined in: [core/src/features/tokens/tree/types.ts:232](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L232)

The public view of the descriptor, which is not a public type.

***

### meta

```ts
readonly meta: Signal<string | undefined>;
```

Defined in: [core/src/features/tokens/tree/types.ts:234](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L234)

***

### position

```ts
position: object;
```

Defined in: [core/src/features/tokens/tree/types.ts:243](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L243)

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

Defined in: [core/src/features/tokens/tree/types.ts:242](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L242)

Live slot POSITIONS, written by adoption like `position`; `slot()` is the public read
of the slot's TEXT, which is why the two carry different names. Slot text is
deliberately NOT stored: projection, snapshot and adoption equality all derive it from
children, so a stored copy would be an unread mirror nothing resyncs.

***

### value

```ts
readonly value: Signal<string>;
```

Defined in: [core/src/features/tokens/tree/types.ts:233](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L233)

## Methods

### duplicate()

```ts
duplicate(): boolean;
```

Defined in: [core/src/features/tokens/tree/types.ts:252](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L252)

#### Returns

`boolean`

***

### insertAfter()

```ts
insertAfter(text): boolean;
```

Defined in: [core/src/features/tokens/tree/types.ts:253](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L253)

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

Defined in: [core/src/features/tokens/tree/types.ts:254](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L254)

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

Defined in: [core/src/features/tokens/tree/types.ts:247](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L247)

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

Defined in: [core/src/features/tokens/tree/types.ts:251](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L251)

See NodeCommands.

#### Returns

`boolean`

***

### slot()

```ts
slot(): string | undefined;
```

Defined in: [core/src/features/tokens/tree/types.ts:245](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L245)

The slot's TEXT, joined from the live children. `undefined` for a slotless markup.

#### Returns

`string` \| `undefined`

***

### update()

```ts
update(patch): boolean;
```

Defined in: [core/src/features/tokens/tree/types.ts:249](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L249)

Rides a transaction; `false` in read-only mode or off the tree.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `patch` | `MarkPatch` |

#### Returns

`boolean`
