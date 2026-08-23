# Would a Mark ever want per-node state?

Type: grilling
Status: open

## Question

Split out of [01](01-per-node-state.md) when it resolved 2026-08-24. That ticket
asked how to build a per-node state facility; the row-controls layer answered by
removing the need for one. What it did NOT answer is the question round 1 raised
beside it: would MARKS ever want per-node state — hover for an overlay, a
selected/active flag, anything — even though drag and the row menu stay row-only?

Nothing in core gives a mark per-node UI state today, and nothing asks for it. So
this is no longer "how do we build the facility" but "is the feature wanted at
all", which is why it is its own ticket rather than a loose end on a resolved one.

Before designing anything, establish whether there is a real consumer:

- Does the overlay path need to know which mark is hovered, or does it already
  answer from the selection? (`features/overlay/`)
- Do the demo apps or the storybook simulate mark hover/active state in userland
  today? If consumers are already doing it themselves, HOW they do it is the
  evidence for whether core should.
- Is there a published request or an inconsistency doc entry that implies it?

## The finding to carry over

The row case was answered by NOT building a facility. Five editor-level signals
holding an ID each — `hovered`, `dragging`, `drop`, `menu`, `geometry` — beat
every keyed-record design round 1 produced, and the keying question dissolved
with the record. Measured at 200 rows: 201 grip buttons → 1, 201 control roots →
1, 1608 listeners → 7, mount 44 → 18 ms.

The same shape is available to marks, and it should be the default answer unless
something specific to marks refutes it. What might: a mark can be NESTED, so
"the hovered mark" is not a single id the way "the hovered row" is — the pointer
is inside several at once. Establish that before assuming the row shape ports.

Also settled and inherited: `control()`'s `contenteditable` write is not
foldable, and a published node type may not gain a mutable member — "ADOPTION IS
THE ONLY WRITER" (`tree/types.ts`).

## Not this ticket

Marks gaining drag, a grip or a row menu. The map's one-way rule stands: rows
reuse mark machinery, marks do not gain row controls.
