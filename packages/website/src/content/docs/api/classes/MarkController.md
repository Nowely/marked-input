---
editUrl: false
next: false
prev: false
title: "MarkController"
---

Defined in: [core/src/features/tokens/MarkController.ts:26](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/MarkController.ts#L26)

Id-backed mark command surface. The controller holds a stable token id (not a
frozen `{address, snapshot}` capture and not an eager handle) plus the
render-tree token it was built from, used ONLY as a read fallback.

Reads (`value`/`meta`/`slot`) prefer the LIVE handle: `store.tokens.handle(id)`
is re-resolved on every access, so they track text-path commits (and the
controller's own updates after re-bind) without re-capture. That id lookup is
latch-gated — it serves `undefined` while a structural apply awaits its bind
(the routine pending window hit on EVERY render before the freshly-painted DOM
binds). In that window a read falls back to the construction-time token, which
the adapter just handed in fresh for this very render: the rendered mark shows
its value immediately instead of flashing empty until a re-render that the
adapter never schedules.

Writes (`update`/`remove`) stay strictly latch-gated: they resolve the LIVE
handle only and never act on the captured token (whose position can be a
generation stale). Against a pending (mid-window) or dead handle, or in
read-only mode, they are a fail-closed no-op returning `false`.

## Constructors

### Constructor

```ts
new MarkController(
   store,
   id,
   captured): MarkController;
```

Defined in: [core/src/features/tokens/MarkController.ts:27](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/MarkController.ts#L27)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `store` | `Store` |
| `id` | `number` |
| `captured` | [`MarkToken`](/api/interfaces/marktoken/) |

#### Returns

`MarkController`

## Accessors

### meta

#### Get Signature

```ts
get meta(): string | undefined;
```

Defined in: [core/src/features/tokens/MarkController.ts:61](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/MarkController.ts#L61)

##### Returns

`string` \| `undefined`

***

### readOnly

#### Get Signature

```ts
get readOnly(): boolean;
```

Defined in: [core/src/features/tokens/MarkController.ts:69](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/MarkController.ts#L69)

##### Returns

`boolean`

***

### slot

#### Get Signature

```ts
get slot(): string | undefined;
```

Defined in: [core/src/features/tokens/MarkController.ts:65](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/MarkController.ts#L65)

##### Returns

`string` \| `undefined`

***

### value

#### Get Signature

```ts
get value(): string;
```

Defined in: [core/src/features/tokens/MarkController.ts:57](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/MarkController.ts#L57)

##### Returns

`string`

## Methods

### remove()

```ts
remove(): boolean;
```

Defined in: [core/src/features/tokens/MarkController.ts:73](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/MarkController.ts#L73)

#### Returns

`boolean`

***

### update()

```ts
update(patch): boolean;
```

Defined in: [core/src/features/tokens/MarkController.ts:80](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/MarkController.ts#L80)

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

Defined in: [core/src/features/tokens/MarkController.ts:33](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/MarkController.ts#L33)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `store` | `Store` |
| `token` | [`MarkToken`](/api/interfaces/marktoken/) |

#### Returns

`MarkController`
