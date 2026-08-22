# One input pipeline with layout arms

Type: grilling
Status: open

## Question

`blockEdit.ts` (229 lines) attaches a second keydown listener and a second
beforeinput capture listener to the same container as `input.ts` (139 lines),
with a parallel replacement pipeline its own comment calls "The SAME
inputType→replacement table as `input.ts`" (`blockEdit.ts:188-190`), a
parallel Backspace/Delete arm, and a parallel all-selected arm. Shared helpers
already live in `beforeInput.ts` (blockEdit uses 5 of its 7 exports, input.ts
uses 6).

What is the unified pipeline shape — one listener pair with layout-aware
arms? What survives of the row-resolution tier (`findActiveRow`,
`rowFromAnchor`, `anchorOwner`, `rowHandle` — 46 lines) — anchors only?
Where do the block-unique behaviors live in the unified table: Enter inserts
`props.separator()`, merge via `a.mergeWith(b)`, the insertParagraph
fail-closed drop?

Known drift risk this ticket ends: blockEdit has its own history of diverging
from input.ts.
