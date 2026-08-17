# The token tree is the source of truth, the value string is its projection

The editor originally held the value as a string and re-derived tokens from it, which meant nothing in the document had a stable identity across an edit. S1 inverted that: the tree owns reads and identity, and `value` is `joinNodes(roots)`. Writes still lower to a string splice and a full re-parse, so identity is _recovered_ after the fact by `adopt()` walking a window rather than _preserved_ by construction — that asymmetry is deliberate, and it is what pays for `gapWindow`, the echo protocol and the `#committed` mirror signal.

**Amended for row moves.** Recovery-after-the-fact has one case it cannot cover: a permutation
of rows. Moving a row past a byte-identical one produces the SAME document, so no diff of the
two strings — window-narrowed, LCS or keyed — can tell that move from a no-op, and today's
adoption keeps every id in place while the contents rotate under them. The asymmetry is
therefore narrowed rather than kept whole: an operation that knows the permutation states it as
a `Pairing` on the commit `Window`, and adoption honours it only where the parse agrees with
every pair. Recovery is still the default and the only path for every other write; the pairing
is a claim the string could not have carried, not a second writer of the tree.

Full record: [`docs/records/tree-core-decisions.md`](../records/tree-core-decisions.md); the mechanism is mapped in [`docs/records/tokenmodel-architecture.md`](../records/tokenmodel-architecture.md).
