---
editUrl: false
next: false
prev: false
title: "MarkNode"
---

Defined in: [core/src/features/tokens/tree/types.ts:213](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L213)

## Properties

### children

```ts
readonly children: Signal<readonly TreeNode[]>;
```

Defined in: [core/src/features/tokens/tree/types.ts:221](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L221)

***

### descriptor

```ts
readonly descriptor: MarkupDescriptor;
```

Defined in: [core/src/features/tokens/tree/types.ts:216](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L216)

***

### id

```ts
readonly id: number;
```

Defined in: [core/src/features/tokens/tree/types.ts:215](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L215)

***

### kind

```ts
readonly kind: "mark";
```

Defined in: [core/src/features/tokens/tree/types.ts:214](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L214)

***

### markup

```ts
readonly markup: Markup;
```

Defined in: [core/src/features/tokens/tree/types.ts:218](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L218)

The public view of the descriptor, which is not a public type.

***

### meta

```ts
readonly meta: Signal<string | undefined>;
```

Defined in: [core/src/features/tokens/tree/types.ts:220](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L220)

***

### position

```ts
position: object;
```

Defined in: [core/src/features/tokens/tree/types.ts:229](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L229)

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

Defined in: [core/src/features/tokens/tree/types.ts:228](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L228)

Live slot POSITIONS, written by adoption like `position`; `slot()` is the public read
of the slot's TEXT, which is why the two carry different names. Slot text is
deliberately NOT stored: projection, snapshot and adoption equality all derive it from
children, so a stored copy would be an unread mirror nothing resyncs.

***

### value

```ts
readonly value: Signal<string>;
```

Defined in: [core/src/features/tokens/tree/types.ts:219](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L219)

## Methods

### duplicate()

```ts
duplicate(): boolean;
```

Defined in: [core/src/features/tokens/tree/types.ts:238](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L238)

#### Returns

`boolean`

***

### insertAfter()

```ts
insertAfter(text): boolean;
```

Defined in: [core/src/features/tokens/tree/types.ts:239](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L239)

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

Defined in: [core/src/features/tokens/tree/types.ts:240](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L240)

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

Defined in: [core/src/features/tokens/tree/types.ts:233](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L233)

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

Defined in: [core/src/features/tokens/tree/types.ts:237](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L237)

See NodeCommands.

#### Returns

`boolean`

***

### slot()

```ts
slot(): string | undefined;
```

Defined in: [core/src/features/tokens/tree/types.ts:231](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L231)

The slot's TEXT, joined from the live children. `undefined` for a slotless markup.

#### Returns

`string` \| `undefined`

***

### update()

```ts
update(patch): boolean;
```

Defined in: [core/src/features/tokens/tree/types.ts:235](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L235)

Rides a transaction; `false` in read-only mode or off the tree.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `patch` | `MarkPatch` |

#### Returns

`boolean`
