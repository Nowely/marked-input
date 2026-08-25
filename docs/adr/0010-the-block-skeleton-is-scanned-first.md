# The block skeleton is scanned before the inlines are parsed, and a Row has a kind

Row boundaries and inline matches used to decide each other. A match hid the separator
occurrences inside its extent, so a code fence's blank line was not a boundary; a boundary
bounded a match's open trailing gap, so `'# __slot__'` stopped at the row's end. Neither could be
computed without the other, which is why `rowPass` ran to a fixpoint whose only termination
argument was "each round strictly shrinks the accepted set", why `findSeparators` existed at all,
and why `groupRows` re-implemented the tree builder's edge invariant a second time.

That mutual dependence bought four measured defects. A block-level markup matched wherever its
literal appeared, so `'load 5# peak'` took a heading mid-line. A repeat of the same markup nested
inside its own slot, so a tight list scanned as a staircase rather than as siblings. And a markup
with a CLOSING literal — a fence, YAML frontmatter — matched only at offset 0, because anywhere
else the separator opened the closing literal before the opening one was read.

Decided (2026-08-25, supersedes ADR-0009's deferral of typed rows): **the parser carves the row
skeleton first, and parses inlines per row over that row's own body.** A row is recognised at its
OWN start and nowhere else. A row's kind is an ordinary `Markup`, compiled by the same
`createMarkupDescriptor` a Mark uses and held on the same `MarkupRegistry` under the same option
index — but never entered into the inline alternation, because a closing literal registered there
eats its own opener (measured: two fence variants together yield zero marks). An option declares
one by carrying `row`.

Two rules bound a candidate, and each was chosen against the alternatives rather than assumed.
ONLY THE BODY GAP MAY CROSS A SEPARATOR: a non-body gap whose closing literal STARTS past the
row's own separator refuses the candidate, which is what keeps `'- [x hi⏎there] more'` two rows
while still admitting a fence whose `__meta__` closer IS the separator. AND A KIND WITH A CLOSING
LITERAL MUST END AT A SEPARATOR OR AT END OF INPUT, or a row would begin mid-line and contradict
the one premise the scan rests on.

The stored terminator goes with the fixpoint. A row carries no separator of its own; the join
puts one between every adjacent pair and none after the last, so "the document-final row has
none" is structural rather than stored and then normalized on every move. What the tree keeps
instead is one field — the separator the CURRENT roots were parsed under — because on a layout
flip the boundary reads the projection to decide what to re-parse, and reading the props policy
there would fuse every row before anything could re-derive them.

**The case is the concept count, not speed.** Measured, the inversion's own margin is about 1.2×;
the 12× that the design was once sold on belongs to a defect in the old pass's two quadratic
loops, and it was fixed separately before this landed. **It is not a code reduction.** Measured in
production lines only (`*.spec.*`, `__testing__`, `__snapshots__` and docs excluded): parser +136,
tree +115, seam +50, slots +26, shared +20, storybook +31, React +21, Vue +14 — **net +418**. What
shrinks is what has to be held in the head: one fixpoint, one mutual dependence and two functions
are gone, and a row's kind is now a thing a consumer declares rather than a shape the parser
infers.

Costs, accepted and declared. An inline mark can no longer span a row boundary — a markup that
means to must declare `row`, and it then matches anywhere instead of at offset 0 alone. A typed
row's opener and closing literal are structural bytes: they are not `textContent`, no caret may
enter them, and `anchorAt` answers a row's body start for an offset inside its opener. Copying
part of a typed row re-annotates it, so half a heading copies as `'# half'`. A stray closing
literal typed above an existing one still fuses the rows between them into one raw body; the
body-gap-only rule bounds the damage to one row and the end-at-a-separator rule keeps every other
row starting at a line start.
