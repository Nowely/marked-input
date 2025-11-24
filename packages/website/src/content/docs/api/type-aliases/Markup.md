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
  | `${ValueMarkup}${MetaMarkup}${NestedMarkup}`
  | `${ValueMarkup}${NestedMarkup}`
  | `${ValueMarkup}${NestedMarkup}${MetaMarkup}`
  | `${NestedMarkup}`
  | `${NestedMarkup}${MetaMarkup}`
  | `${NestedMarkup}${MetaMarkup}${ValueMarkup}`
  | `${NestedMarkup}${ValueMarkup}`
  | `${NestedMarkup}${ValueMarkup}${MetaMarkup}`
  | `${MetaMarkup}${ValueMarkup}`
  | `${MetaMarkup}${ValueMarkup}${NestedMarkup}`
  | `${MetaMarkup}${NestedMarkup}`
  | `${MetaMarkup}${NestedMarkup}${ValueMarkup}`;
```

Defined in: [packages/core/src/features/parsing/ParserV2/types.ts:59](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/parsing/ParserV2/types.ts#L59)

Modern Markup type supporting value, meta, and nested placeholders

Examples:
- "@[__value__]" - simple value
- "@[__value__](__meta__)" - value with metadata
- "@[__nested__]" - nested content
- "@[__value__](__nested__)" - value with nested content
- "<__value__ __meta__>__nested__</__value__>" - HTML-like with all features
