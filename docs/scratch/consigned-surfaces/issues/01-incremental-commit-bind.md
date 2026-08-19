# Bind only what a commit changed, instead of walking the whole tree

Status: needs-triage

DEFERRED 2026-08-19, by maintainer decision, after the trade was costed. Not wontfix: the balance
below is made of measurements that will move, and this file exists so the next person re-reads the
numbers instead of re-deriving the argument.

## The change

Today every commit runs the whole-tree `bind`, and a token's own ref runs `rebind(id)`. The
proposal is to make the commit incremental too: bind the ids adoption reports as added or updated,
kill the ids it reports as removed, and stop walking.

## What it would save

**~14 lines and ~1.1 ms.** The walk-specific code is `collectTree` (6 lines), the `nodeById` build
(2) and the kill loop (6). `rebindNode` (22) and `forget` (17) are shared with the ref path and stay
either way. The time is the recorded L6-vs-L7 gap in `commitCost.bench.ts`: +0.09 ms at 201 nodes,
+1.1 ms at 2000.

## What it would cost

Four things the walk pays for with no code of their own:

1. **The heal.** Re-arming every per-surface writer is a side effect of the walk. It is what
   corrects a surface written behind the model's back — composition/IME, or an `execCommand` while
   the guards are disposed — and it is the ground on which the dev divergence detector was deleted.
   Removing the walk without replacing it means such a surface stays wrong until the next edit to
   that same token.
2. **Kill by absence.** The live id space comes from the tree, so the DOM layer never reads
   `result.removed` and never learns adoption's contract.
3. **`nodeById` as a pure derivation.** It is the walk's own output today. Incrementally it becomes
   mutable state with two writers — the mirrored state AGENTS.md says to collapse.
4. **Order-insensitivity.** A wrong intermediate state is corrected by the next commit. Incremental
   binding lets one survive.

Plus what has to come back: `apply()` regains the `TransactionResult` parameter, deleted as dead
when the routing went; `added` carries subtree ROOTS only (`tree/types.ts`), so maintaining
`nodeById` means walking each added subtree — a smaller walk, not no walk; and `computeControlRoots`
still needs a trigger. If the heal has to be replaced rather than dropped, the divergence detector
comes back at 94 lines, and it has already proven hard to keep correct: the guard written for it in
`e061acf7` silently disabled it everywhere, which only measurement caught.

## Re-evaluate when any of these changes

- **The walk shows up in a frame measurement.** `M1` and `L6` are the rungs; the caret track's
  frame-interval method (`docs/scratch/native-caret-motion/measurements.md`) is how to ask whether
  ~1.1 ms is visible at all next to the layout cost already measured as dominant.
- **Composition/IME gets handled.** It is the one production writer that reaches a bound surface
  behind the model's back, and it has no coverage anywhere in the suite. If nothing can write a
  bound surface but the model, the heal stops being load-bearing and cost (1) disappears.
- **Bind's per-node work grows.** The walk is O(tree) with a small constant today. Anything that
  makes a node's share expensive changes the arithmetic without changing the shape.
- **`nodeById` or `computeControlRoots` grows a second reason to be maintained incrementally.**
  Then the mirrored-state cost is being paid anyway and this change gets cheaper.

## Comments

Costed while closing A3. The whole-tree bind was accepted at rung L7 on its own merits before this
question was asked, and the detector's deletion then leaned on it — so reopening this is a decision
about both, not about the walk alone.
