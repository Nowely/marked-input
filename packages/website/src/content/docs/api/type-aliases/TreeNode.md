---
editUrl: false
next: false
prev: false
title: "TreeNode"
---

```ts
type TreeNode =
  | TextNode
  | MarkNode;
```

Defined in: [core/src/features/tokens/tree/types.ts:18](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L18)

One structure (spec D11): the same objects flow through adoption and out of
the public reads. Signal fields are the reactive read; adoption is the only
supported writer — direct setter calls from consumers are unsupported and
break the round-trip invariant (documented, not runtime-policed).
`position`/`slotRange` are plain fields written only by adoption (spec D3).
