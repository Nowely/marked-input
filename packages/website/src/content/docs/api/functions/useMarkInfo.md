---
editUrl: false
next: false
prev: false
title: "useMarkInfo"
---

```ts
function useMarkInfo(): MarkInfo;
```

Defined in: [react/markput/src/lib/hooks/useMarkInfo.tsx:17](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/lib/hooks/useMarkInfo.tsx#L17)

Mark metadata for the surrounding mark token context.

Staleness note: the returned `address` is frozen at the last STRUCTURAL
render — text-path commits patch the DOM without re-rendering, so its token
object and position can lag the value. Feeding a lagging address to
position-sensitive APIs is fail-closed (the index's object-identity check
turns it into a no-op rather than acting on a stale range) — for mutations
prefer handle- or `freshAddressFor`-based flows (`useMark`'s controller
already bridges identity internally).

## Returns

`MarkInfo`
