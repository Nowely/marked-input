---
editUrl: false
next: false
prev: false
title: "useMarkInfo"
---

```ts
function useMarkInfo(): MarkInfo;
```

Defined in: [react/markput/src/lib/hooks/useMarkInfo.tsx:15](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/lib/hooks/useMarkInfo.tsx#L15)

Mark metadata for the surrounding mark token context.

Staleness note: the returned `address` is frozen at the last STRUCTURAL
render — text-path commits patch the DOM without re-rendering, so its token
object and position can lag the value. Feeding a lagging address to
position-sensitive APIs is fail-closed (the model bridges tokens by identity
and rejects replaced ones) — for mutations prefer handle-based flows
(`useMark`'s controller already bridges identity internally).

## Returns

`MarkInfo`
