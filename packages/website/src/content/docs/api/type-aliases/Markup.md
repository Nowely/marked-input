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
  | `${ValueMarkup}${MetaMarkup}${ChildrenMarkup}`
  | `${ValueMarkup}${ChildrenMarkup}`
  | `${ValueMarkup}${ChildrenMarkup}${MetaMarkup}`
  | `${ChildrenMarkup}`
  | `${ChildrenMarkup}${MetaMarkup}`
  | `${ChildrenMarkup}${MetaMarkup}${ValueMarkup}`
  | `${ChildrenMarkup}${ValueMarkup}`
  | `${ChildrenMarkup}${ValueMarkup}${MetaMarkup}`
  | `${MetaMarkup}${ValueMarkup}`
  | `${MetaMarkup}${ValueMarkup}${ChildrenMarkup}`
  | `${MetaMarkup}${ChildrenMarkup}`
  | `${MetaMarkup}${ChildrenMarkup}${ValueMarkup}`;
```

Defined in: [common/core/src/features/parsing/parser/types.ts:59](https://github.com/Nowely/marked-input/blob/next/packages/common/core/src/features/parsing/parser/types.ts#L59)

Modern Markup type supporting value, meta, and children placeholders

Examples:
- "@[__value__]" - simple value
- "@[__value__](__meta__)" - value with metadata
- "@[__children__]" - nested content
- "@[__value__](__children__)" - value with nested content
- "<__value__ __meta__>__children__</__value__>" - HTML-like with all features
