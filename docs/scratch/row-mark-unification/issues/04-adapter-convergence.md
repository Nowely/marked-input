# Adapter convergence prototype

Type: prototype
Status: open
Blocked by: 01, 02

## Question

With per-node state (01) and the render path (02) decided, prototype the
React side: block chrome (Block/DragHandle/BlockMenu/DropIndicator — 192
lines React, 198 Vue, 8 call sites reaching `store.block.get(node)` directly)
on the unified path.

Measure what dies in React and what the Vue mirror becomes. Decide the
adapter contract: what state the adapter reads, through what surface, and
which components stay adapter-local versus become defaults. Link the
prototype as an asset; do not land it.
