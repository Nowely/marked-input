---
editUrl: false
next: false
prev: false
title: "OverlayPick"
---

```ts
type OverlayPick =
  | {
  meta?: never;
  option: CoreOption;
  value?: never;
}
  | {
  meta?: string;
  option?: never;
  value: string;
};
```

Defined in: [core/src/shared/types.ts:122](https://github.com/Nowely/marked-input/blob/next/packages/core/src/shared/types.ts#L122)

WHAT AN OVERLAY ACCEPTS, and a UNION because the two arms are exclusive in fact: naming a row
KIND retypes the caret's row, naming a VALUE writes the trigger option's markup, and no call
does both. Spelled as one optional bag the illegal states were representable — `{}` wrote
`@[]()` into the document, and `{option, value}` typechecked while silently dropping `value`.

The `?: never` members are load-bearing: a bare union does NOT forbid `{option, value}`,
because excess-property checking against a union accepts any key declared by ANY arm.
