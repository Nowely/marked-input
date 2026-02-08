---
editUrl: false
next: false
prev: false
title: "MarkProps"
---

Defined in: [markput/src/types.ts:12](https://github.com/Nowely/marked-input/blob/next/packages/markput/src/types.ts#L12)

Props passed to Mark components.

## Properties

### children?

```ts
optional children: ReactNode;
```

Defined in: [markput/src/types.ts:22](https://github.com/Nowely/marked-input/blob/next/packages/markput/src/types.ts#L22)

Rendered children content (ReactNode) for nested marks

***

### meta?

```ts
optional meta: string;
```

Defined in: [markput/src/types.ts:18](https://github.com/Nowely/marked-input/blob/next/packages/markput/src/types.ts#L18)

Additional metadata for the mark

***

### nested?

```ts
optional nested: string;
```

Defined in: [markput/src/types.ts:20](https://github.com/Nowely/marked-input/blob/next/packages/markput/src/types.ts#L20)

Nested content as string (raw, unparsed)

***

### slot?

```ts
optional slot: ComponentType<MarkProps>;
```

Defined in: [markput/src/types.ts:14](https://github.com/Nowely/marked-input/blob/next/packages/markput/src/types.ts#L14)

Custom component to render this mark

***

### value?

```ts
optional value: string;
```

Defined in: [markput/src/types.ts:16](https://github.com/Nowely/marked-input/blob/next/packages/markput/src/types.ts#L16)

Main content value of the mark
