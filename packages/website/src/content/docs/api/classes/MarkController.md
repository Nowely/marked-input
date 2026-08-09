---
editUrl: false
next: false
prev: false
title: "MarkController"
---

Defined in: [core/src/features/tokens/MarkController.ts:21](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/MarkController.ts#L21)

Id-backed mark command surface: the controller holds a stable token id and
resolves it against the LIVE tree (`store.tokens.find(id)`) on every access.

Reads (`value`/`meta`/`slot`) are always fresh and need no fallback — the tree
has no pending window, where the latch-gated `handle(id)` served `undefined`
between a structural apply and its bind. A mark that has LEFT the tree reads as
empty (`''`/`undefined`) rather than resurrecting a construction-time copy.

Writes (`update`/`remove`) fail closed in read-only mode and against a mark that
is no longer in the tree. They no longer fail closed mid-window: the write folds
into the pending structural pass (§4.6 item 4 retires the write latch).

## Constructors

### Constructor

```ts
new MarkController(store, id): MarkController;
```

Defined in: [core/src/features/tokens/MarkController.ts:22](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/MarkController.ts#L22)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `store` | `Store` |
| `id` | `number` |

#### Returns

`MarkController`

## Accessors

### meta

#### Get Signature

```ts
get meta(): string | undefined;
```

Defined in: [core/src/features/tokens/MarkController.ts:45](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/MarkController.ts#L45)

##### Returns

`string` \| `undefined`

***

### readOnly

#### Get Signature

```ts
get readOnly(): boolean;
```

Defined in: [core/src/features/tokens/MarkController.ts:62](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/MarkController.ts#L62)

##### Returns

`boolean`

***

### slot

#### Get Signature

```ts
get slot(): string | undefined;
```

Defined in: [core/src/features/tokens/MarkController.ts:56](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/MarkController.ts#L56)

Slot TEXT, derived. `MarkNode.slot` stores POSITIONS only — `tree/types.ts` is
explicit that slot text is deliberately not stored ("a stored copy would be an
unread mirror nothing resyncs"), so where the token had `slot?.content` ready-made
the node needs the children joined. `undefined` for a markup with no slot, matching
the token contract.

##### Returns

`string` \| `undefined`

***

### value

#### Get Signature

```ts
get value(): string;
```

Defined in: [core/src/features/tokens/MarkController.ts:41](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/MarkController.ts#L41)

##### Returns

`string`

## Methods

### remove()

```ts
remove(): boolean;
```

Defined in: [core/src/features/tokens/MarkController.ts:66](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/MarkController.ts#L66)

#### Returns

`boolean`

***

### update()

```ts
update(patch): boolean;
```

Defined in: [core/src/features/tokens/MarkController.ts:72](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/MarkController.ts#L72)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `patch` | `MarkPatch` |

#### Returns

`boolean`

***

### fromToken()

```ts
static fromToken(store, token): MarkController;
```

Defined in: [core/src/features/tokens/MarkController.ts:27](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/MarkController.ts#L27)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `store` | `Store` |
| `token` | [`MarkToken`](/api/interfaces/marktoken/) |

#### Returns

`MarkController`
