---
editUrl: false
next: false
prev: false
title: "NodeAnchor"
---

```ts
type NodeAnchor =
  | {
  node: TextNode;
  offset: number;
}
  | {
  before: TreeNode;
}
  | {
  after: TreeNode;
}
  | "start"
  | "end";
```

Defined in: [core/src/features/tokens/tree/types.ts:314](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L314)

The addressing model. Mark interiors are addressed via slot text nodes.
