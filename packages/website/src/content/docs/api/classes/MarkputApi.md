---
editUrl: false
next: false
prev: false
title: "MarkputApi"
---

Defined in: [core/src/store/MarkputApi.ts:24](https://github.com/Nowely/marked-input/blob/next/packages/core/src/store/MarkputApi.ts#L24)

THE public surface (spec §2.3). The evolved `MarkputHandler`: it keeps `container`,
absorbs `focus()`, drops the consumer-free `overlay` getter, and gains the live node
reads, the model-centric write verbs, node-anchored selection and the `changed` payload.

It owns nothing. Every member lowers onto a state owner — the token layer, which owns the
tree, the DOM binding and (since S2.9) the selection — so the shape of the API can move
without moving state (AGENTS.md's one-owner rule).

## Constructors

### Constructor

```ts
new MarkputApi(host, tokens): MarkputApi;
```

Defined in: [core/src/store/MarkputApi.ts:25](https://github.com/Nowely/marked-input/blob/next/packages/core/src/store/MarkputApi.ts#L25)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `host` | `Host` |
| `tokens` | `TokenModel` |

#### Returns

`MarkputApi`

## Accessors

### changed

#### Get Signature

```ts
get changed(): Event<TokenDelta>;
```

Defined in: [core/src/store/MarkputApi.ts:61](https://github.com/Nowely/marked-input/blob/next/packages/core/src/store/MarkputApi.ts#L61)

Fires once per commit, after the DOM is consistent (spec §2.3; D9's fold merging).

##### Returns

`Event`\<`TokenDelta`\>

***

### container

#### Get Signature

```ts
get container(): HTMLElement | null;
```

Defined in: [core/src/store/MarkputApi.ts:30](https://github.com/Nowely/marked-input/blob/next/packages/core/src/store/MarkputApi.ts#L30)

##### Returns

`HTMLElement` \| `null`

## Methods

### caret()

```ts
caret(at): boolean;
```

Defined in: [core/src/store/MarkputApi.ts:120](https://github.com/Nowely/marked-input/blob/next/packages/core/src/store/MarkputApi.ts#L120)

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

Defined in: [core/src/store/MarkputApi.ts:56](https://github.com/Nowely/marked-input/blob/next/packages/core/src/store/MarkputApi.ts#L56)

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

Defined in: [core/src/store/MarkputApi.ts:105](https://github.com/Nowely/marked-input/blob/next/packages/core/src/store/MarkputApi.ts#L105)

#### Returns

`void`

***

### insertMark()

```ts
insertMark(at, init): boolean;
```

Defined in: [core/src/store/MarkputApi.ts:79](https://github.com/Nowely/marked-input/blob/next/packages/core/src/store/MarkputApi.ts#L79)

Whether the insertion was ACCEPTED. `'caret'` means the selection's START in document
order, and answers `false` when there is no selection (spec §2.3).

It used to answer the fresh node, and that shape could not say what it meant: `undefined`
was BOTH "refused" and "accepted, but this is controlled mode so the node does not exist
yet" (spec D6 — the node arrives only once the parent's echo commits). A caller could not
tell a rejected write from a pending one. `boolean` separates them, and the node is read
back the way every other post-commit read works: from `changed`, then [find](/api/classes/markputapi/#find).

That also retired the positional lookup this used to end with — resolving the created
mark as "the one ending at the post-splice caret" — along with the fixture that existed
only to discriminate it from "the first mark in the document".

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `at` | [`NodeAnchor`](/api/type-aliases/nodeanchor/) \| `"caret"` |
| `init` | `MarkInit` |

#### Returns

`boolean`

***

### nodes()

```ts
nodes(): readonly TreeNode[];
```

Defined in: [core/src/store/MarkputApi.ts:52](https://github.com/Nowely/marked-input/blob/next/packages/core/src/store/MarkputApi.ts#L52)

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

Defined in: [core/src/store/MarkputApi.ts:91](https://github.com/Nowely/marked-input/blob/next/packages/core/src/store/MarkputApi.ts#L91)

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

Defined in: [core/src/store/MarkputApi.ts:86](https://github.com/Nowely/marked-input/blob/next/packages/core/src/store/MarkputApi.ts#L86)

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

Defined in: [core/src/store/MarkputApi.ts:114](https://github.com/Nowely/marked-input/blob/next/packages/core/src/store/MarkputApi.ts#L114)

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

Defined in: [core/src/store/MarkputApi.ts:110](https://github.com/Nowely/marked-input/blob/next/packages/core/src/store/MarkputApi.ts#L110)

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

Defined in: [core/src/store/MarkputApi.ts:97](https://github.com/Nowely/marked-input/blob/next/packages/core/src/store/MarkputApi.ts#L97)

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

Defined in: [core/src/store/MarkputApi.ts:101](https://github.com/Nowely/marked-input/blob/next/packages/core/src/store/MarkputApi.ts#L101)

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

Defined in: [core/src/store/MarkputApi.ts:47](https://github.com/Nowely/marked-input/blob/next/packages/core/src/store/MarkputApi.ts#L47)

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
