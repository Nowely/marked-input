---
editUrl: false
next: false
prev: false
title: "MarkNode"
---

Defined in: [core/src/features/tokens/tree/types.ts:191](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L191)

## Properties

### children

```ts
readonly children: Signal<readonly TreeNode[]>;
```

Defined in: [core/src/features/tokens/tree/types.ts:199](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L199)

***

### descriptor

```ts
readonly descriptor: MarkupDescriptor;
```

Defined in: [core/src/features/tokens/tree/types.ts:194](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L194)

***

### id

```ts
readonly id: number;
```

Defined in: [core/src/features/tokens/tree/types.ts:193](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L193)

***

### kind

```ts
readonly kind: "mark";
```

Defined in: [core/src/features/tokens/tree/types.ts:192](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L192)

***

### markup

```ts
readonly markup: Markup;
```

Defined in: [core/src/features/tokens/tree/types.ts:196](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L196)

The public view of the descriptor, which is not a public type.

***

### meta

```ts
readonly meta: Signal<string | undefined>;
```

Defined in: [core/src/features/tokens/tree/types.ts:198](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L198)

***

### position

```ts
position: object;
```

Defined in: [core/src/features/tokens/tree/types.ts:207](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L207)

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

Defined in: [core/src/features/tokens/tree/types.ts:206](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L206)

Live slot POSITIONS, written by adoption like `position`; `slot()` is the public read
of the slot's TEXT, which is why the two carry different names. Slot text is
deliberately NOT stored: projection, snapshot and adoption equality all derive it from
children, so a stored copy would be an unread mirror nothing resyncs.

***

### value

```ts
readonly value: Signal<string>;
```

Defined in: [core/src/features/tokens/tree/types.ts:197](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L197)

## Methods

### duplicate()

```ts
duplicate(): boolean;
```

Defined in: [core/src/features/tokens/tree/types.ts:216](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L216)

#### Returns

`boolean`

***

### insertAfter()

```ts
insertAfter(text): boolean;
```

Defined in: [core/src/features/tokens/tree/types.ts:217](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L217)

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

Defined in: [core/src/features/tokens/tree/types.ts:218](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L218)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `next` | [`TreeNode`](/api/type-aliases/treenode/) |

#### Returns

`boolean`

***

### moveTo()

```ts
moveTo(index): boolean;
```

Defined in: [core/src/features/tokens/tree/types.ts:219](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L219)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `index` | `number` |

#### Returns

`boolean`

***

### range()

```ts
range(): object;
```

Defined in: [core/src/features/tokens/tree/types.ts:211](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L211)

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

Defined in: [core/src/features/tokens/tree/types.ts:215](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L215)

See NodeCommands.

#### Returns

`boolean`

***

### slot()

```ts
slot(): string | undefined;
```

Defined in: [core/src/features/tokens/tree/types.ts:209](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L209)

The slot's TEXT, joined from the live children. `undefined` for a slotless markup.

#### Returns

`string` \| `undefined`

***

### update()

```ts
update(patch): boolean;
```

Defined in: [core/src/features/tokens/tree/types.ts:213](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L213)

Rides a transaction; `false` in read-only mode or off the tree.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `patch` | `MarkPatch` |

#### Returns

`boolean`
