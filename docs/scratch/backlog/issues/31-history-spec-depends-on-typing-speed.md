# The history spec depends on typing speed

Status: ready-for-agent

`Base/history.spec.ts` › "undoes a typed run on Mod+Z and redoes it on Shift+Mod+Z" types `XYZABC`
and expects one undo to take all six characters. It failed in 2 of the 18 full runs of the
2026-09-25/26 dependency update — vue under coverage on Vitest 4, react in a plain run on Vitest 5
— and the next run was green both times. Both failures read the same:

```
AssertionError: expected last "vi.fn()" call to have been called with [ 'Undo me' ]
-   "Undo me",
+   "Undo meXYZAB",
```

One undo took only the last character. A run stays open while each character follows the previous
one within `RUN_MS = 500` of `Date.now()` (`HistoryModel.ts:12,131`), so a pause over 500 ms before
`C` makes `C` an entry of its own — exactly the value received. That such a pause happened is a
hypothesis, but no other known cause removes exactly `C`, and both runs were loaded: two browser
projects in parallel, one of the two runs under coverage.

The spec checks a wall-clock rule while leaving the wall clock running.

## Scope

Hold the clock in this spec, so the six keystrokes are one run by construction: the run rule is
the subject, the machine's speed is not. Hold it at a real timestamp, not near `0` — `#runGrewAt`
uses `0` as "no run is open", which only reads as closed because `Date.now()` is far from it
(`HistoryModel.ts:133`).

## Verification

The spec passes with the clock held, and still catches a broken rule: with `RUN_MS` set to `0` it
fails. `pnpm test` green.
