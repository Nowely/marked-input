# One address space above `tree/` — every position is a `NodeAnchor`

Code above the tree layer used to address the document by absolute string offset, against a `value` that is props-first and can run ahead of the tree while a controlled parent's echo is in flight — so a caller could slice string A at positions taken from string B, and block's drag caret did exactly that, hiding the error behind `Math.min`. Every read and write outside `features/tokens/tree/` now names a `NodeAnchor`; `anchorAt` and `offsetOf` inside that layer are the only places a number is formed.

The checkable form is `packages/core/src/addressSpace.spec.ts`: it scans every core source outside `features/tokens/` and fails on a `.position` or `.slotRange` read, naming the file and line. Comments are stripped first, so prose about an offset a call site deliberately does NOT form stays legal.

The allowlist this ADR originally enumerated — `tree/`, `parser/`, `block/` and `keyboard/blockEdit.ts` — is gone, and nothing replaces it: the first two are inside `features/tokens/`, which owns the coordinate space, and the last two no longer read a position at all. `block/`'s last read was the slot arithmetic in `operations.ts`, which moved into `tree/siblings.ts` when row merging became a node verb; `keyboard/blockEdit.ts` had already been carrying an allowlist entry for a COMMENT. The rule is now the directory boundary, with no exceptions to keep in sync.

Amending it is still a contract change. Two things this check deliberately does not cover: the adapters, where `TreeNode.position` is published API a consumer may read, and absolute offsets that never touch `.position` — `keyboard/blockEdit.ts` still carries `caretIndex()` and `placeCaret(0 | Infinity)`, which are DOM-space measures, and `EditController.setValue`'s `caretOffset`, which survives while reorder still composes a whole document.

Full record: [`docs/records/established-contracts.md`](../records/established-contracts.md).
