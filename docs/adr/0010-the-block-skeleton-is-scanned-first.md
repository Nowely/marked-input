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
loops, and it was fixed separately before this landed. Re-measured 2026-08-27 on the same
generated document (medians of 40 after 20 warmups, three independent runs, ±4–10% between runs),
that margin is 1.3× at 1000–8000 rows and 1.1× at 250 — and it is CONDITIONAL, which the flat
figure above hid. It holds only where the markups are declared as row kinds; declare the same
markups as inline marks and the new parser is at parity or marginally slower (2.87 ms against
2.68 at 4000 rows). The win is a row kind leaving the inline alternation, not the scan being
cheaper. Nothing here is an argument for the inversion; the argument is the four defects above.
**It is not a code reduction.** Measured in
production lines only (`*.spec.*`, `__testing__`, `__snapshots__` and docs excluded): parser +136,
tree +115, seam +50, slots +26, shared +20, storybook +31, React +21, Vue +14 — **net +418**. What
shrinks is what has to be held in the head: one fixpoint, one mutual dependence and two functions
are gone, and a row's kind is now a thing a consumer declares rather than a shape the parser
infers.

## Amendment, 2026-08-27: the before and after, measured construct by construct

Re-run on the real parsers — the old one checked out of history into a worktree, the new one from
the tree — so a future reader need not take the four defects above on trust. OLD is `3c4b54ad` at
its own default of two newlines; NEW is HEAD at one.

| input | OLD | NEW |
| --- | --- | --- |
| `load 5# peak` | text plus a heading MARK mid-line | one row of plain text |
| `- a` / `- b` / `- c` | one row, a staircase of three nested marks | three sibling rows |
| a fence that is not the first block | one row, the whole fence plain text | two rows; the fence keeps its meta and body |
| frontmatter away from offset 0 | plain text | recognised |
| `> one` / `> two` | one row, a quote nested inside a quote | two quote rows |
| a three-line table | one row, a staircase six deep | three rows, cells carved |

**One correction to the story this record used to tell.** The list staircase was the two-newline
DEFAULT's fault, not the fixpoint's: the old parser at one newline already produced three sibling
rows. What only the inversion fixes is the fence away from offset 0, the frontmatter away from
offset 0, and the nesting inside a table line — the flip alone makes the first of those worse,
shredding a fence into four rows of text.

**What left, in deleted assertions.** The parser's own specs went 120 to 144 across this change:
sixteen removed, of which two were renames and one a move, so thirteen real deletions. They
asserted the machinery this record replaces — that a separator inside an opaque `__value__` or
`__meta__` gap was not a boundary, that a closed slot survived a separator, that an open trailing
gap closed across a row boundary, and the fixpoint's own reason to exist (*"recomputes boundaries
when closure drops the match that hid one"*). Two of them came back with the SAME input and the
opposite expectation: `'**a\n\nb**'` is now plain text. Stated as a capability rather than as a
diff: **an inline mark may no longer span a row boundary, and a markup that means to must declare
`row`.**

Costs, accepted and declared. An inline mark can no longer span a row boundary — a markup that
means to must declare `row`, and it then matches anywhere instead of at offset 0 alone. A typed
row's opener and closing literal are structural bytes: they are not `textContent`, no caret may
enter them, and `anchorAt` answers a row's body start for an offset inside its opener. Copying
part of a typed row re-annotates it, so half a heading copies as `'# half'`. A stray closing
literal typed above an existing one still fuses the rows between them into one raw body; the
body-gap-only rule bounds the damage to one row and the end-at-a-separator rule keeps every other
row starting at a line start.
