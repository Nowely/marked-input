# Established Contracts

Contracts that later work is expected to hold to. Lifted verbatim from
`docs/conventions.md`, which now covers only how a spec is written.

- S1 public API: spec v2 §2.3 (`MarkputApi`, `TreeNode = TextNode | MarkNode`
  one structure, `NodeAnchor`, verbs over `applyRange`, `changed` payload).
- S1 internal: `adopt(tree, window, parsed, selectionBefore?)` returns the
  `TransactionResult` — the single change feed; CommitSink splits
  uncontrolled/controlled commit policy.
- S2 addressing (Cut B): **one address space above `tree/`** — every read and
  write outside `features/tokens/tree/` names a `NodeAnchor`, never an absolute
  offset. `anchorFor` is the single DOM→model projection; `anchorAt` / `offsetOf`
  are the tree layer's own coordinate boundary and the only place a number is
  formed. `adopt` carries the selection as anchors (`selectionAfter`), resolved
  from pre-mutation offsets inside adoption. The checkable form is a grep with a
  fixed allowlist — `tree/`, `parser/`, `block/` and `keyboard/blockEdit.ts` (the
  whole-value rewriter) may read `.position`; adding to that list is a contract
  change, not a convenience.
- S2 commit wave: `TokenModel`'s `onResult` runs `pipeline.apply` → publish the
  value → `selection.repair` inside **one `batch`**. `changed` is an event, so
  without the batch it flushes its subscribers mid-`apply` and every consumer
  sees the new tree against the previous generation's selection.
- S2 representation (Cut A): **one representation** — the token tree. Both
  adapters render `TreeNode` off `tokens.nodes()`; `Token` survives only as the
  parser's output and the §7.1 test oracle. `renderEpoch` is a counter carrying
  "the renderer must run", not data.
- S2 ownership: `TokenModel` owns the value, the DOM binding AND the selection
  (`tokens.selection` plus a private `SelectionDriver`). There is no
  `store.selection` and no construction cycle between `Store`'s fields.
- Public-API invariant: **`MarkputApi` neither takes nor returns an absolute
  document offset.** Stated of `MarkputApi`, not of every export — `Store` is a
  value export, so `store.edit.setValue(text, caretOffset?)` and
  `store.tokens.anchorAt` / `offsetOf` remain reachable through it by design.
- Error handling: boolean/`undefined` + throw for developer errors; no
  Result/Either types.
