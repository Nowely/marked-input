---
editUrl: false
next: false
prev: false
title: "MarkInfo"
---

```ts
type MarkInfo = object;
```

Defined in: [core/src/shared/editorContracts.ts:5](https://github.com/Nowely/marked-input/blob/next/packages/core/src/shared/editorContracts.ts#L5)

## Properties

### depth

```ts
readonly depth: number;
```

Defined in: [core/src/shared/editorContracts.ts:7](https://github.com/Nowely/marked-input/blob/next/packages/core/src/shared/editorContracts.ts#L7)

Nesting level: a top-level mark has depth 0.

***

### hasNestedMarks

```ts
readonly hasNestedMarks: boolean;
```

Defined in: [core/src/shared/editorContracts.ts:9](https://github.com/Nowely/marked-input/blob/next/packages/core/src/shared/editorContracts.ts#L9)

Whether this mark directly contains other marks.
