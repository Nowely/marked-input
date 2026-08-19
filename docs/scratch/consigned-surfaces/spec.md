# Consigned surfaces: the framework hands core its elements

Status: ready-for-agent

## Problem Statement

Markput's core has to know which DOM element belongs to which Token. Today it works that out by
walking: after every paint, `dom/bind.ts` descends the Container in lockstep with the live Token
tree and pairs them off by position. Nothing in that walk is knowledge the framework did not
already have — React and Vue each held every one of those elements a moment earlier and threw the
association away.

Re-deriving a fact somebody else already holds is not free, and the bill lands on three different
people.

**The maintainer** pays in concepts. Following one keystroke end to end means holding eight of
them, and half exist only to make the walk possible: `renderEpoch` (a counter whose only job is to
wake the Container component so that a paint happens so that the walk can run), the
`pendingStructural` latch (which merges announcements while a paint is outstanding), the walk's own
all-or-nothing frame alignment with its unbind-versus-kill rule, and Vue's `nextTick` announcement
watcher, whose comment records that `{flush: 'post'}` is not a substitute and that removing it
turns 136 assertions red.

**The consumer** pays in contract. `renderEpoch` is published core surface that exists for no
reason a consumer could ever care about, and `host.rendered()` obliges both adapters to announce
their own paints back into core.

**The person typing** pays for it indirectly, and the direct version of this claim is WRONG — it
was in an earlier draft of this spec and measurement killed it. The Surface writer assigns
`textContent`, which is a replace-all: measured in Chromium, a *changed* string destroys the Text
node and every DOM Range anchored in it. But no user ever sees that, because `SelectionDriver`
re-places the caret after every commit and repairs it — probed in both adapters by forcing a
replace-all mid-edit and watching the next commit put the caret back.

An earlier draft claimed the unconditional repair is "the dominant per-keystroke work, 1.84 ms of
a 2.66 ms keystroke". That is ALSO wrong and is corrected here rather than left standing: the
figure came from a tight-loop benchmark, and against frame-paced typing the caret write is not the
cost at all — a bare forced reflow costs the same, so the bill is the layout, and the layout
happens once per frame whoever triggers it. See
[`native-caret-motion/measurements.md`](../native-caret-motion/measurements.md).

So the in-place Surface write earns its place on correctness, not speed: a DOM Range anchored in a
Surface survives a commit instead of being orphaned. Nothing here is a latency argument.

## Solution

Turn the pairing around. The framework already holds each element at the moment it creates it, so
it hands that element to core through a ref callback — `consign(id, element)` — instead of core
re-deriving it afterwards by walking.

This is not a new mechanism in this codebase. `Host` already accepts exactly this shape twice:
`children(ownerId)` registers a Mark's slot host and `control()` registers chrome. Both are ref
callbacks keyed by a stable identity, both already feed the walk. The change generalises the
registry that exists to cover every Token element and the Block row wrapper, at which point the
walk has nothing left to derive and is deleted.

Once the walk is gone, everything that existed to schedule it goes with it. Core no longer needs
the framework to announce a paint, so `host.rendered()` and `renderEpoch` are deleted. Core no
longer has an outstanding-paint state, so the `pendingStructural` latch is deleted. The caret's
post-paint placement stops being an event subscription and becomes a `queueMicrotask` core
schedules for itself, which lands after the framework's patch in both adapters.

The Surface writer stops assigning `textContent` and edits the existing Text node in place through
a minimal `Text.replaceData`, so a DOM Range anchored in a Surface survives a commit instead of
being orphaned with pre-edit data.

From the outside almost nothing changes: the same markup renders, the same value comes out, the
same components mount, and the caret behaves exactly as it does today. What changes is two
published surfaces disappearing.

## User Stories

1. As a person typing in a Markput field, I want my caret to stay where I put it when the text
   around it changes, so that I do not have to re-find my place after every edit. (Already true;
   this spec must not regress it, and does not deliver it.)
2. As a person typing in a long document, I want each keystroke to stay well inside a frame, so
   that typing never feels behind my fingers. (Measured: it does, up to ~500 inline spans and at
   every size tested in block layout. This spec does not change that either way.)
3. As a person typing, I want the caret to be correct on the first frame after a structural edit,
   so that I never see it flicker to the wrong place and back.
4. As a person selecting text with the mouse, I want a commit landing mid-drag not to collapse my
   selection, so that a background edit does not interrupt me.
5. As a person who has just clicked somewhere, I want a commit that was already in flight not to
   yank my caret back to where the edit happened, so that my click wins.
6. As a person typing into a freshly created empty Row, I want the first keystroke to land in that
   Row, so that pressing Enter and typing works as one gesture.
7. As a person dragging a Row to a new position, I want my caret to still name the same character
   afterwards, so that reordering does not move my cursor.
8. As a person using an inline mark, I want deleting at its edge to still swallow the whole mark, so
   that the mark behaves as one atomic thing.
9. As a consumer of `@markput/react` or `@markput/vue`, I want the editor to work without my
   component announcing its own renders back into the library, so that I cannot break the editor by
   restructuring my container.
10. As a consumer who passes a component (not an element) as `slots.container`, I want tokens to
    render, so that the library's own documented slot shape works — this is the case Vue's
    `nextTick` watcher exists for, and it must keep working under the new mechanism.
11. As a consumer, I want no published API whose purpose I cannot understand, so that
    `renderEpoch` — a render-scheduling counter — stops being part of the contract I read.
12. As a consumer subscribing to `changed`, I want its guarantee stated honestly, so that I know
    whether an announcement means "the model moved" or "the DOM now shows it".
13. As a consumer rendering custom Mark components, I want my component's own re-renders not to
    detach it from the library's model, so that internal state in my component survives.
14. As a consumer rendering custom Mark components, I want my component to keep working when it
    renders extra chrome inside itself, so that the library's element bookkeeping does not depend on
    my DOM shape.
15. As a consumer using block layout, I want row drag, duplicate, delete and reorder to behave
    exactly as before, so that the change is invisible to my users.
16. As a consumer registering controls through `control()`, I want them to stay excluded from the
    editable region, so that my chrome does not become editable text.
17. As a consumer in controlled mode, I want the caret after an echo to be where it is today or
    better, so that a value round-trip through my state does not move the cursor.
18. As a consumer whose parent transforms the value before echoing it, I want the editor to stay
    consistent, so that a normalising `onChange` handler does not corrupt the caret.
19. As a consumer whose parent never echoes, I want the editor to stay usable, so that a rejected
    edit does not leave the caret stranded.
20. As a maintainer, I want the number of concepts needed to follow one keystroke to go down, so
    that the code is followable without a map.
21. As a maintainer, I want each element-to-Token association to have exactly one owner, so that no
    second mechanism can disagree with it.
22. As a maintainer, I want the migration to be a series of steps each of which is green and
    revertible on its own, so that I can stop at any point without leaving the repo broken.
23. As a maintainer, I want the first step to change no behaviour at all, so that I can prove the
    new mechanism agrees with the old one before deleting anything.
24. As a maintainer, I want a proof that the framework never writes into an element core has
    leased, so that the whole bet rests on a measurement rather than on an assumption.
25. As a maintainer, I want the loss of the walk's self-healing property named and covered, so that
    a Surface corrupted between paints does not silently stay corrupted.
26. As a maintainer, I want the rendered DOM snapshot to stay byte-identical through the mechanism
    swap, so that "no markup changed" is checked rather than asserted.
27. As a maintainer, I want the caret's post-paint scheduling to be one concept, so that it is not
    split across an event, two watches and a latch.
28. As a maintainer, I want the microtask-ordering caveat documented at the site that relies on it,
    so that the next person does not rediscover it from React's source.
29. As a maintainer, I want `dom/bind.ts` and its spec deleted rather than left dormant, so that
    there is no second answer to "which element is this Token".
30. As a maintainer, I want the behaviour changes stated in the commit body and the release notes,
    so that no behaviour change ships buried under "internal cleanup".
31. As a maintainer, I want the existing browser suite to be the primary evidence, so that the
    change is proven against real adapters and a real caret rather than against mocks.
32. As a maintainer, I want the dev-only agreement assertion to be temporary scaffolding with a
    named deletion point, so that it does not become permanent dead weight.

## Implementation Decisions

### The registry replaces the walk

`Host` gains element consignment and loses the render lifecycle. Today it owns two things: the
Container reference and a `rendered` event the adapters fire after each paint. The `rendered` event
is deleted. In its place, the existing ref-registry pattern — already present as `children(ownerId)`
and `control()` — is generalised to cover:

- every Token's own element, registered by the Token component
- the Block row wrapper, registered by the Block component

Registration is by stable Token id, matching how `children(ownerId)` already keys. Deregistration
happens on the ref's null call.

The text Surface needs no separate registration: `bind` gives a Surface to text Tokens only, so a
text Token's element *is* its Surface. That equivalence is preserved.

`childSequenceHost` and controls keep their current registries unchanged.

### What `bind` did, and where each part goes

The walk does five things. Each needs a new owner before the walk can be deleted.

| What the walk did | New owner |
| --- | --- |
| pair element to Token by position | the registry, pushed |
| create and kill `TokenHandle`s | consignment creates, deconsignment plus tree absence kills |
| arm the per-Surface text effect | consignment |
| apply the editable-state policy to the element | consignment |
| compute control roots by walking each control up to the Container | unchanged — already a separate function fed by the `control()` registry, and it never depended on the Token walk |

Two properties of the walk are deliberately not preserved, and both must be called out in the PR
body:

- **All-or-nothing frame alignment.** A count mismatch dropped a frame and every frame below it.
  Under a pushed registry a mismatch is not representable — an element is consigned under an id or
  it is not.
- **Self-healing.** Re-arming the text effect on every paint repaired a Surface corrupted between
  paints. Refs do not re-fire on an unchanged element, so this is lost. See Testing Decisions for
  the check that replaces it, and Further Notes for the open risk.

### `changed` and the announcement contract

`changed` currently fires once per paint, with applies merged by the `pendingStructural` latch. It
becomes once per commit, and it is no longer a post-paint clock.

This is a public API break and ships as one. Measured on this branch: deleting the latch turns
exactly one test red out of 1492, and that test pins only the announcement *count* — every DOM
assertion inside it still passes. The window is reachable through the public API in both adapters.
The safety the latch was credited with is already unconditional elsewhere: `announceUnchanged()`
returns empty `added` and `removed` by construction and filters `updated` through the announced set,
so no consumer can learn an id the DOM never showed with or without the latch. What the latch
actually bought was narrower: a Token that *survived* a commit and whose own props changed is now
announced before its repaint.

### The caret's post-paint step

Core schedules its own placement with `queueMicrotask` instead of subscribing to a post-paint
announcement. Measured in both adapters, including the Vue list-reorder path that moves the caret's
own element.

The ordering holds only for discrete-origin updates. `beforeinput`, `keydown` and `drop` are
discrete, so the keystroke, delete and drag paths are safe. A commit raised from `MarkputApi` inside
a promise takes a non-discrete task and the microtask fires too early. **Decision:** keep an
idempotent placement at consignment time as the fallback for that path only. It is idempotent, so it
costs nothing on the paths where the microtask already won. The caveat is documented at the
scheduling site, with the source reference.

### The Surface write

`TokenHandle`'s Surface writer stops assigning `textContent` and edits the Text node in place. The
existing string comparison is kept — it is what makes the write a no-op when nothing changed. The
change is what happens when something *did* change: instead of replacing every child, the writer
addresses the existing Text node and replaces its data, so the node survives and the caret with it.

A Surface that has no Text node yet, or more than one, falls back to the current whole-content
assignment. That fallback is where a split Surface is normalised, and it must happen exactly once
rather than on every write.

### Deletions

Once the above lands: `dom/bind.ts` and its spec; `renderEpoch` from `CommitPipeline`, `TokenModel`
and both Container components; `host.rendered()` and both adapters' calls to it; the
`pendingStructural` latch; Vue's `nextTick` announcement watcher; and the `render` bit on the
transaction result if nothing else reads it. `dom/commit.ts` collapses from 228 lines to roughly 40
— element lookups plus the announcement — at which point it should be folded into `DomModel` rather
than kept as a module.

### Step order

Each step is separately green and separately revertible.

1. **Shadow registry.** Add consignment and the refs. Add a dev-only assertion that the registry's
   mapping equals the walk's, for every Token element and the row wrapper. The walk still owns
   everything. Zero behaviour change; the DOM snapshot must not move by a line.
2. **Delete the walk.** The registry becomes the owner. Handle lifecycle, text-effect arming and
   editable state move to consignment. Delete `bind.ts`, its spec, and the assertion from step 1.
3. **Surgical Surface write.** Independent of 1 and 2; can land before them if convenient.
4. **Self-scheduled caret.** Delete `renderEpoch`, `host.rendered()`, `pendingStructural` and Vue's
   `nextTick` watcher. Collapse `commit.ts`.

## Testing Decisions

**One seam: the shared browser spec harness** in `packages/storybook/src/pages/`. A good test here
asserts what a user or a consumer can observe — a caret position, a rendered element, a mount, a
render count — and never that core holds a particular map. The invariant this whole change rests on
is a *framework* fact, so core unit tests cannot see it: a core-level test of the registry would
exercise a mock adapter and prove nothing about React or Vue.

Prior art is [`renderCount.spec.ts`](../../../packages/storybook/src/pages/renderCount.spec.ts),
which already holds render-count and remount gates against both adapters from one file. Its own
docblock records why: while those gates lived in two per-framework files the contract drifted, and
one gate existed only for React. Follow its shape — a baseline taken after mount and focus, then
assertions on the delta.

New pins, all in that harness:

- **The leased element is never written by the framework.** The load-bearing invariant. Drive the
  four behaviours that could violate it — a plain re-render, a prop change on a Mark, a sibling
  Token born, and a keyed reorder — and assert that the element core holds is still the element in
  the document and that its text is still the model's. Both adapters, one file.
- **The Surface's Text node survives a text edit.** The Surface write has NO red-turns-green caret
  test and must not pretend otherwise: the unconditional re-place repairs the caret either way.
  What discriminates the two writers is node identity, so that is what the gates assert — in core
  for the write itself, and in the browser harness for the part only a real adapter can answer,
  namely that React and Vue leave the node alone across the same commit.
  A split Surface is deliberately NOT covered: it takes the whole-content fallback on its first
  changed write, so there is no caret to preserve there, and normalising first does not help
  (measured — merging the halves collapses the range by itself). It self-corrects from the second
  write on, and that recovery is what gets pinned instead.
- **The caret lands correctly for a Token born by the commit.** The case the post-paint step exists
  for: the placement must still happen when the element did not exist at edit time.
- **The caret is not stolen from the user.** A commit in flight must not move a caret the user has
  since placed elsewhere.
- **The non-discrete path.** A commit raised from the public API inside a promise, asserting the
  fallback placement covers it.
- **The component-container case.** `slots.container` as a component, which is the case Vue's
  deleted watcher existed for. Extend the existing Slots coverage rather than adding a file.

Existing gates that must stay green and are the real regression net: the whole browser suite run by
both projects, the render-count and remount gates, the block/drag suites, and the cross-framework
DOM snapshot — which must be **byte-identical** through step 1. Do not regenerate it. If it moves,
diff it, explain the diff, and treat an unexplained diff as a regression.

The step-1 dev assertion is scaffolding, not a seam. It runs inside every existing browser test for
free and is deleted at step 2.

## Out of Scope

- **The document layer.** The parser, `adopt`, the Window, `Pairing`, positions as stored state,
  Rows as a markup. That is the other half of the architecture and has its own arc in
  `docs/scratch/token-born-edit/`.
- **`EditContext`.** Proven to work in the pinned Chromium and it deletes ADR-0006 outright, but it
  replaces the *input producer* and is separable from this change. It needs its own spec, and the
  spellcheck question answered on a real browser with a dictionary first.
- **Removing the `Span` slot.** A public API break that is cleanly separable; it deserves its own
  spec and its own release note.
- **The `changed` payload.** Whether `TokenDelta` and the ledger survive at all is a separate
  question. This spec changes only *when* `changed` fires, not what it carries.
- **Composition and IME.** Untouched here, and the repo has no coverage for it at all. Step 3 and
  the document layer both interact with it; that gap needs its own ticket.
- **Undo/redo.** Not affected and not addressed.

## Measured: the optimisations do not pay for themselves

Added after the fact, because it changes why this spec is worth doing.

Most of the commit system is optimisation — `renderEpoch`, the text/structural routing, the
`pendingStructural` latch, the delta ledger. They exist to avoid work. Here is what the work costs
if you simply always do it.

**Always binding** (`commitCost.bench.ts`'s L7 rung: every commit takes the structural path, so
`bind` walks the whole tree every time), three runs on an idle machine:

| document | today | always bind |
| --- | --- | --- |
| inline 100 marks | 0.26-0.29 ms | 0.35-0.40 ms |
| block 1000 rows | 0.70-0.73 ms | 1.81-1.86 ms |

**Always re-rendering.** A mark value change already forces a whole-Container re-render today
(`renderEpoch` bumps on `updated.some(mark)`), so its cost is measurable directly. Median of 15
operations, each given a frame, against an idle control of the same shape:

| document | added to the frame | synchronous cost per update |
| --- | --- | --- |
| 10 marks | 0 ms | 0.043 ms |
| 100 marks | 0 ms | 0.167 ms |
| 400 marks | 0 ms | 0.413 ms |

The synchronous cost is linear — about 1 µs per mark, and that figure includes the core commit's
own O(document) parse and adoption, not just the render. Nothing measurable reaches the frame.

Two things follow.

**The routing does not pay for its concepts.** The worst case of deleting it is ~1.85 ms on a
2000-token document, and nothing at all at realistic sizes.

**Fine-grained rendering already works and is not what the routing buys.** `Token` subscribes to
its own node's `value`/`meta`/`children`, so a mark repaints itself without the tree being
re-rendered, and a text edit repaints nothing at all — the per-Surface effect writes it. What
`renderEpoch` actually buys is not avoided rendering; it is the only thing that makes the Container
re-render so that its layout effect calls `host.rendered()` so that `bind` can run. It is a
scheduling device wearing an optimisation's clothes, and consignment removes the need for it
outright.

## Further Notes

**Two investigations are still running and could change step 4.** A caret redesign is in flight
that treats the caret as an intent stated by the edit rather than recovered afterwards. If it lands,
step 4's scheduling question changes shape — the microtask stops being "when do we re-place" and
becomes "when do we apply the pending intent". Do not start step 4 before checking that outcome.
Steps 1–3 are unaffected either way.

**A prerequisite that is already green.** Converting the Block row store to a `WeakMap` keyed by the
Token removes the last in-repo consumer of `changed`'s payload. It has been built and passes all
five gates including the browser drag suites. Landing it first makes step 4's announcement changes
smaller. It belongs in its own commit.

**The open risk, named rather than resolved.** The walk was self-healing and the registry is not. If
a Surface is corrupted between paints — by an extension, by a stray consumer write, by a browser
editing path nobody guarded — the old code repaired it on the next paint and the new code will not.
Cheapest experiment: a dev-only `MutationObserver` on the Container that throws when a mutation
lands inside a leased Surface while core is not writing, run across the whole browser suite. Do this
during step 1, while both mechanisms are live and can be compared.

**Why this ordering and not the reverse.** The framework-owned-DOM "floor" argument recorded in
`docs/scratch/token-born-edit/spec.md` claims four concepts are the irreducible price of letting the
framework paint. That claim is overstated. Two of the four are the price of *re-deriving a fact the
framework already holds*, and one more is the price of *waiting for a paint the framework never had
to announce* — both removable without touching DOM ownership, which is what this spec does. The
honest floor is one concept: a post-paint step for the caret on structural edits. Even the design
that took DOM ownership outright still has that step.
