# Does a trigger registry exist?

Status: needs-info

The sketch pairs marks that carry their own overlay config with a separate array:

```
overlays={[{trigger: '/', render: SlashMenu}]}
```

No such registry exists — the probe iterates `props.options()` only
(`OverlayController.ts:147`), and `OverlayRenderer` resolves one component from the matched
option.

The half that already works: a markup-less option is legal, and one trigger can serve several
options today. What breaks is the commit — `choose()` returns early when the matched option has
no markup (`OverlayController.ts:111-112`), and no parser is built for it
(`TokenModel.ts:418`). So "several marks behind one `/` trigger" is expressible now and dies at
selection time.

**Unanswered, and it decides everything:** does the registry *replace* `option.Overlay` and
`option.overlay.trigger`, or coexist with them? Two sources for the same answer is the wart this
whole spec is trying to remove.

Two constraints for whichever way it goes. `render` would be a third naming convention beside
`Overlay` (component) and `overlay` (props) — pick one. And option **order is load-bearing**:
marks are matched to options by index (`resolveSlot.ts:72`), with undefined markups holding
their slot (`MarkupRegistry.ts:21-26`), so a registry that reorders or filters options breaks
mark rendering.
