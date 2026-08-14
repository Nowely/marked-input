# One address space above `tree/` — every position is a `NodeAnchor`

Code above the tree layer used to address the document by absolute string offset, against a `value` that is props-first and can run ahead of the tree while a controlled parent's echo is in flight — so a caller could slice string A at positions taken from string B, and block's drag caret did exactly that, hiding the error behind `Math.min`. Every read and write outside `features/tokens/tree/` now names a `NodeAnchor`; `anchorAt` and `offsetOf` inside that layer are the only places a number is formed.

The checkable form is a grep with a fixed allowlist — `tree/`, `parser/`, `block/` and `keyboard/blockEdit.ts` may read `.position`. Adding to that list is a contract change, not a convenience.

Full record: [`docs/records/established-contracts.md`](../records/established-contracts.md).
