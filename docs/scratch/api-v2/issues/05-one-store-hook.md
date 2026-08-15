# One store hook

Status: ready-for-agent

Two halves, one of which is smaller than the note assumed.

**The overload.** `useMarkput(token, (store, blockStore) => …)` is additive and non-breaking. It
would serve exactly four component families in both adapters — `Block`, `BlockMenu`,
`DragHandle`, `DropIndicator` — all of which take a `node` prop and open with `block.get(node)`.
One caveat that has to be designed in: `block.get` **creates** a `BlockStore` on first access,
so the overload must not be offered for arbitrary tokens.

**Deleting Vue's `useStore`.** Contractually free — React has no such hook and Vue's is not
exported from its `index.ts`. But the overload does not cover the migration:

- Nine Vue call sites, not seven. `useMarkput` **itself** calls `useStore`, so it cannot be
  migrated onto itself: deleting the hook means inlining `inject(STORE_KEY)` into `useMarkput`.
- Three call sites need the store with no token in scope — `Container.vue` (container and
  rendered), `TokenChildren.vue` (children by owner id), `Suggestions.vue` (container) — plus
  `useOverlay`, which needs the whole `store.overlay`.
- React solves the non-reactive case by putting the member in the object selector
  (`Container.tsx:9-10` passes `host: s.host`, which `readSelected` passes straight through).
  Vue's `useMarkput` returns a `Ref`, so imperative access becomes `x.value.host.rendered()`
  unless a plain-store path is added.

Also update the published architecture doc: it documents `useStore` as a framework hook
(`development/architecture.md:17`, `:472-478`) although neither adapter exports it.

Note for the overload's typing: `Store` **is** public — `@markput/core` exports it
(`core/index.ts:4`) — so the selector parameter is nameable by a consumer, even though neither
adapter re-exports it.
