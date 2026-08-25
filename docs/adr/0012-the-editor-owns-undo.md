# The editor owns undo, and an entry is an edit that LANDED

ADR-0006 made the `beforeinput` guard fail closed, which swallows the browser's native undo. That
was recorded as costing nothing — native undo was already dead in both topologies, measured — and
it left a hole: `Mod+Z` did nothing at all. This record fills it. The editor keeps its own stack,
`store.history`, and `historyUndo`/`historyRedo` become **expressed rather than dropped**. The
guard is unchanged and still cancels every one of those events; what changes is that the two
history types are answered before they reach it.

**A history entry is an `EditRecord`: `{base, next, window, selectionBefore}`.** No `after` beside
`before`, because `next` is both — the next entry's base is this one's `next`, and the stack is
the chain. It is CAPTURED at `CommitSink.commit`, which is the one place both value modes hold the
pre-image: a controlled commit emits and returns without ever reaching the fold, so a fold-sourced
stack has no record at all in the mode this whole seam is designed around, and its `selectionBefore`
would be read at the echo — after the caret has already moved.

**It is EMITTED only when the document actually holds `next`.** In controlled mode that is the
echo's arrival. This is the load-bearing half of the design, and it is what makes a `#replaying`
latch unnecessary in both directions:

- a parent that never echoes leaves NO record, rather than one naming a value the document never
  took. Recorded at commit instead, such an entry buries every good entry under it: the stack's top
  names a document that does not exist, and everything below it is unreachable for good;
- an undo does not go through that sink at all (`TokenModel.replay`), so it emits nothing and the
  stack cannot re-enter itself. There is no state saying "I am replaying" — a replay is simply not
  an edit path. A boolean cleared when the call returns would already be `false` when the echo
  landed, which is ADR-0008's pending latch again.

What an emission owes on landing rides WITH the emission, in `valueBoundary`'s `Emission` record —
the same channel `Window.pairing` rides on, and released by the same test, so there is nothing to
clear when an echo turns out not to be one.

**An UNDO's own stack move is owed at that same moment**, for the same reason and against the same
refusal: a parent may decline the undo where it accepted the edit — a length validator, a
permission check — and an entry consumed on the emission is stranded in the redo stack naming a
document that never appeared, where its base does not match either. Neither side offers it again
and the next edit discards it, so one refusal costs every entry underneath it too. It cannot be a
value comparison after the call: a controlled parent's echo is a render apart, and at the moment
`undo` returns, "refused" and "not yet" are indistinguishable.

**An undo replays the recorded window backwards, it does not write a value.** A `setValue`-shaped
undo restores the right string and re-pairs the rows by index, because a permutation is invisible
to any diff of two strings: measured on `'a\nb\nc'` with the first row rotated to the end, the row
reading `a` afterwards is the node that used to be `b`, taking drag state, block selection and any
consumer state keyed by row id with it. `invertWindow` reads the recorded splice the other way
round, pairing included. The replayed caret is NAMED rather than mapped, because the position an
edit was made from sits inside the span the undo rewrites, and the window arithmetic collapses
every offset inside a window onto its end.

**The named caret is a pair of OFFSETS, not anchors.** Every other member of the record is a value
and this one has to be too: a record is held across arbitrarily many later adoptions, while an
anchor names a node object the very edit it describes may have destroyed — a row merge, a delete
spanning a mark. Applied verbatim, such an anchor restores the right string with a caret in a
detached node: it keeps the `position` it died with, so every numeric reading of the selection
still answers correctly, and `handle()` — so `placeCaret` — declines it and the browser caret never
moves. The offsets live in `base`, which is exactly the projection the replay restores, so they are
resolved against the roots the adoption leaves behind.

**Three rules are derived rather than maintained.** An entry is usable only while the document
still holds the projection its window lives in — one comparison, which is what an out-of-band value
trips, what makes `canUndo` honest rather than merely non-empty, and what lets an entry come back
if the document does. A typing run is recognised from the records themselves — two one-character
insertions, the second where the first ended, in the document the first left behind, inside 500 ms
— so every structural verb is its own step without a list of verbs to keep in sync, and so is a
paste. And a fresh edit discards the redo branch, which is not the same as finding it unusable:
without the discard, editing back to where the branch began would offer it again.

## Costs, declared

**(a) `history` defaults to `true`, so Ctrl/Cmd+Z changes meaning.** It went from doing nothing to
undoing, and Shift+Ctrl/Cmd+Z from nothing to redoing. Strictly an improvement, listed because it
is observable. `history: false` restores exactly the old behaviour: the keys are still cancelled,
and they do nothing.

**(b) Mod+Y is not bound.** One spelling of redo, not two; the Windows one lands when someone asks.

**(c) A controlled parent that transforms the value gets no history.** Every emission comes back as
something else, so nothing ever lands and nothing is recorded. That is the honest answer rather
than a limitation to work around: an entry recorded against a value the parent rejected would
replay a window in the coordinates of a document that never existed.

**(d) A value the editor did not write disables undo while it stands.** A parent writing `value`
itself, or another author's change arriving through it, leaves every entry naming a projection the
document no longer holds. `canUndo` answers `false` until the document is one of them again. The
alternative — mapping recorded windows through foreign changes — is a different design, and this
one does not foreclose it.

**(e) One `EditRecord` is allocated per commit, whether or not anything is listening.** A commit
already parses and adopts the whole document; the record is four fields beside it.

**(f) A delete run does not coalesce, where a typing run does.** The run test is an insertion test
— two one-character insertions, the second where the first ended — and nothing a delete produces
satisfies it, so three characters typed are one undo and three taken back are three. Recognising
runs from the records is what buys "every structural verb is its own step" without a list of verbs;
this is the same rule read from the other side. A deletion run is a rule of its own if someone
wants it, not a bug in this one.

**(g) `canUndo`/`canRedo` answer `false` while `readOnly` is true.** `replay` has always refused
there; the two reads now say so instead of offering an entry that cannot be replayed. The entries
survive the flip and are offered again when it comes off.

## Three departures from the phase's spec, and why

**`EditRecord` carries no `origin`.** The spec's record had two — `'edit'` and `'foreign'` — with
foreign arrivals emitted so the stack could clear its redo branch and close its typing run on them.
Once the entry-usability test above exists, `origin` has no reader left: a foreign value fails that
comparison, and a foreign value between two keystrokes breaks the run's own value-chain test. A
field with no reader is what this repo deletes, so it was not built. The mechanism it would have
served is pinned by `HistoryModel.spec`'s 'does not merge across a value the editor did not write'
and 'stops offering an entry once the parent writes the value itself'.

**`replay` takes the window.** The spec wrote `replay(value, selection?)`. It cannot be that: the
window is the only thing carrying the `Pairing`, and a replay that re-derived its own window is
exactly the `setValue` defect measured above. The signature is `replay(value, window, landing?)`.

**`EditRecord` and `HistoryModel` are not exported from `packages/core/index.ts`.** The spec listed
both among the phase's new core exports. That file's own rule is that the list is what a consumer
RECEIVES, not everything they might want to name, and nothing outside the package receives either:
`store.history` is reached through the public `Store` exactly as `store.block` and `store.tokens`
are, and neither `BlockModel` nor `TokenModel` is exported. A record reaches a consumer only as the
parameter of a `store.tokens.edits` callback, where inference names it. When undo and redo get a
public verb — `MarkputHandle` has none today, so a consumer's own toolbar cannot drive them — that
is the change that decides these exports, from the outside.
