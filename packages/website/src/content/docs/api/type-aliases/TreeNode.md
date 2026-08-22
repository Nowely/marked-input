---
editUrl: false
next: false
prev: false
title: "TreeNode"
---

```ts
type TreeNode =
  | TextNode
  | MarkNode
  | RowNode;
```

Defined in: [core/src/features/tokens/tree/types.ts:49](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L49)

One structure: the same objects flow through adoption and out of the public
reads. ADOPTION IS THE ONLY WRITER, for every mutable member — the writable
`Signal` fields, which are also the reactive read, and the plain `position`
and `slotRange` records alike. A consumer that calls a setter or assigns a
position breaks the round-trip invariant. The rule is documented here rather
than enforced by the types, so nothing stops such a write at compile time.
