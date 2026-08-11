---
editUrl: false
next: false
prev: false
title: "MarkputApi"
---

Defined in: [core/src/store/MarkputApi.ts:26](https://github.com/Nowely/marked-input/blob/next/packages/core/src/store/MarkputApi.ts#L26)

THE public surface (spec §2.3). The evolved `MarkputHandler`: it keeps `container`,
absorbs `focus()`, drops the consumer-free `overlay` getter, and gains the live node
reads, the model-centric write verbs, node-anchored selection and the `changed` payload.

It owns nothing. Every member lowers onto a state owner — the token layer for reads and
writes, the selection controller for anchors — so the shape of the API can move without
moving state (AGENTS.md's one-owner rule).

## Constructors

### Constructor

```ts
new MarkputApi(
   host,
   props,
   tokens,
   selectionController): MarkputApi;
```

Defined in: [core/src/store/MarkputApi.ts:27](https://github.com/Nowely/marked-input/blob/next/packages/core/src/store/MarkputApi.ts#L27)

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `host` | `Host` | - |
| `props` | `PropsModel` | - |
| `tokens` | `TokenModel` | - |
| `selectionController` | `SelectionController` | NAMED `selectionController`, not `selection`: this class has a `selection(): {anchor, head} | undefined` method, and TypeScript rejects a parameter property colliding with a member (TS2300) — the same collision `TokenModel` documents for its own `selectionPort`. |

#### Returns

`MarkputApi`

## Accessors

### changed

#### Get Signature

```ts
get changed(): Event<TokenDelta>;
```

Defined in: [core/src/store/MarkputApi.ts:71](https://github.com/Nowely/marked-input/blob/next/packages/core/src/store/MarkputApi.ts#L71)

Fires once per commit, after the DOM is consistent (spec §2.3; D9's fold merging).

##### Returns

`Event`\<`TokenDelta`\>

***

### container

#### Get Signature

```ts
get container(): HTMLElement | null;
```

Defined in: [core/src/store/MarkputApi.ts:40](https://github.com/Nowely/marked-input/blob/next/packages/core/src/store/MarkputApi.ts#L40)

##### Returns

`HTMLElement` \| `null`

## Methods

### caret()

```ts
caret(at): boolean;
```

Defined in: [core/src/store/MarkputApi.ts:129](https://github.com/Nowely/marked-input/blob/next/packages/core/src/store/MarkputApi.ts#L129)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `at` | [`NodeAnchor`](/api/type-aliases/nodeanchor/) |

#### Returns

`boolean`

***

### find()

```ts
find(id): TreeNode | undefined;
```

Defined in: [core/src/store/MarkputApi.ts:66](https://github.com/Nowely/marked-input/blob/next/packages/core/src/store/MarkputApi.ts#L66)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `id` | `number` |

#### Returns

[`TreeNode`](/api/type-aliases/treenode/) \| `undefined`

***

### focus()

```ts
focus(): void;
```

Defined in: [core/src/store/MarkputApi.ts:114](https://github.com/Nowely/marked-input/blob/next/packages/core/src/store/MarkputApi.ts#L114)

#### Returns

`void`

***

### insertMark()

```ts
insertMark(at, init): MarkNode | undefined;
```

Defined in: [core/src/store/MarkputApi.ts:81](https://github.com/Nowely/marked-input/blob/next/packages/core/src/store/MarkputApi.ts#L81)

Returns the fresh node in uncontrolled mode and `undefined` in controlled mode (spec D6:
the node exists only once the parent's echo commits — a caller re-finds it from
`changed`). `'caret'` means the selection's START in document order and yields
`undefined` when there is no selection (spec §2.3).

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `at` | [`NodeAnchor`](/api/type-aliases/nodeanchor/) \| `"caret"` |
| `init` | `MarkInit` |

#### Returns

[`MarkNode`](/api/interfaces/marknode/) \| `undefined`

***

### nodes()

```ts
nodes(): readonly TreeNode[];
```

Defined in: [core/src/store/MarkputApi.ts:62](https://github.com/Nowely/marked-input/blob/next/packages/core/src/store/MarkputApi.ts#L62)

The live root nodes, reactive (spec §2.3, D11). Ids are always present.

#### Returns

readonly [`TreeNode`](/api/type-aliases/treenode/)[]

***

### replaceRange()

```ts
replaceRange(
   from,
   to,
   text): boolean;
```

Defined in: [core/src/store/MarkputApi.ts:100](https://github.com/Nowely/marked-input/blob/next/packages/core/src/store/MarkputApi.ts#L100)

Cross-node (spec D5). The pair is normalized, so `from` after `to` is legal.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `from` | [`NodeAnchor`](/api/type-aliases/nodeanchor/) |
| `to` | [`NodeAnchor`](/api/type-aliases/nodeanchor/) |
| `text` | `string` |

#### Returns

`boolean`

***

### replaceText()

```ts
replaceText(target, text): boolean;
```

Defined in: [core/src/store/MarkputApi.ts:95](https://github.com/Nowely/marked-input/blob/next/packages/core/src/store/MarkputApi.ts#L95)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `target` | \{ `end`: `number`; `node`: [`TextNode`](/api/interfaces/textnode/); `start`: `number`; \} |
| `target.end` | `number` |
| `target.node` | [`TextNode`](/api/interfaces/textnode/) |
| `target.start` | `number` |
| `text` | `string` |

#### Returns

`boolean`

***

### select()

```ts
select(anchor, head?): boolean;
```

Defined in: [core/src/store/MarkputApi.ts:123](https://github.com/Nowely/marked-input/blob/next/packages/core/src/store/MarkputApi.ts#L123)

#### Parameters

| Parameter | Type | Default value |
| ------ | ------ | ------ |
| `anchor` | [`NodeAnchor`](/api/type-aliases/nodeanchor/) | `undefined` |
| `head` | [`NodeAnchor`](/api/type-aliases/nodeanchor/) | `anchor` |

#### Returns

`boolean`

***

### selection()

```ts
selection():
  | {
  anchor: NodeAnchor;
  head: NodeAnchor;
}
  | undefined;
```

Defined in: [core/src/store/MarkputApi.ts:119](https://github.com/Nowely/marked-input/blob/next/packages/core/src/store/MarkputApi.ts#L119)

The STORED anchors (spec D7), not the derived numbers. Reactive.

#### Returns

  \| \{
  `anchor`: [`NodeAnchor`](/api/type-aliases/nodeanchor/);
  `head`: [`NodeAnchor`](/api/type-aliases/nodeanchor/);
\}
  \| `undefined`

***

### setValue()

```ts
setValue(text): boolean;
```

Defined in: [core/src/store/MarkputApi.ts:106](https://github.com/Nowely/marked-input/blob/next/packages/core/src/store/MarkputApi.ts#L106)

Whole-value. Rides the same gap narrowing every whole-value site does (spec D8).

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `text` | `string` |

#### Returns

`boolean`

***

### tx()

```ts
tx(fn): boolean;
```

Defined in: [core/src/store/MarkputApi.ts:110](https://github.com/Nowely/marked-input/blob/next/packages/core/src/store/MarkputApi.ts#L110)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `fn` | () => `void` |

#### Returns

`boolean`

***

### value()

```ts
value(): string;
```

Defined in: [core/src/store/MarkputApi.ts:57](https://github.com/Nowely/marked-input/blob/next/packages/core/src/store/MarkputApi.ts#L57)

The string projection (spec D1): controlled → the props value, uncontrolled → the last
committed `join(tree)`. A delegation to TokenModel.value, and deliberately not
`join(tree)` inline — the two disagree while a controlled parent's `props.value` is
ahead of the last arrival, and on an UNSEEDED store, where the tree has no roots at all
but `value()` already answers the seed.

RECORDED GAP (measured): swapping in `joinNodes(this.tokens.nodes())` survives the whole
suite (73 files, 1326 passed). Every fixture here reaches the verb through a mounted,
seeded store, and an arrival is synchronous on the props watch, so the two readings agree
at every moment a test can observe. Closing it takes an UNMOUNTED-store case, which this
spec's mounted fixture cannot express.

#### Returns

`string`
