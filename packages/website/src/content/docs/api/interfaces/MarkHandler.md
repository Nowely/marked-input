---
editUrl: false
next: false
prev: false
title: "MarkHandler"
---

Defined in: [packages/markput/src/utils/hooks/useMark.tsx:13](https://github.com/Nowely/marked-input/blob/next/packages/markput/src/utils/hooks/useMark.tsx#L13)

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

Defined in: [packages/markput/src/utils/hooks/useMark.tsx:23](https://github.com/Nowely/marked-input/blob/next/packages/markput/src/utils/hooks/useMark.tsx#L23)

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

### depth

```ts
readonly depth: number;
```

Defined in: [packages/markput/src/utils/hooks/useMark.tsx:40](https://github.com/Nowely/marked-input/blob/next/packages/markput/src/utils/hooks/useMark.tsx#L40)

Nesting depth of this mark (0 for root-level marks).
Computed lazily on access.

***

### hasChildren

```ts
readonly hasChildren: boolean;
```

Defined in: [packages/markput/src/utils/hooks/useMark.tsx:44](https://github.com/Nowely/marked-input/blob/next/packages/markput/src/utils/hooks/useMark.tsx#L44)

Whether this mark has nested children

***

### label

```ts
label: string;
```

Defined in: [packages/markput/src/utils/hooks/useMark.tsx:9](https://github.com/Nowely/marked-input/blob/next/packages/markput/src/utils/hooks/useMark.tsx#L9)

#### Inherited from

```ts
MarkStruct.label
```

***

### meta?

```ts
optional meta: string;
```

Defined in: [packages/markput/src/utils/hooks/useMark.tsx:35](https://github.com/Nowely/marked-input/blob/next/packages/markput/src/utils/hooks/useMark.tsx#L35)

Meta value of the mark

***

### parent

```ts
readonly parent: MarkToken | undefined;
```

Defined in: [packages/markput/src/utils/hooks/useMark.tsx:49](https://github.com/Nowely/marked-input/blob/next/packages/markput/src/utils/hooks/useMark.tsx#L49)

Parent mark token (undefined for root-level marks).
Computed lazily on access.

***

### readOnly?

```ts
optional readOnly: boolean;
```

Defined in: [packages/markput/src/utils/hooks/useMark.tsx:31](https://github.com/Nowely/marked-input/blob/next/packages/markput/src/utils/hooks/useMark.tsx#L31)

Passed the readOnly prop value

***

### ref

```ts
ref: RefObject<T>;
```

Defined in: [packages/markput/src/utils/hooks/useMark.tsx:17](https://github.com/Nowely/marked-input/blob/next/packages/markput/src/utils/hooks/useMark.tsx#L17)

MarkStruct ref. Used for focusing and key handling operations.

***

### remove()

```ts
remove: () => void;
```

Defined in: [packages/markput/src/utils/hooks/useMark.tsx:27](https://github.com/Nowely/marked-input/blob/next/packages/markput/src/utils/hooks/useMark.tsx#L27)

Remove itself.

#### Returns

`void`

***

### tokens

```ts
readonly tokens: Token[];
```

Defined in: [packages/markput/src/utils/hooks/useMark.tsx:53](https://github.com/Nowely/marked-input/blob/next/packages/markput/src/utils/hooks/useMark.tsx#L53)

Array of child tokens (read-only)

***

### value?

```ts
optional value: string;
```

Defined in: [packages/markput/src/utils/hooks/useMark.tsx:10](https://github.com/Nowely/marked-input/blob/next/packages/markput/src/utils/hooks/useMark.tsx#L10)

#### Inherited from

```ts
MarkStruct.value
```
