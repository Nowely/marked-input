---
editUrl: false
next: false
prev: false
title: "MarkToken"
---

Defined in: [core/src/features/tokens/parser/types.ts:17](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/parser/types.ts#L17)

## Properties

### children

```ts
children: Token[];
```

Defined in: [core/src/features/tokens/parser/types.ts:34](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/parser/types.ts#L34)

***

### content

```ts
content: string;
```

Defined in: [core/src/features/tokens/parser/types.ts:19](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/parser/types.ts#L19)

***

### descriptor

```ts
descriptor: MarkupDescriptor;
```

Defined in: [core/src/features/tokens/parser/types.ts:26](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/parser/types.ts#L26)

***

### id?

```ts
optional id: number;
```

Defined in: [core/src/features/tokens/parser/types.ts:25](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/parser/types.ts#L25)

Stable identity id, stamped by the tree's snapshot (`tree/snapshot.ts`) — NOT by the parser. Absent on freshly parsed trees.

***

### meta?

```ts
optional meta: string;
```

Defined in: [core/src/features/tokens/parser/types.ts:28](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/parser/types.ts#L28)

***

### position

```ts
position: object;
```

Defined in: [core/src/features/tokens/parser/types.ts:20](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/parser/types.ts#L20)

#### end

```ts
end: number;
```

#### start

```ts
start: number;
```

***

### slot?

```ts
optional slot: object;
```

Defined in: [core/src/features/tokens/parser/types.ts:29](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/parser/types.ts#L29)

#### content

```ts
content: string;
```

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
type: "mark";
```

Defined in: [core/src/features/tokens/parser/types.ts:18](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/parser/types.ts#L18)

***

### value

```ts
value: string;
```

Defined in: [core/src/features/tokens/parser/types.ts:27](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/parser/types.ts#L27)
