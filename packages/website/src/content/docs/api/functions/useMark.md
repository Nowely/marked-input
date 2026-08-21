---
editUrl: false
next: false
prev: false
title: "useMark"
---

```ts
function useMark(): MarkNode;
```

Defined in: [react/markput/src/lib/hooks/useMark.tsx:11](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/lib/hooks/useMark.tsx#L11)

The live mark node for the surrounding mark token context (spec §2.3) — a context READ
since S2.8. It used to be `store.tokens.markFor(token)`, a lookup FROM the render
projection BACK to the node behind it; with the projection gone the context carries the
node itself.

## Returns

[`MarkNode`](/api/interfaces/marknode/)
