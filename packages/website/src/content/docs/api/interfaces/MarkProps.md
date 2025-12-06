---
editUrl: false
next: false
prev: false
title: "MarkProps"
---

Defined in: [packages/markput/src/types.ts:13](https://github.com/Nowely/marked-input/blob/next/packages/markput/src/types.ts#L13)

Props passed to Mark components.

## Properties

### children?

```ts
optional children: ReactNode;
```

Defined in: [packages/markput/src/types.ts:23](https://github.com/Nowely/marked-input/blob/next/packages/markput/src/types.ts#L23)

Rendered children content (ReactNode) for nested marks

***

### meta?

```ts
optional meta: string;
```

Defined in: [packages/markput/src/types.ts:19](https://github.com/Nowely/marked-input/blob/next/packages/markput/src/types.ts#L19)

Additional metadata for the mark

***

### nested?

```ts
optional nested: string;
```

Defined in: [packages/markput/src/types.ts:21](https://github.com/Nowely/marked-input/blob/next/packages/markput/src/types.ts#L21)

Nested content as string (raw, unparsed)

***

### slot?

```ts
optional slot: ComponentType<MarkProps>;
```

Defined in: [packages/markput/src/types.ts:15](https://github.com/Nowely/marked-input/blob/next/packages/markput/src/types.ts#L15)

Custom component to render this mark

***

### value?

```ts
optional value: string;
```

Defined in: [packages/markput/src/types.ts:17](https://github.com/Nowely/marked-input/blob/next/packages/markput/src/types.ts#L17)

Main content value of the mark
