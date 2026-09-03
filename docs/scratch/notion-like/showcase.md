# The showcase page — what "a full copy" means

Working brief, written 2026-08-25 from the reference screenshot the maintainer
supplied. Not a decision record. The final story is judged against this list.

The reference is a Notion page in DARK theme. Page background near-black, text
near-white, muted grey for labels, coloured chips. The editor is one column,
centred, roughly 700px of content width, with a wide cover band at the top.

## Blocks, top to bottom

1. **Breadcrumb + page chrome** — "Product / Launches / Apollo", "Edited 14m ago",
   "Share", "…". Out of scope as editor behaviour, in scope as page furniture.
2. **Cover band** — a flat colour strip, then a large emoji (🚀) overlapping it.
3. **Title** — "Apollo — Q2 launch plan", oversized, editable.
4. **Properties panel** — label/value grid: Status (chip "In progress"), Owner
   (avatar + name), Team (avatar stack + "+4 others"), Timeline (date range),
   Tags (three chips, one plain), Spec (link), Confidence ("82%"), and a muted
   "+ Add a property" affordance.
5. **Divider**, then an intro paragraph containing an inline **mention chip**
   (@Platform) and a **highlighted span** ("launch gating on the auth migration").
6. **Table of contents block** — a boxed list of the page's own headings, the
   nested one indented.
7. **Heading "Launch tasks"** with the caption line "Inline database · 24 items".
8. **Inline database** — the densest element:
   - a view tab bar: Table / Board / Timeline / Calendar, plus Filter, Sort, New;
   - a header row: Task, Status, Owner, Due, Effort;
   - five rows: title text, a **status chip** (Blocked red, In progress amber,
     Done green, Planned grey), an **avatar** initials circle, a **due date**
     (red when overdue, muted when past-and-done), an **effort bar** (a
     partially-filled progress track);
   - a footer: "+ New" on the left, "Count 24 · 9 done" on the right.
9. **Heading "Sprint board"** then the **Board view** — three columns (To do · 8,
   In progress · 3, Shipped · 13), each holding cards; a card is a title plus a
   small coloured tag. Cards drag between columns.
10. **Heading "Metrics & risks"** then a **grid of metric cards** — four cards,
    each a muted label above a large number (Beta users 4,120; p95 latency 184ms;
    Crash-free 99.4%; Open bugs 37) — beside a **callout** with a warning icon on
    a red-tinted background.
11. **Bulleted list with one nested level** — "Vendor SLA unsigned", "EU region
    capacity unconfirmed" with a child "Awaiting quota approval", "Support
    headcount at 60%". The child bullet is a hollow circle, the parent a dot.
12. **Heading "Decision log"** then **toggle blocks** — the first is OPEN and
    shows its child paragraph; two below are CLOSED, showing only the arrow and
    the title line.
13. **Code block** — language label "bash", monospace, two lines, its own
    background.
14. **Quote** — a left rule and larger text.
15. **Bookmark card** — title, description, url, and a thumbnail box on the right.
16. **Comment thread** — avatar, author, "2h ago", the comment text, and a
    "Reply…" affordance.
17. **Empty last row** carrying the placeholder "Type / for commands…".

## Interactions that must work

- Hovering a block shows its **drag grip** and a **+** on the left gutter.
- Dragging a block moves it, with a **drop indicator** line; dragging works for
  nested blocks too (a list child, a toggle child).
- **Selecting several blocks** and acting on them as a set.
- **`/`** opens the block menu: on an empty row it inserts, on a row that already
  has text it converts (turn-into).
- **`@`** opens the people picker and writes a mention.
- Notion keyboard: Enter continues a list or quote; Enter on an empty item exits
  it; Backspace at the start of a block turns it into a paragraph; Tab and
  Shift+Tab change nesting depth.
- **Undo/redo** through the editor's own stack.
- **Toggle** open/close, **checkbox** ticking, chips and avatars are components
  the consumer supplies.

## What is editor capability and what is just a component

Editor capability (must be expressible through core): title, headings, paragraph,
list with nesting, toggle with children, quote, callout, code, divider, table
with EDITABLE cells, mention, link, highlight, placeholder on an empty row, the
gutter affordances, selection, drag, undo, keyboard.

Consumer component (rendered by the showcase, not owned by core): status chips,
avatars, effort bars, metric cards, the board's columns and cards, view tabs,
bookmark card, comment thread, breadcrumb, cover band. These must be reachable
using nothing but the published option/component API — if any of them needs a
core fork, that is a finding.

**A consumer component is not a place to keep document state.** "Not owned by
core" says who RENDERS it, not who remembers it. The board read that as licence
to keep its arrangement in `useState`, and its columns are the row's own raw
body — so a card dragged between columns moved on screen while the value never
changed, undo had nothing to undo, and the column counts went stale. The rule
this line now carries: if a component's state can be read back out of the
document, the document is where it lives, and the component writes through the
published verb (`node.turnInto(option, {text})`) like every other control here.
State that is genuinely nobody else's — a view tab's active tab, a drag in
flight, a column's drop highlight — stays in the component.
