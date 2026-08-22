# One render path for any root node

Type: grilling
Status: open

## Question

`Container` forks per layout: `isBlock ? nodes.map(Block) : nodes.map(Token)`
(`Container.tsx:34-39` ≡ `Container.vue:49-54`). Rows render through
`slots.block` + the adapter's Block wrapper; marks resolve through
`options[descriptor.index].Mark`; `resolveMarkSlot` throws on a RowNode
(`slots/resolveSlot.ts:72-75`). `SlotName` is `'container' | 'block'` — there
is no `'mark'` slot name.

What is the single resolution path that renders any root node, and what is a
Row's default component? Where does block chrome (grip, menu, drop indicator)
enter that path — default components, slot layers, or consumer overrides?

Note the published contract: `slots.block` / `slotProps.block` are published
names and the glossary marks them "not a rename target" — a change here is a
declared breaking change, listed per the map's behavior-change rule.
