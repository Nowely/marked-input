# The range guard in `stepAnchor` is dead

Status: ready-for-agent

`tree/anchors.ts` guards `stepAnchor` with
`if (offset < 0 || offset > offsetOfAnchor(roots, 'end')) return undefined` before the
round-trip check on the next line. The round-trip already rejects both cases: `anchorAt`
clamps an out-of-range offset to `start`/`end`, so `offsetOfAnchor(stepped) === offset` is
false and the function answers `undefined` anyway.

Measured: deleting the line leaves the whole core suite green — 48 files, 981 tests, no
failures. It survived every mutation run against the new `stepAnchor` tests for that reason.

AGENTS.md keeps a guard only when it is load-bearing. Delete the line, or keep it and add the
comment saying which case it catches that the round-trip does not — but the measurement says
there is no such case.
