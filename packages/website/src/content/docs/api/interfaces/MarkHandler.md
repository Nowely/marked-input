---
editUrl: false
next: false
prev: false
title: "MarkHandler"
---

Defined in: [markput/src/utils/hooks/useMark.ts:13](https://github.com/Nowely/marked-input/blob/79420fc552c7fc55c3dba69d98fb3554d30361c2/packages/markput/src/utils/hooks/useMark.ts#L13)

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

Defined in: [markput/src/utils/hooks/useMark.ts:23](https://github.com/Nowely/marked-input/blob/79420fc552c7fc55c3dba69d98fb3554d30361c2/packages/markput/src/utils/hooks/useMark.ts#L23)

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
children: Token[];
```

Defined in: [markput/src/utils/hooks/useMark.ts:51](https://github.com/Nowely/marked-input/blob/79420fc552c7fc55c3dba69d98fb3554d30361c2/packages/markput/src/utils/hooks/useMark.ts#L51)

Array of child tokens (read-only)

***

### depth

```ts
depth: number;
```

Defined in: [markput/src/utils/hooks/useMark.ts:39](https://github.com/Nowely/marked-input/blob/79420fc552c7fc55c3dba69d98fb3554d30361c2/packages/markput/src/utils/hooks/useMark.ts#L39)

Nesting depth of this mark (0 for root-level marks)

***

### hasChildren

```ts
hasChildren: boolean;
```

Defined in: [markput/src/utils/hooks/useMark.ts:43](https://github.com/Nowely/marked-input/blob/79420fc552c7fc55c3dba69d98fb3554d30361c2/packages/markput/src/utils/hooks/useMark.ts#L43)

Whether this mark has nested children

***

### label

```ts
label: string;
```

Defined in: [markput/src/utils/hooks/useMark.ts:9](https://github.com/Nowely/marked-input/blob/79420fc552c7fc55c3dba69d98fb3554d30361c2/packages/markput/src/utils/hooks/useMark.ts#L9)

#### Inherited from

```ts
MarkStruct.label
```

***

### meta?

```ts
optional meta: string;
```

Defined in: [markput/src/utils/hooks/useMark.ts:35](https://github.com/Nowely/marked-input/blob/79420fc552c7fc55c3dba69d98fb3554d30361c2/packages/markput/src/utils/hooks/useMark.ts#L35)

Meta value of the mark

***

### parent?

```ts
optional parent: MarkToken;
```

Defined in: [markput/src/utils/hooks/useMark.ts:47](https://github.com/Nowely/marked-input/blob/79420fc552c7fc55c3dba69d98fb3554d30361c2/packages/markput/src/utils/hooks/useMark.ts#L47)

Parent mark token (undefined for root-level marks)

***

### readOnly?

```ts
optional readOnly: boolean;
```

Defined in: [markput/src/utils/hooks/useMark.ts:31](https://github.com/Nowely/marked-input/blob/79420fc552c7fc55c3dba69d98fb3554d30361c2/packages/markput/src/utils/hooks/useMark.ts#L31)

Passed the readOnly prop value

***

### ref

```ts
ref: RefObject<T>;
```

Defined in: [markput/src/utils/hooks/useMark.ts:17](https://github.com/Nowely/marked-input/blob/79420fc552c7fc55c3dba69d98fb3554d30361c2/packages/markput/src/utils/hooks/useMark.ts#L17)

MarkStruct ref. Used for focusing and key handling operations.

***

### remove()

```ts
remove: () => void;
```

Defined in: [markput/src/utils/hooks/useMark.ts:27](https://github.com/Nowely/marked-input/blob/79420fc552c7fc55c3dba69d98fb3554d30361c2/packages/markput/src/utils/hooks/useMark.ts#L27)

Remove itself.

#### Returns

`void`

***

### value?

```ts
optional value: string;
```

Defined in: [markput/src/utils/hooks/useMark.ts:10](https://github.com/Nowely/marked-input/blob/79420fc552c7fc55c3dba69d98fb3554d30361c2/packages/markput/src/utils/hooks/useMark.ts#L10)

#### Inherited from

```ts
MarkStruct.value
```
