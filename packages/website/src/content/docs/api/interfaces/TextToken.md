---
editUrl: false
next: false
prev: false
title: "TextToken"
---

Defined in: [core/src/features/tokens/parser/types.ts:6](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/parser/types.ts#L6)

## Properties

### content

```ts
content: string;
```

Defined in: [core/src/features/tokens/parser/types.ts:8](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/parser/types.ts#L8)

***

### id?

```ts
optional id: number;
```

Defined in: [core/src/features/tokens/parser/types.ts:14](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/parser/types.ts#L14)

Stable identity id, stamped by reconcile (tokenIdentity) — NOT by the parser. Absent on freshly parsed, never-reconciled trees.

***

### position

```ts
position: object;
```

Defined in: [core/src/features/tokens/parser/types.ts:9](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/parser/types.ts#L9)

#### end

```ts
end: number;
```

#### start

```ts
start: number;
```

***

### type

```ts
type: "text";
```

Defined in: [core/src/features/tokens/parser/types.ts:7](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/parser/types.ts#L7)
