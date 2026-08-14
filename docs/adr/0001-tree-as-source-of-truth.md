# The token tree is the source of truth, the value string is its projection

The editor originally held the value as a string and re-derived tokens from it, which meant nothing in the document had a stable identity across an edit. S1 inverted that: the tree owns reads and identity, and `value` is `joinNodes(roots)`. Writes still lower to a string splice and a full re-parse, so identity is _recovered_ after the fact by `adopt()` walking a window rather than _preserved_ by construction — that asymmetry is deliberate, and it is what pays for `gapWindow`, the echo protocol and the `#committed` mirror signal.

Full record: [`docs/records/tree-core-decisions.md`](../records/tree-core-decisions.md); the mechanism is mapped in [`docs/records/tokenmodel-architecture.md`](../records/tokenmodel-architecture.md).
