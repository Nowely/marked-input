# The caret's unnatural cases, written down

Status: ready-for-human

A UX pass over every operation that moves the caret produced a table of where today's behaviour is
merely accidental rather than chosen. Filed as one item because they share a cause and most share a
fix; each row needs sign-off because each is a behaviour change.

The dominant cause: in controlled mode the caret a verb computed is DISCARDED, because the tree has
not moved yet and the echo's repair would shift it a second time. Nine of the rows below are that
one rule.

| Operation | Today | Should be |
| --- | --- | --- |
| Backspace in an empty Row; delete a row from the menu | caret goes to the start of the FOLLOWING row, because the anchor read is right-affine | the end of the PREVIOUS row — Backspace moves back |
| Forward Delete at a Row start | runs the Backspace branch and merges this row into the previous one | pull the NEXT row up. The drag specs currently pin the wrong behaviour |
| Enter on a mark row; Enter with all selected; row merge; duplicate; add-below — **in controlled mode** | the caret does not move at all | enter the fresh row |
| A controlled parent that transforms the value (upper-casing, trimming, format-as-you-type) | the caret jumps to the document end on EVERY keystroke | stay on the character just typed |
| Removing a mark from a click inside a consumer's own component | moves the caret AND pulls focus into the editor | leave the user where they were |
| Inserting a mark at an explicit anchor through the API | the caret jumps to the insertion site | the caller named a place, not a cursor — do not move it |
| Typing at the end of a block document | the trailing row's empty text child is there, but renders a 0px bare span — arrow-reachable, not clickable (ADR-0004) | an appendable last position |
| Backspace at a Mark edge; Backspace on a non-mergeable row | one press destroys the whole Mark | select it on the first press, delete on the second |
| Clicking to place the caret | the DOM→model→DOM round trip re-writes it; two writes per mousedown at a mark edge | do not re-place what the DOM just reported |
| `focus()` on the public API | ignores the stored selection, and can focus nothing at all | restore the last caret, else the document start |

One of these already has its own item — see `06-api-focus-can-focus-nothing.md` — and is listed
here only so the table is complete. `09-block-gap-caret.md` was the second; it closed
2026-08-22 as not reproducible, and the row above carries its corrected cause.

## Why it is filed rather than fixed

The controlled-mode rows all fall out if the caret becomes an intent the edit STATES and the commit
applies when the node it names exists, instead of two mechanisms racing with a mode-dependent
priority rule between them. A prototype of exactly that was built and measured: the mode branch
does disappear, but it shipped two regressions — a held intent outlives its edit and steals focus
back from wherever the user went (reproduced in real Chromium in both adapters), and it makes the
node insert verbs answer `false` inside the published transaction API.

What survived review: the window map over an edit's OWN window already IS the stated caret, so six
hand-computed carets are duplicates and can be deleted; keep one form recovery cannot serve
("enter root N"); do not build a transformed-caret carry, which is the root of both regressions;
and make an intent a REPAIR rather than a PLACEMENT, applied only when a selection already existed.

## Verification

Whatever lands here needs the coverage gap in `29-no-controlled-mode-caret-tests.md` closed first,
or the suite cannot see nine of these rows at all.
