---
editUrl: false
next: false
prev: false
title: "TextNode"
---

Defined in: [core/src/features/tokens/tree/types.ts:21](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L21)

## Properties

### id

```ts
readonly id: number;
```

Defined in: [core/src/features/tokens/tree/types.ts:23](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L23)

***

### kind

```ts
readonly kind: "text";
```

Defined in: [core/src/features/tokens/tree/types.ts:22](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L22)

***

### position

```ts
position: object;
```

Defined in: [core/src/features/tokens/tree/types.ts:25](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L25)

#### end

```ts
end: number;
```

#### start

```ts
start: number;
```

***

### text

```ts
readonly text: Signal<string>;
```

Defined in: [core/src/features/tokens/tree/types.ts:24](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L24)

## Methods

### range()

```ts
range(): object;
```

Defined in: [core/src/features/tokens/tree/types.ts:32](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L32)

The derived positional read. NOT reactive: `position` is a plain field written by
adoption, so a consumer that must react to a move watches `changed` or the content
signals instead. Returns a COPY — the stored record is adoption's, and handing it out
would let a caller corrupt the coordinate space every splice is computed in.

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

Defined in: [core/src/features/tokens/tree/types.ts:34](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L34)

See NodeCommands. Rides a transaction; `false` in read-only mode or off the tree.

#### Returns

`boolean`
