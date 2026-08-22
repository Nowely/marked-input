# Chrome-layer prototype

Type: prototype
Status: open

## Question

Re-scoped 2026-08-22, after the maintainer took the chrome-out-of-the-row
direction in [ticket 02](02-one-render-path.md). This was "adapter
convergence, blocked by 01 and 02"; it is now the prototype that validates the
direction those two tickets wait on.

Build the rough thing and measure it: block chrome — grip, drop indicator,
menu — rendered NOT inside each row, but as one per-editor absolutely
positioned layer addressed by row id. React only; the Vue mirror is a
question for afterwards.

What the prototype must answer, because none of it is measured:

1. **Row geometry.** Today `.Block { position: relative }`
   (`styles.module.css:76-77`) is what makes `.SidePanel` and `.DropIndicator`
   free — they are absolute inside it (`:86-87`, `:132-133`). A layer has to
   track row rects instead. Does that survive scroll, resize, wrapped rows, a
   row whose height changes as you type, and rows inside a consumer's own
   `slots.container`?

2. **Render fan-out.** `DropIndicator` is rendered twice per row and each
   instance subscribes to its own row's `dropPosition` (`Block.tsx:56,64`). A
   naive editor-level signal invalidates 2N components per dragover tick
   instead of 2. Measure it; `renderCount.spec.ts` gates exact numbers but has
   no drag gate, so a new one is part of the answer.

3. **Does the row element become its own child-sequence host?** That is the
   prize: it removes A's extra `display:contents` span and A's custom-
   `slots.block` freeze hazard. Confirm on real DOM, not on paper.

4. **Hit-testing and drag.** The grip is a drag source and the row is a drop
   target. With chrome outside the row, what listens where, and does HTML5
   drag still work when the source element is not a descendant of the row?

5. **What actually dies.** Count it: `Block.tsx`, `DragHandle.tsx`,
   `BlockMenu.tsx`, `DropIndicator.tsx` (192 lines React, 198 Vue), the
   per-row `control()` registrations, `BlockStore`'s three cleanup closures
   and its `refs.container` identity guard, `BlockController`'s WeakMap.

Do not land it. Link the prototype as an asset and report measurements. Two
facts to respect while building: `control()`'s `contenteditable` write is not
foldable (verified twice in source), and `refs.container` has exactly two
readers, both inside `BlockStore` — the guard at `:54` and `setDragImage` at
`:121` — while `Block.tsx:42-45` hands the SAME element to `consign(node.id)`
and `attachContainer`, so the registration is a provable duplicate.
