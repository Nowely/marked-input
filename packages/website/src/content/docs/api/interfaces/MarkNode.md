---
editUrl: false
next: false
prev: false
title: "MarkNode"
---

Defined in: [core/src/features/tokens/tree/types.ts:289](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L289)

## Properties

### children

```ts
readonly children: Signal<readonly TreeNode[]>;
```

Defined in: [core/src/features/tokens/tree/types.ts:297](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L297)

***

### descriptor

```ts
readonly descriptor: MarkupDescriptor;
```

Defined in: [core/src/features/tokens/tree/types.ts:292](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L292)

***

### id

```ts
readonly id: number;
```

Defined in: [core/src/features/tokens/tree/types.ts:291](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L291)

***

### kind

```ts
readonly kind: "mark";
```

Defined in: [core/src/features/tokens/tree/types.ts:290](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L290)

***

### markup

```ts
readonly markup: Markup;
```

Defined in: [core/src/features/tokens/tree/types.ts:294](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L294)

The public view of the descriptor, which is not a public type.

***

### meta

```ts
readonly meta: Signal<string | undefined>;
```

Defined in: [core/src/features/tokens/tree/types.ts:296](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L296)

***

### position

```ts
position: object;
```

Defined in: [core/src/features/tokens/tree/types.ts:305](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L305)

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

Defined in: [core/src/features/tokens/tree/types.ts:304](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L304)

Live slot POSITIONS, written by adoption like `position`; `slot()` is the public read
of the slot's TEXT, which is why the two carry different names. Slot text is
deliberately NOT stored: projection, snapshot and adoption equality all derive it from
children, so a stored copy would be an unread mirror nothing resyncs.

***

### value

```ts
readonly value: Signal<string>;
```

Defined in: [core/src/features/tokens/tree/types.ts:295](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L295)

## Methods

### duplicate()

```ts
duplicate(): boolean;
```

Defined in: [core/src/features/tokens/tree/types.ts:314](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L314)

#### Returns

`boolean`

***

### insertAfter()

```ts
insertAfter(text): boolean;
```

Defined in: [core/src/features/tokens/tree/types.ts:315](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L315)

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

Defined in: [core/src/features/tokens/tree/types.ts:316](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L316)

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

Defined in: [core/src/features/tokens/tree/types.ts:309](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L309)

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

Defined in: [core/src/features/tokens/tree/types.ts:313](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L313)

See NodeCommands.

#### Returns

`boolean`

***

### slot()

```ts
slot(): string | undefined;
```

Defined in: [core/src/features/tokens/tree/types.ts:307](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L307)

The slot's TEXT, joined from the live children. `undefined` for a slotless markup.

#### Returns

`string` \| `undefined`

***

### update()

```ts
update(patch): boolean;
```

Defined in: [core/src/features/tokens/tree/types.ts:311](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L311)

Rides a transaction; `false` in read-only mode or off the tree.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `patch` | `MarkPatch` |

#### Returns

`boolean`
