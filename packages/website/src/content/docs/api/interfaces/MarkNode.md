---
editUrl: false
next: false
prev: false
title: "MarkNode"
---

Defined in: [core/src/features/tokens/tree/types.ts:275](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L275)

## Properties

### children

```ts
readonly children: Signal<readonly TreeNode[]>;
```

Defined in: [core/src/features/tokens/tree/types.ts:283](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L283)

***

### descriptor

```ts
readonly descriptor: MarkupDescriptor;
```

Defined in: [core/src/features/tokens/tree/types.ts:278](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L278)

***

### id

```ts
readonly id: number;
```

Defined in: [core/src/features/tokens/tree/types.ts:277](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L277)

***

### kind

```ts
readonly kind: "mark";
```

Defined in: [core/src/features/tokens/tree/types.ts:276](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L276)

***

### markup

```ts
readonly markup: Markup;
```

Defined in: [core/src/features/tokens/tree/types.ts:280](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L280)

The public view of the descriptor, which is not a public type.

***

### meta

```ts
readonly meta: Signal<string | undefined>;
```

Defined in: [core/src/features/tokens/tree/types.ts:282](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L282)

***

### position

```ts
position: object;
```

Defined in: [core/src/features/tokens/tree/types.ts:291](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L291)

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

Defined in: [core/src/features/tokens/tree/types.ts:290](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L290)

Live slot POSITIONS, written by adoption like `position`; `slot()` is the public read
of the slot's TEXT, which is why the two carry different names. Slot text is
deliberately NOT stored: projection, snapshot and adoption equality all derive it from
children, so a stored copy would be an unread mirror nothing resyncs.

***

### value

```ts
readonly value: Signal<string>;
```

Defined in: [core/src/features/tokens/tree/types.ts:281](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L281)

## Methods

### duplicate()

```ts
duplicate(): boolean;
```

Defined in: [core/src/features/tokens/tree/types.ts:300](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L300)

#### Returns

`boolean`

***

### insertAfter()

```ts
insertAfter(text): boolean;
```

Defined in: [core/src/features/tokens/tree/types.ts:301](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L301)

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

Defined in: [core/src/features/tokens/tree/types.ts:302](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L302)

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

Defined in: [core/src/features/tokens/tree/types.ts:295](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L295)

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

Defined in: [core/src/features/tokens/tree/types.ts:299](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L299)

See NodeCommands.

#### Returns

`boolean`

***

### slot()

```ts
slot(): string | undefined;
```

Defined in: [core/src/features/tokens/tree/types.ts:293](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L293)

The slot's TEXT, joined from the live children. `undefined` for a slotless markup.

#### Returns

`string` \| `undefined`

***

### update()

```ts
update(patch): boolean;
```

Defined in: [core/src/features/tokens/tree/types.ts:297](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L297)

Rides a transaction; `false` in read-only mode or off the tree.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `patch` | `MarkPatch` |

#### Returns

`boolean`
