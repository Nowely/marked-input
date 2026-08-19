# Let the browser move the caret on the common typing path

Status: needs-triage

Reopens: [ADR-0006](../../adr/0006-beforeinput-guard.md)

## The finding that forces this

Measured on this branch, `packages/core/src/features/tokens/commitCost.bench.ts` and
`caretCost.bench.ts`. At inline 1000 marks (42 KB, 2001 tokens) a keystroke decomposes as:

| stage | cost |
| --- | --- |
| string splice | 0.002 ms |
| + full document re-parse | 0.41 ms |
| + adopt, including the O(document) suffix rewrite | 0.55 ms |
| + the whole commit pipeline | 0.74 ms |
| **mounted keystroke** | **~16-40 ms** |

Everything the architecture work has been aimed at — the parse, adoption, the commit pipeline —
is together **~3%** of a keystroke. It is not reachable as a performance problem at any document
size a user will produce.

The remaining ~97% is one thing: **writing the selection forces a synchronous layout of the whole
editing host.** Three follow-up measurements pin it down and close off the obvious remedies:

- **It is not frequency.** Exactly one `removeAllRanges`/`addRange` pair runs per keystroke,
  counted directly. There is nothing to deduplicate.
- **It is not the write itself.** The same call on clean layout is 0.001 ms at 10 spans and at
  2000. Only a write that follows a DOM mutation is expensive.
- **It is not locality.** Dirtying the caret's own surface — what a keystroke does — costs the
  same as dirtying one at the far end of the document (91 ms vs 72 ms at 2000 spans, one number
  under the noise).
- **It is not `contenteditable`.** A plain non-editable host pays the same (83 ms).

Two candidate fixes are already dead:

- **Skip the write when the DOM already shows the target.** Built, measured, reverted. It cannot
  help the typing path: typing genuinely moves the caret by one, so the DOM and the model
  legitimately differ every time.
- **Write the caret before the mutation, on clean layout.** Closed by the DOM's own range
  adjustment rules, not by measurement. After inserting at the caret the wanted position is
  *inside* the inserted text, and no pre-edit boundary maps there — a point at the insertion
  offset does not move, and a point after it overshoots by the whole insertion.

One cheap win has already landed: `Selection.collapse` instead of `removeAllRanges` + `addRange`
pays the forced layout once instead of twice, worth ~24% of a keystroke
(`perf(core): place the caret with Selection.collapse instead of addRange`). That is the last
improvement available without changing who moves the caret.

## What is left

Only this: **stop cancelling the input for the common case, and let the browser insert the
character and move the caret itself.** The browser does that inside its own pipeline and never
forces a synchronous layout from JS.

This reopens ADR-0006, whose guard is fail-closed by design: the container is the one editing
host, so any default the guard leaves standing edits DOM the model owns. That reasoning is sound
and this proposal does not dispute it — it argues the exception is narrow enough to be stated
exactly rather than left to a default.

## The narrow case

Let the browser handle a `beforeinput` only when **all** of these hold:

- `inputType` is `insertText` with non-empty `data` — no deletes, no paste, no drop, no
  composition, no `insertParagraph`
- the selection is COLLAPSED
- the caret sits inside a bound text Surface, not at a container boundary, not at a Mark edge
- that Surface's token has no adjacent Mark whose markup the inserted character could complete
- the editor is uncontrolled, or the controlled parent echoes verbatim (undecided — see below)
- not block layout for the first cut

Everything else keeps today's fail-closed path unchanged.

## What the model then has to do

The browser writes into the Surface, which breaks the "exactly one writer per Surface" invariant
for the duration of one input. So the model must, on the `input` event that follows:

1. read the Surface's new text and reconcile the token from it, rather than splicing the value and
   writing back
2. NOT rewrite the Surface — the per-Surface effect must recognise the DOM is already correct and
   skip, which the in-place writer already does (its comparison short-circuits an equal string)
3. NOT write the selection — the browser has already moved it correctly
4. still run the parse, because the inserted character may complete a markup and turn text into a
   Mark; when it does, that commit falls back to the ordinary cancelled path and repaints

Step 4 is the subtle one: the parse still has to run to decide whether a Mark was born, and the
measurement says that is fine — the parse is 0.41 ms at 1000 marks and is not the problem.

## Open questions, to be answered before any code

1. **Does it actually avoid the cost?** This is a browser-behaviour claim and must be measured
   before it is built: does an uncancelled `insertText` in a 2000-span host cost what the cancelled
   path costs? The harness for this exists (`caretCost.bench.ts`).
2. **Controlled mode.** The parent may reject or transform the value, but the browser has already
   written it. Reverting means rewriting the Surface and the caret — paying exactly the cost this
   change exists to avoid, plus a visible flicker. Possibly this exception applies only to
   uncontrolled editors.
3. **What does the browser do at a Surface's edges?** Typing at offset 0 or at the end of a
   Surface adjacent to a Mark may insert into the neighbouring node, or split it. The guard's
   condition list above must be proven against real Chromium behaviour, not assumed.
4. **Undo.** Letting the browser edit puts entries in the native undo stack that the model does
   not know about, which is a behaviour the repo has never defined either way.
5. **Is EditContext the better shape for the same idea?** It gives the same property — the browser
   moves the caret and never mutates author DOM — without a per-input exception list, and it also
   closes the composition hole. But it is a much larger change and carries its own prices
   (spellcheck lost by spec, Firefox/Safari hard break, IME display becomes core's job). The
   measurement here does **not** favour EditContext on latency grounds: a non-editable host pays
   the same forced layout. It favours it only because the browser owns caret motion.

## Recommendation

Answer question 1 first. It is a bench, not a build, and if an uncancelled `insertText` does not
avoid the layout then this whole direction closes and the honest conclusion is that a large
document simply costs what it costs under framework-owned DOM.

If it does avoid it, the exception is worth specifying properly — and question 5 should be
settled at the same time, because building the exception list and then replacing it with
EditContext six months later would be the expensive order.

## What this does NOT justify

The parse, adoption's suffix rewrite, and the commit pipeline are ~3% of a keystroke. No work on
any of them can be motivated by latency. If they are worth changing it is for concept count (G2),
which is what the maintainer ranked above efficiency in the first place — and that motivation
should be stated on its own rather than borrowing a performance argument the measurements do not
support.
