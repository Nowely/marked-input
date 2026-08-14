# A block row whose slot starts with a mark never opens

Status: ready-for-human

A slot-first markup — the production block-row shape `__slot__\n\n` used by `Drag` and
`renderCount` — fails to open when its slot begins with a mark, so the row is not a row.
Reproduced directly with `new Parser(['__slot__\n\n', '@[__value__]'])`:

```
parse('a\n\n')    ->  TEXT "" | MARK "a↲↲" [0-3] [slot="a"] | TEXT ""     row opens
parse('@[x]\n\n') ->  TEXT "" | MARK "@[x]" [0-4]           | TEXT "↲↲"   no row
```

The mention is matched, the row is not, and the separator is left as literal text. In
`parse('a\n\n@[x]\n\n')` the first row opens and the second does not, so it is the leading
mark that breaks it, not the document.

Consequence in block layout: a paragraph that starts with a mark is not a draggable row.
Fixing it changes parse output for existing documents, so it needs sign-off.

Found while writing `adjacentMark`'s nested-first test: a shared boundary between an outer
and an inner mark needs exactly this shape, and it could not be parsed. The test at
`tree/anchors.spec.ts` assembles the tree by hand instead and says so in a comment — that
comment can go once this is fixed.
