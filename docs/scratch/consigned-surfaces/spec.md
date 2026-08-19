# Consigned surfaces: the framework hands core its elements

Status: ready-for-agent

## Problem Statement

Markput's core has to know which DOM element belongs to which Token. Today it works that out by
walking: after every paint, the DOM walk descends the Container in lockstep with the live Token
tree and pairs them off by position. Nothing in that walk is knowledge the framework did not
already have — React and Vue each held every one of those elements a moment earlier and threw the
association away.

Re-deriving a fact somebody else already holds costs concepts, and the bill lands on two people.

**The maintainer** pays most. Following one keystroke end to end means holding eight concepts, and
half exist only to make the walk possible: the render epoch (a counter whose only job is to wake
the Container component so that a paint happens so that the walk can run), the pending-structural
latch (which merges announcements while a paint is outstanding), the walk's own all-or-nothing
frame alignment with its unbind-versus-kill rule, and Vue's `nextTick` announcement watcher, whose
comment records that a post-flush watcher is not a substitute and that removing it turns 136
assertions red.

**The consumer** pays in contract. The render epoch is published core surface that exists for no
reason a consumer could ever care about, and the render-announcement hook obliges both adapters to
report their own paints back into core.

**This is not a performance problem, and any version of this spec that says otherwise is wrong.**
Two earlier drafts claimed it was; both were killed by measurement. See "What the measurements
actually say". The case is concept count — the maintainer's own G2, ranked above efficiency from
the start.

## Solution

Turn the pairing around. The framework already holds each element at the moment it creates it, so
it hands that element to core through a ref callback — consignment — instead of core re-deriving
it afterwards by walking.

This is not a new mechanism in this codebase. The Host already accepts exactly this shape twice:
one registry for a Mark's slot host and one for consumer chrome. Both are ref callbacks keyed by a
stable identity, and both already feed the walk. The change generalises that registry to cover
every Token element and the Block row wrapper, at which point the walk has nothing left to derive
and is deleted.

Once the walk is gone, everything that existed to schedule it goes with it. Core no longer needs
the framework to announce a paint, so the render-announcement hook and the render epoch are
deleted. Core no longer has an outstanding-paint state, so the pending-structural latch is deleted.

From the outside nothing changes: the same markup renders, the same value comes out, the same
components mount, and the caret behaves exactly as it does today. What changes is two published
surfaces disappearing and four concepts leaving the keystroke path.

## What the measurements actually say

Recorded here because they are the justification, and because two of them refuted earlier drafts of
this same file.

**The routing does not pay for its concepts.** Most of the commit system is optimisation: the
render epoch, the text/structural routing, the latch, the delta ledger. Pricing the alternative —
every commit takes the structural path, so the walk runs every time — gives 0.26-0.29 → 0.35-0.40 ms
at inline 100 marks and 0.70-0.73 → 1.81-1.86 ms at block 1000 rows. Worst case ~1.85 ms on a
2000-token document.

**Always re-rendering is cheaper still.** A Mark value change already forces a whole-Container
re-render today, so its cost is directly measurable: against an idle control of the same shape it
adds *nothing measurable to a frame* at 10, 100 or 400 marks. The synchronous cost is about 1 µs
per mark, and that figure includes core's own parse and adoption, not just the render.

**Fine-grained rendering already works, and it is not what the routing buys.** A Token component
subscribes to its own node's value, meta and children, so a Mark repaints itself without the tree
re-rendering; a text edit repaints nothing at all, because the per-Surface effect writes it. What
the render epoch actually buys is not avoided rendering — it is the only thing that makes the
Container re-render so its layout effect calls the render-announcement hook so the walk can run. It
is a scheduling device wearing an optimisation's clothes, and consignment removes the need for it
outright.

**Latency is settled and is not a reason for anything here.** At 1000 marks the splice, the full
re-parse, adoption's O(document) suffix rewrite and the whole commit pipeline are together ~0.74 ms.
Typing stays inside a frame up to ~500 inline spans and at every block-layout size tested. Details
and the instrument caveats are in
[`native-caret-motion/measurements.md`](../native-caret-motion/measurements.md).

## User Stories

1. As a maintainer, I want the number of concepts needed to follow one keystroke to go down, so
   that the code is followable without a map.
2. As a maintainer, I want each element-to-Token association to have exactly one owner, so that no
   second mechanism can disagree with it.
3. As a maintainer, I want core to stop re-deriving a fact the framework already held, so that the
   two cannot drift.
4. As a maintainer, I want the migration to be a series of steps each of which is green and
   revertible on its own, so that I can stop at any point without leaving the repo broken.
5. As a maintainer, I want the first step to change no behaviour at all, so that I can prove the
   new mechanism agrees with the old one before deleting anything.
6. As a maintainer, I want a proof that the framework never writes into an element core has leased,
   so that the whole bet rests on a measurement rather than on an assumption.
7. As a maintainer, I want the loss of the walk's self-healing property measured during the
   migration, so that I find out whether it ever mattered instead of guessing.
8. As a maintainer, I want the rendered DOM snapshot to stay byte-identical through the mechanism
   swap, so that "no markup changed" is checked rather than asserted.
9. As a maintainer, I want the walk and its spec deleted rather than left dormant, so that there is
   no second answer to "which element is this Token".
10. As a maintainer, I want the behaviour changes stated in the commit body and the release notes,
    so that no behaviour change ships buried under "internal cleanup".
11. As a maintainer, I want the existing browser suite to be the primary evidence, so that the
    change is proven against real adapters and a real caret rather than against mocks.
12. As a maintainer, I want no permanent machinery added for a failure mode that does not occur in
    practice, so that the reduction is actually a reduction.
13. As a consumer of the React or Vue adapter, I want the editor to work without my component
    announcing its own renders back into the library, so that I cannot break the editor by
    restructuring my container.
14. As a consumer who passes a component rather than an element as the container slot, I want
    tokens to render, so that the library's own documented slot shape keeps working — this is the
    case Vue's watcher exists for.
15. As a consumer, I want no published API whose purpose I cannot understand, so that a
    render-scheduling counter stops being part of the contract I read.
16. As a consumer rendering custom Mark components, I want my component's own re-renders not to
    detach it from the library's model, so that state inside my component survives.
17. As a consumer rendering custom Mark components, I want my component to keep working when it
    renders extra chrome inside itself, so that the library's element bookkeeping does not depend
    on my DOM shape.
18. As a consumer using block layout, I want row drag, duplicate, delete and reorder to behave
    exactly as before, so that the change is invisible to my users.
19. As a consumer registering chrome through the control registry, I want it to stay excluded from
    the editable region, so that my controls do not become editable text.
20. As a consumer in controlled mode, I want the caret after an echo to be where it is today, so
    that a value round-trip through my state does not move the cursor.
21. As a consumer whose parent transforms the value before echoing it, I want the editor to stay
    consistent, so that a normalising change handler does not corrupt the caret.
22. As a consumer whose parent never echoes, I want the editor to stay usable, so that a rejected
    edit does not leave the caret stranded.
23. As a person typing, I want the caret to be correct on the first frame after a structural edit,
    so that I never see it flicker to the wrong place and back.
24. As a person typing into a freshly created empty Row, I want the first keystroke to land in that
    Row, so that pressing Enter and typing works as one gesture.
25. As a person dragging a Row to a new position, I want my caret to still name the same character
    afterwards, so that reordering does not move my cursor.
26. As a person using an inline mark, I want deleting at its edge to still swallow the whole mark,
    so that the mark behaves as one atomic thing.
27. As a person selecting text with the mouse, I want a commit landing mid-drag not to collapse my
    selection, so that a background edit does not interrupt me.
28. As a person who has just clicked somewhere, I want a commit that was already in flight not to
    yank my caret back, so that my click wins.

## Implementation Decisions

### The registry replaces the walk

The Host gains element consignment and loses the render lifecycle. Today it owns two things: the
Container reference and an event the adapters fire after each paint. That event is deleted. In its
place, the existing ref-registry pattern is generalised to cover every Token's own element,
registered by the Token component, and the Block row wrapper, registered by the Block component.

Registration is keyed by stable Token id, matching how the slot-host registry already keys.
Deregistration happens on the ref's null call.

The text Surface needs no separate registration: the walk gives a Surface to text Tokens only, so
a text Token's element *is* its Surface. That equivalence is preserved.

The slot-host and chrome registries keep their current shape unchanged.

### A Mark component must forward its ref — DECIDED, and it is a major break

The Token's element is rendered by the CONSUMER's component, not by markput, so consignment needs
the consumer to pass the ref through. The two adapters differ, and only one of them is free:

- **Vue costs nothing.** A ref on a component resolves to the instance, and the repo already
  unwraps `$el` for exactly this — the container and row slots both do it today. For a single-root
  component it is automatic and the consumer does nothing.
- **React requires forwarding.** There is no `$el` equivalent; a function component that ignores
  its `ref` prop drops it silently. Since a Mark component is mandatory — mark resolution throws
  without one — this touches every React consumer that renders a custom Mark.

**Decision: require it.** This is not a new principle, it is an existing one applied to a third
slot: the container slot already requires it (the repo's own fixtures destructure
`({ref, ...props})` and pass it on) and so does the row slot. The consumer's change is one line.

Consequences that must ship with it:

- a MAJOR version, called out in the release notes rather than buried;
- the documented contract has to change. `development/how-it-works.md` currently states the
  opposite — "Features do not rely on DOM child order, public data attributes, or user-provided
  refs to locate tokens" — and that sentence becomes false;
- the mark and text slot documentation gains the requirement, with an example;
- the `Span` slot is affected in principle and almost free in practice: no demo app, story fixture
  or README example uses it.

The alternative of wrapping every Token in a markput-owned element was rejected: it adds one
element per Token, which moves the cross-framework DOM snapshot, flips the arms of the DOM-to-Anchor
projection, and is invalid inside the `Nested` fixtures, which render Marks as `ul`/`li`.

### What the walk did, and where each part goes

| What the walk did | New owner |
| --- | --- |
| pair element to Token by position | the registry, pushed |
| create and kill handles | consignment creates; deconsignment plus absence from the tree kills |
| arm the per-Surface text effect | consignment |
| apply the editable-state policy to the element | consignment |
| compute chrome roots by walking each control up to the Container | unchanged — already separate, and it never depended on the Token walk |

Two properties of the walk are deliberately not preserved, and both must be called out in the PR:

- **All-or-nothing frame alignment.** A count mismatch dropped a frame and every frame below it.
  Under a pushed registry a mismatch is not representable — an element is consigned under an id or
  it is not.
- **Self-healing.** Re-arming the text effect on every paint repaired a Surface corrupted between
  paints. Refs do not re-fire on an unchanged element, so this is lost. **Decision: do not replace
  it.** A permanent detector would be machinery for a failure mode nobody has observed, and the
  point of this work is to remove machinery. Instead it is *measured out* during the migration by
  the drift check in A1, which is deleted with the walk whatever the answer turns out to be.

### Step order

Each step is separately green and separately revertible.

**One step has already landed** and is recorded for continuity: the per-Surface writer now splices
in place with a minimal `Text.replaceData` rather than assigning whole content, so a DOM Range
anchored in a Surface survives a commit instead of being orphaned. It was justified on correctness,
not on speed.

| | Step | Contents |
| --- | --- | --- |
| **A0** | Ref contract | Pass the ref through the Mark and text slots in both adapters, unwrapping it on the Vue side. Update `how-it-works.md` and the slot docs. Nothing in core reads it yet, so this is inert on its own — and it is the step that carries the major-version break. |
| **A1** | Shadow registry | Add consignment and the refs. Add a dev-only assertion that the registry's mapping equals the walk's, for every Token element and the row wrapper. Add a dev-only drift check: a `MutationObserver` on the Container that throws when a mutation lands inside a leased Surface while core is not writing. The walk still owns everything. Zero behaviour change; the DOM snapshot must not move by a line. |
| **A2** | Delete the walk | DONE. The registry is the owner; `isBlock` and the frame alignment are gone with it. Surfaced one contract that A0 did not: a consumer's `Span` IS the text Surface and so cannot be wrapped the way a Mark is — it must forward its ref or its text never binds. Nothing in the repo used `Span` except the render-count instruments, which now forward it through the shared mark factory. |
| **B2** | Split the announcement | DONE, and moved AHEAD of A3 — the original order was wrong. Deleting the render epoch silences the commits that move no element (a row reorder, a mark value change), because the announcement came from the bind. Splitting `changed` into `committed` (per commit) and `bound` (per bind) gives those commits a clock of their own, which is what makes A3 possible at all. |
| **A3** | Delete the scheduling | IN PROGRESS. Delete the render epoch, the render-announcement hook and Vue's `nextTick` watcher; bind becomes an effect on the token layer (see below). The pending-structural latch went ahead of this step in PR #285, and with it the divergence sweep's reason to read it. Production side is a 32-line deletion across five files; the migration is the cost. |

The drift check exists to answer one question while both mechanisms are live and comparable: does a
leased Surface ever get written by anyone but core? It is deleted at A2 regardless, and the answer
goes in the A2 commit body.

**A3 is no longer blocked.** An earlier prototype tried to delete the render epoch by having each
Token report its own paint, and that double-bound on every structural commit in Vue because the
Token's update hook beat the Container's. Consignment is a different mechanism — refs fire during
the patch, and nothing needs waking — so that failure does not transfer.

### A3 is bind-as-effect, and the two rival shapes are measured out

Three shapes for "when does bind run" were prototyped once the announcement hook was gone. They are
recorded because the losing two are the obvious ones, and the argument that picked the winner was
wrong twice before measurement corrected it.

| | Shape | Migration red | bind | Async window | Generation counter | Caret pulse |
| --- | --- | --- | --- | --- | --- | --- |
| A | Scheduler + microtask | **253** | async | yes | — | from the scheduler |
| B | Manual invalidation counter | — | sync | no | **hand-written** | none |
| **C** | **Effect on the token layer** | **11** | **sync** | **none** | not needed — the subscription *is* the invalidation | from the effect itself |

C was first rejected on an argument: signals flush synchronously per write (`if (!batchDepth)
flush()`), a batch coalesces them but core does not own the batch because the framework calls refs
one by one — so mounting a 1000-mark document reads as 2000 refs × O(tree). It was then reinstated
on a counter-argument — refs fire bottom-up, so at mount every element is consigned before the
effect exists — and on a steady-state measurement: on a live editor with 50 marks, a plain keystroke
ran the effect 0 times and a structural edit 2.

**The counter-argument is false, and the ref storm is real.** The steady-state numbers hold; the
mount numbers were never taken. Refs *are* bottom-up, but that is not what orders mount: core
publishes `nodes` only once `host.container` is set, and the tree seeds inside `host.onMounted`,
which runs synchronously from the container's ref. Tokens therefore paint in a LATER commit, with
the effect already live, and every unbatched registry write flushes it.

Measured after the fact, through both real adapters, with a counter in `bindNow`:

| N marks | binds at mount, React | binds at mount, Vue |
| --- | --- | --- |
| 10 | 22 | 22 |
| 50 | 102 | 102 |
| 200 | 402 | 402 |
| 400 | 802 | 802 |
| 800 | 1602 | 1602 |

One whole-tree bind per consigned element — `2N+2` for this document shape, identical in both
adapters across five runs. Core-only wall clock over the same registry writes: 2.6 ms at 101 nodes,
7.2 at 201, 41.5 at 501, 166.3 at 1001, **678 ms at 2001**. `ms/N²` is flat at ~1.66e-4 across the
whole range; every doubling of N costs 4×.

**This is a regression, not a standing cost.** At HEAD `host.rendered()` fires once per Container
render from one call site per adapter, so mount is O(1) binds. C as prototyped turns mount from
Θ(N) into Θ(N²). That is a different question from the one rung L7 answered: L7 traded a *constant*
0.26 → 0.40 ms per keystroke for a deleted concept and was accepted on that basis. An asymptote is
not a constant.

The control measurement names the fix: the same registry writes wrapped in one `batch()` collapse to
**one** bind — 1.0 / 2.4 / 6.5 ms at N = 200 / 400 / 800, against 33 / 96 / 386 ms unbatched. The
cost is entirely self-inflicted coalescing, not framework overhead.

Two smaller facts from the same measurement, both worth keeping:

- One bind is worse than O(tree): `#childSequenceHostsFor` is a linear scan over ALL registrations
  and is called once per node, so a single bind is O(nodes × hosts) before the per-node work.
- The dev-only divergence sweep is a second whole-tree walk per bind and inflates every figure above
  by 10–20%. It is dead in production, so the production curve is slightly better than measured — and
  the *test* curve is worse.

**The effect subscribes to exactly three things** — live `roots`, the consignment counter, the
commit counter. Everything the projection itself reads is read inside bind's own `untracked`, so an
unrelated text edit cannot wake it. The commit counter is in the list deliberately: without it a
commit that moves no element never binds, `bound` stops being the one DOM clock, and the caret loses
its post-commit re-place. That precision is the whole risk of this shape, so it is pinned by its own
spec rather than left to the migration.

One registry counter covers token elements, rows and controls together — nothing wants to rebind for
one of them alone, and it is a counter rather than the maps because the maps are mutated in place
and a signal compares by identity.

**A gap this closed:** `control()` did not bump the counter. A control mounted off the commit clock —
a menu opened from a block-store signal — left the control roots stale. Three tests caught it.

**A finding that is not a test fix.** `anchorFor`'s fallback was pinned by
`falls back to the owner INVERTED when a neighbour left the tree`, which constructs "elements still
bound, nodes already out of the tree" by relying on a structural commit *not* binding before the
adapter repaints. Under C every commit binds, so that state is unreachable by that route and the
fallback may be dead code. Decision: delete it — but only after proving unreachability by some route
other than the one the test used. Re-aiming the test would bury the question.

### The fix for the storm: rebind one id, keep the whole-tree bind on the commit clock

Three fixes were designed against the measurement and judged. The chosen one is a hybrid, and the
two it beat are recorded because both are the obvious ones:

- **Coalesce to a microtask** — 12 lines, kills the asymptote, and buys it with the exact async
  window this step exists to delete. It also turns ~200 synchronous core tests into `await` ones,
  surrendering the property that caught the missing `control()` bump, and it makes a mark's text
  empty inside `useLayoutEffect` / `onMounted` at mount.
- **Bracket the framework's paint from the adapter** — resurrects `host.rendered` with two edges
  instead of one, and does not even work: when `slots.container` is a component the Container never
  updates, so neither edge fires. That topology is what the deleted `nextTick` watcher existed for.

The shape to build instead:

- Extract `rebind(id)` — the body of bind's current per-node iteration, reading the registries fresh
  for that one id. Every ref factory already has the id, so nothing new has to be threaded.
- Registry writes (`consign`, `consignRow`, `control`, and `children`, which bumps nothing today)
  call `rebind(ownerId)` directly and mutate a long-lived `byElement`, instead of bumping a counter
  that destroys "id X moved" into "+1".
- `bind()` keeps its signature, its whole-tree walk, its `treeIds` kill sweep and its fresh
  `byElement`; its loop just calls `rebind`. The effect keeps subscribing to `roots` and `commits`,
  so every commit still binds in full.

Mount becomes one full bind plus N O(1) rebinds. Keeping the full bind on the commit clock is what
makes this safe rather than clever: order-insensitivity and the per-surface self-heal survive
structurally, the kill sweep stays tree-driven, and `bind.spec.ts`'s whole-tree cases stay green.

Two riders are not optional. `#pendingChildSequences` must be keyed by owner id, or `rebind` is
still O(registrations) per ref and mount stays quadratic with a smaller constant. And the dev
divergence sweep must move back to `committed`: it walks the whole tree on every `bound`, so left
where it is, dev and test mount stays quadratic on its own.

**Order of work.** The bench rung comes first, before any production change: the repo has no mount
benchmark at all, which is exactly why a Θ(N) → Θ(N²) mount regression reached a working tree. Then
the `rebind` extraction. Then the docblock rewrite and the clock re-aiming — and the eleven red
tests get triaged one by one rather than regenerated, because two of them are the divergence
detector, whose net has gone slack precisely because the always-on bind re-arms every surface.

### The announcement contract

Deleting the latch changes the published change event from "once per paint, with applies merged" to
"once per commit". Measured: exactly one test of 1492 turns red, and it pins only the announcement
*count*. The safety the latch was credited with is already unconditional elsewhere — the
unchanged-announcement path returns empty added and removed lists by construction — so no consumer
can learn an id the DOM never showed either way. What the latch actually bought is narrower: a
Token that survived a commit and whose own props changed is now announced before its repaint.

This ships as a SemVer-visible change, not as cleanup.

## Testing Decisions

**One seam: the shared browser spec harness.** A good test here asserts what a user or a consumer
can observe — a caret position, a rendered element, a mount, a render count — and never that core
holds a particular map. The invariant this change rests on is a *framework* fact, so core unit
tests cannot see it: a core-level test of the registry would exercise a mock adapter and prove
nothing about React or Vue.

Prior art is the render-count spec, which already holds render-count and remount gates against both
adapters from one file. Its own docblock records why: while those gates lived in two per-framework
files the contract drifted, and one gate existed only for React. Follow its shape — a baseline
taken after mount and focus, then assertions on the delta.

New pins, all in that harness:

- **The leased element is never written by the framework.** The load-bearing invariant. Drive the
  four behaviours that could violate it — a plain re-render, a prop change on a Mark, a sibling
  Token born, and a keyed reorder — and assert the element core holds is still the element in the
  document and its text is still the model's. Both adapters, one file.
- **The caret lands correctly for a Token born by the commit.** The case the post-paint step exists
  for: placement must still happen when the element did not exist at edit time.
- **The caret is not stolen from the user.** A commit in flight must not move a caret the user has
  since placed elsewhere.
- **The component-container case.** The container slot as a component, which is what Vue's deleted
  watcher existed for. Extend the existing slots coverage rather than adding a file.
- **Deconsignment kills.** A Token leaving the tree must release its handle, so a stale handle
  cannot resurrect.

Existing gates that must stay green and are the real regression net: the whole browser suite run by
both projects, the render-count and remount gates, the block and drag suites, and the
cross-framework DOM snapshot — which must be **byte-identical** through A1. Do not regenerate it.
If it moves, diff it, explain the diff, and treat an unexplained diff as a regression.

The two dev-only checks in A1 are instruments, not seams. They run inside every existing browser
test for free and are deleted at A2.

## Out of Scope

- **The document layer.** The parser, adoption, the edit window, row identity, positions as stored
  state, Rows as a markup. That is the other half of the architecture and has its own arc, now
  re-priced — see [`token-born-edit/spec.md`](../token-born-edit/spec.md).
- **The caret's own redesign.** Three mechanisms decide the caret today and the duplicates are
  worth deleting, but that is a separate change with its own regressions to avoid. Nothing here
  depends on it.
- **Removing the text-component slot.** A public API break that is cleanly separable.
- **The change event's payload.** Whether the delta and its ledger survive at all is a separate
  question. This spec changes only *when* the event fires, not what it carries — though it does
  make the ledger's last in-core consumer removable, which is why the block-store change is
  recommended first.
- **Composition and IME.** Untouched, and core has no handling for it at all. That gap needs its
  own ticket and is the only genuine functional hole the investigation found.
- **Undo/redo.** Not affected and not addressed.
- **Anything justified by latency.** Settled and closed.

## Further Notes

**A prerequisite that is already built and green.** Converting the Block row store to a WeakMap
keyed by the Token removes the last in-repo consumer of the change event's payload. It passes all
five gates including the browser drag suites. Landing it first makes A3's announcement changes
smaller. It belongs in its own commit.

**Why this ordering and not the reverse.** The framework-owned-DOM "floor" argument recorded in the
token-born arc claims four concepts are the irreducible price of letting the framework paint. That
claim is overstated, and five of its eight concepts have now been deleted or shown removable with a
green suite. Two of the four are the price of *re-deriving a fact the framework already holds*, and
one more is the price of *waiting for a paint the framework never had to announce* — both removable
without touching DOM ownership, which is what this spec does. The honest floor is one concept: a
post-paint step for the caret on structural edits. Even the design that took DOM ownership outright
still has that step.
