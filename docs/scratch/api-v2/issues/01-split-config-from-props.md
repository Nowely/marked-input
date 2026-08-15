# Split configuration from props

Status: ready-for-human

`option.mark` and `option.overlay` are config and prop bag at once — see the spec. Two concrete
consequences a consumer hits today:

- A **static** `mark` object silently drops `value` and `meta`, because `resolveOptionSlot`
  returns it instead of merging (`slots/resolveSlot.ts:5-10`). Only the function form gets the
  base. `Nested/MarkdownOptions.ts:117` is the in-repo workaround.
- `overlay.trigger` and `overlay.data` are configuration that is nevertheless spread onto the
  consumer's component, which is why `Overlay.spec.ts:111` exists and why Vue's `Suggestions`
  sets `inheritAttrs: false`.

Decide the shape: a dedicated config section per option (`overlay: {trigger, data}` stays config,
props move elsewhere), or keep one object and merge instead of replace. The sketch that prompted
this — `overlay: {trigger, data}` — is already today's shape, so it renames and removes nothing
by itself; what it adds is the expectation that `label`/`icon` are config too, and `TOverlayProps`
is an open generic constrained to `CoreOption['overlay']`, so nothing in the type stops them
being forwarded as props.

Fold in while the type is open: `MarkProps.children` is declared but never resolved (children
arrive as framework children instead), and the `Option` JSDoc example still shows a `slot` field
that exists on no type — it is mirrored into the published API docs.

Needs a person: `Option` and `MarkProps` are published from both adapters.
