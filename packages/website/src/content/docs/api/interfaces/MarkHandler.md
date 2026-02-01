---
editUrl: false
next: false
prev: false
title: "MarkHandler"
---

Defined in: packages/markput/src/utils/hooks/useMark.tsx:15

## Extends

- `MarkStruct`

## Type Parameters

| Type Parameter |
| ------ |
| `T` |

## Properties

### change()

```ts
change: (props, options?) => void;
```

Defined in: packages/markput/src/utils/hooks/useMark.tsx:25

Change mark.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `props` | `MarkStruct` | - |
| `options?` | \{ `silent`: `boolean`; \} | The options object |
| `options.silent?` | `boolean` | If true, doesn't change itself label and value, only pass change event. |

#### Returns

`void`

***

### children

```ts
children: ReactNode;
```

Defined in: packages/markput/src/utils/hooks/useMark.tsx:57

Rendered children as ReactNode

***

### depth

```ts
depth: number;
```

Defined in: packages/markput/src/utils/hooks/useMark.tsx:41

Nesting depth of this mark (0 for root-level marks)

***

### hasChildren

```ts
hasChildren: boolean;
```

Defined in: packages/markput/src/utils/hooks/useMark.tsx:45

Whether this mark has nested children

***

### label

```ts
label: string;
```

Defined in: packages/markput/src/utils/hooks/useMark.tsx:11

#### Inherited from

```ts
MarkStruct.label
```

***

### meta?

```ts
optional meta: string;
```

Defined in: packages/markput/src/utils/hooks/useMark.tsx:37

Meta value of the mark

***

### parent?

```ts
optional parent: MarkToken;
```

Defined in: packages/markput/src/utils/hooks/useMark.tsx:49

Parent mark token (undefined for root-level marks)

***

### readOnly?

```ts
optional readOnly: boolean;
```

Defined in: packages/markput/src/utils/hooks/useMark.tsx:33

Passed the readOnly prop value

***

### ref

```ts
ref: RefObject<T>;
```

Defined in: packages/markput/src/utils/hooks/useMark.tsx:19

MarkStruct ref. Used for focusing and key handling operations.

***

### remove()

```ts
remove: () => void;
```

Defined in: packages/markput/src/utils/hooks/useMark.tsx:29

Remove itself.

#### Returns

`void`

***

### tokens

```ts
tokens: Token[];
```

Defined in: packages/markput/src/utils/hooks/useMark.tsx:53

Array of child tokens (read-only)

***

### value?

```ts
optional value: string;
```

Defined in: packages/markput/src/utils/hooks/useMark.tsx:12

#### Inherited from

```ts
MarkStruct.value
```
