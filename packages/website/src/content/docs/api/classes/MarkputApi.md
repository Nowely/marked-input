---
editUrl: false
next: false
prev: false
title: "MarkputApi"
---

Defined in: core/src/store/MarkputApi.ts:28

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

Defined in: core/src/store/MarkputApi.ts:29

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

Defined in: core/src/store/MarkputApi.ts:66

Fires once per commit, after the DOM is consistent (spec §2.3; D9's fold merging).

##### Returns

`Event`\<`TokenDelta`\>

***

### container

#### Get Signature

```ts
get container(): HTMLElement | null;
```

Defined in: core/src/store/MarkputApi.ts:42

##### Returns

`HTMLElement` \| `null`

## Methods

### caret()

```ts
caret(at): boolean;
```

Defined in: core/src/store/MarkputApi.ts:132

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `at` | `NodeAnchor` |

#### Returns

`boolean`

***

### find()

```ts
find(id): TreeNode | undefined;
```

Defined in: core/src/store/MarkputApi.ts:61

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `id` | `number` |

#### Returns

`TreeNode` \| `undefined`

***

### focus()

```ts
focus(): void;
```

Defined in: core/src/store/MarkputApi.ts:117

#### Returns

`void`

***

### insertMark()

```ts
insertMark(at, init): MarkNode | undefined;
```

Defined in: core/src/store/MarkputApi.ts:78

Returns the fresh node in uncontrolled mode and `undefined` in controlled mode (spec D6:
the node exists only once the parent's echo commits — a caller re-finds it from
`changed`). The uncontrolled lookup is BY POSITION rather than through a result feed:
`applyRange` answers a boolean and the `TransactionResult` goes to the boundary, so
threading one out would touch four sites for one caller. The parse of the spliced
projection puts the mark exactly at the insertion offset (plan decision D-g).

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `at` | `NodeAnchor` \| `"caret"` |
| `init` | `MarkInit` |

#### Returns

`MarkNode` \| `undefined`

***

### nodes()

```ts
nodes(): readonly TreeNode[];
```

Defined in: core/src/store/MarkputApi.ts:57

The live root nodes, reactive (spec §2.3, D11). Ids are always present.

#### Returns

readonly `TreeNode`[]

***

### replaceRange()

```ts
replaceRange(
   from,
   to,
   text): boolean;
```

Defined in: core/src/store/MarkputApi.ts:92

Cross-node (spec D5). The pair is normalized, so `from` after `to` is legal.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `from` | `NodeAnchor` |
| `to` | `NodeAnchor` |
| `text` | `string` |

#### Returns

`boolean`

***

### replaceText()

```ts
replaceText(target, text): boolean;
```

Defined in: core/src/store/MarkputApi.ts:87

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `target` | \{ `end`: `number`; `node`: `TextNode`; `start`: `number`; \} |
| `target.end` | `number` |
| `target.node` | `TextNode` |
| `target.start` | `number` |
| `text` | `string` |

#### Returns

`boolean`

***

### select()

```ts
select(anchor, head?): boolean;
```

Defined in: core/src/store/MarkputApi.ts:126

#### Parameters

| Parameter | Type | Default value |
| ------ | ------ | ------ |
| `anchor` | `NodeAnchor` | `undefined` |
| `head` | `NodeAnchor` | `anchor` |

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

Defined in: core/src/store/MarkputApi.ts:122

The STORED anchors (spec D7), not the derived numbers. Reactive.

#### Returns

  \| \{
  `anchor`: `NodeAnchor`;
  `head`: `NodeAnchor`;
\}
  \| `undefined`

***

### selectionRange()

```ts
selectionRange(): Range | undefined;
```

Defined in: core/src/store/MarkputApi.ts:136

#### Returns

`Range` \| `undefined`

***

### setValue()

```ts
setValue(text): boolean;
```

Defined in: core/src/store/MarkputApi.ts:109

Whole-value. Rides the internal offset shim's gap narrowing (spec D8), like every other
whole-value site — which is what the `-1` sentinel selects.

RECORDED GAP (measured): passing `{0, this.value().length}` instead survives the whole
suite. The two take the same `lowerReplace` branch whenever the props value and the tree
projection agree, and an arrival is synchronous on the props watch, so they agree at
every observable moment. Kept as the sentinel because it is the tree's own length by
construction rather than a read of a value that is props-first in controlled mode.

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

Defined in: core/src/store/MarkputApi.ts:113

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

Defined in: core/src/store/MarkputApi.ts:52

The string projection (spec D1): controlled → the props value, uncontrolled → the last
committed `join(tree)`. A delegation to TokenModel.value, and deliberately not
`join(tree)` inline — the two disagree while a controlled parent's `props.value` is
ahead of the last arrival. (Gated: swapping in `joinNodes(nodes())` fails 9 core tests.)

#### Returns

`string`
