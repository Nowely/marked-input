# The commitCost bench never finishes at "100 rows"

Status: needs-info

`pnpm bench` cannot complete: `commitCost.bench.ts` stalls in its "100 rows" ladder under Vitest 4
and Vitest 5 alike, and its "1000 rows" ladder never runs. Measured on 2026-09-26:

- Vitest 5.0.2: each rung is its own test and reports when it ends. The last to end was
  "100 rows › L5b stored selection, no post-edit caret"; the next in order, "C1 caret write only",
  never ended, and the run was killed after 900 s. Each rung carries a 60 s test timeout
  (`benchRung`), and it never fired.
- Vitest 4.1.11: results print per ladder. The three inline ladders printed, "100 rows" never did,
  and the run was killed after 360 s.

Every other "100 rows" rung ends in about 1.2 s (1 s measured plus 0.2 s warm-up), and C1 costs
~0.005 ms per call on the inline documents, so this is a stall, not a slow rung. A timeout that
cannot fire suggests the page's thread is blocked — a synchronous loop somewhere in the caret write
on a row document — but that is a hypothesis: nothing has profiled it.

Needs a diagnosis before it is a task: run C1 alone on the "100 rows" document and see where it
spins.
