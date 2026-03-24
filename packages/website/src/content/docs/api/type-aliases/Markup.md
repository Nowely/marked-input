---
editUrl: false
next: false
prev: false
title: "Markup"
---

```ts
type Markup = 
  | `${ValueMarkup}`
  | `${ValueMarkup}${MetaMarkup}`
  | `${ValueMarkup}${MetaMarkup}${SlotMarkup}`
  | `${ValueMarkup}${SlotMarkup}`
  | `${ValueMarkup}${SlotMarkup}${MetaMarkup}`
  | `${SlotMarkup}`
  | `${SlotMarkup}${MetaMarkup}`
  | `${SlotMarkup}${MetaMarkup}${ValueMarkup}`
  | `${SlotMarkup}${ValueMarkup}`
  | `${SlotMarkup}${ValueMarkup}${MetaMarkup}`
  | `${MetaMarkup}${ValueMarkup}`
  | `${MetaMarkup}${ValueMarkup}${SlotMarkup}`
  | `${MetaMarkup}${SlotMarkup}`
  | `${MetaMarkup}${SlotMarkup}${ValueMarkup}`;
```

Defined in: [common/core/src/features/parsing/parser/types.ts:59](https://github.com/Nowely/marked-input/blob/next/packages/common/core/src/features/parsing/parser/types.ts#L59)

Modern Markup type supporting value, meta, and children placeholders

Examples:
- "@[__value__]" - simple value
- "@[__value__](__meta__)" - value with metadata
- "@[__slot__]" - nested content
- "@[__value__](__slot__)" - value with nested content
- "<__value__ __meta__>__slot__</__value__>" - HTML-like with all features
