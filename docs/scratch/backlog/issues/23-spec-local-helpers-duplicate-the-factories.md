# Spec-local helpers duplicate the factory modules

Status: ready-for-agent

Hand-rolled helpers private to one spec file duplicate the shared factories. Byte-identical
today: `mountInline` / `mountBlock` across `seam/TokenHandle.spec.ts`, `dom/TokenHandle.spec.ts`
and `TokenModel.index.spec.ts`; `asText` in two files; `textAnchorOf` / `textAnchor` in two;
`rowsOf` in two. The modules that should own them already exist —
`tokens/__testing__/tokenFactories.ts`, `tokens/__testing__/mountFixtures.ts`, and `defineMark`
in `storybook/src/shared/lib/marks.{react.tsx,vue.ts}`.

Not a pure move: `mountFixtures.ts:65 mountStructuralInline` returns
`{store, container, textSurface, textNode}` while all twelve local call sites destructure
`span`, and `mountFixtures.ts:60` throws unless the surface renders a Text node. Upgrade the
shared fixture's signature rather than forking a near-duplicate.

Explicitly out of scope, checked and rejected: `treeOf` (`dom/bind.spec.ts:23`) returns
`{tree, roots}` where `nodesOf` throws the tree away — a superset, not a duplicate; and the
per-spec `Parser` setups carry different markup sets, so they are not consolidatable. The
separate candidate worth its own pass: two faker-seeded document generators sit inline in
`tree/adopt.property.spec.ts:46-64` with no factory module.
