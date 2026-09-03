---
editUrl: false
next: false
prev: false
title: "Suggestion"
---

```ts
type Suggestion =
  | string
  | {
  label?: string;
  meta?: string;
  value: string;
};
```

Defined in: [core/src/shared/types.ts:153](https://github.com/Nowely/marked-input/blob/next/packages/core/src/shared/types.ts#L153)

A row of the built-in Suggestions overlay. A bare string is label and value at once, which is
every list whose text IS what the document stores; the object form separates them, so a row can
carry the identity that goes in the `__meta__` gap of `@[__value__](__meta__)` and a `label`
that is neither. Without it any list with an id behind it had to drop the built-in overlay and
write its own component.
