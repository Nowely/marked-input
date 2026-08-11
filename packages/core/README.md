# @markput/core

The dependency-free TypeScript runtime behind Markput: the token tree, the string
boundary, the DOM binding, selection, keyboard, clipboard, block layout and the
overlay.

**This package is not published.** It has no build output of its own that a user
installs — `package.json` points `exports` straight at `index.ts`. Consume Markput
through one of the two adapters, which bundle the core and re-export the parts of
it that are public:

- [`@markput/react`](https://www.npmjs.com/package/@markput/react)
- [`@markput/vue`](https://www.npmjs.com/package/@markput/vue)

Everything below describes the core's INTERNAL contract with those adapters.

## What the core owns

| module                    | owns                                                                                                                                                                                  |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/features/tokens/`    | the token tree (the source of truth), the string boundary, transactions, adoption, the commit pipeline, the DOM binding and the SELECTION (stored node anchors plus their DOM driver) |
| `src/features/keyboard/`  | `beforeinput` / keydown handling, arrow navigation, block editing                                                                                                                     |
| `src/features/block/`     | block layout, drag and per-row UI state                                                                                                                                               |
| `src/features/overlay/`   | trigger matching and suggestion navigation                                                                                                                                            |
| `src/features/clipboard/` | copy / cut / paste serialization                                                                                                                                                      |
| `src/features/slots/`     | slot resolution for mark and overlay components                                                                                                                                       |
| `src/store/`              | `Store` (the wiring root) and `MarkputApi` (the imperative verbs)                                                                                                                     |
| `src/shared/signals/`     | the reactive primitives (a vendored alien-signals core)                                                                                                                               |

## Root exports

The root barrel (`index.ts`) is the whole surface an adapter may use. It is
deliberately narrow — anything not listed is internal and may move without notice.

| export                                                                                                                                    | kind         | what it is                                                                       |
| ----------------------------------------------------------------------------------------------------------------------------------------- | ------------ | -------------------------------------------------------------------------------- |
| `Store`                                                                                                                                   | value        | the wiring root; both adapters construct exactly one per editor                  |
| `MarkputApi`                                                                                                                              | value        | the imperative verbs (`insertMark`, `replaceRange`, …), reachable as `store.api` |
| `Id`, `TreeNode`, `TextNode`, `MarkNode`, `MarkPatch`, `NodeAnchor`                                                                       | types        | the live tree: the shapes of the public reads and write verbs                    |
| `MarkToken`                                                                                                                               | type         | `denote`'s callback parameter; `Token`/`TextToken` are internal (see `index.ts`) |
| `annotate`, `denote`, `Markup`                                                                                                            | value/type   | the string-domain utilities                                                      |
| `cx`, `key`                                                                                                                               | values       | class-name helpers                                                               |
| `filterSuggestions`, `navigateSuggestions`                                                                                                | values       | overlay list behavior                                                            |
| `getAlwaysShowHandle`                                                                                                                     | value        | drag-handle visibility policy                                                    |
| `OverlayMatch`, `OverlayTrigger`, `CoreOption`, `CSSProperties`, `CoreSlots`, `DataAttributes`, `DraggableConfig`, `Slot`, `SlotRegistry` | types        | the props contract                                                               |
| `computed`, `effect`, `watch`, `Computed`, `SignalValues`                                                                                 | values/types | the `useMarkput` runtime the adapters build their hooks on                       |
| `readSelected`, `Selectable`, `ObjectSelector`                                                                                            | value/types  | the selector protocol behind `useMarkput(s => …)`                                |
| `toMarkInfo`, `MarkInfo`                                                                                                                  | value/type   | the whole implementation of `useMarkInfo`                                        |

### The `SlotRegistry` augmentation

`SlotRegistry` looks unused to grep and is not. Both adapters carry

```ts
declare module '@markput/core' {
    interface SlotRegistry {
        /* framework element and component types */
    }
}
```

in `src/augment.ts`. Dropping the export collapses `Slot` to `unknown`, which
fails every slot component as a JSX element. A module augmentation is not an
import.

## Further reading

In-tree, next to the code:

- [`src/features/tokens/README.md`](src/features/tokens/README.md) — the tree,
  adoption, the commit pipeline, the DOM walk and the handle contract.
- [`src/store/README.md`](src/store/README.md) — ownership boundaries and the
  wiring order.
- [`src/shared/signals/README.md`](src/shared/signals/README.md) — the reactive
  primitives and when to reach for each.
- [`src/features/tokens/parser/README.md`](src/features/tokens/parser/README.md)
  — markup descriptors and the tokenizer.

Longer-form architecture docs live in
`packages/website/src/content/docs/development/`.

## Development

```bash
# Build the package
pnpm build

# Run tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run the parser benchmark tripwire
pnpm bench
```

## License

MIT
