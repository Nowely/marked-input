# No browser test asserts the caret in controlled mode

Status: ready-for-agent

Every caret assertion in the browser suites runs under `defaultValue`. Not one runs against a
controlled editor whose parent echoes the value back.

That is exactly where the caret rules differ: controlled mode DISCARDS the caret a verb computed,
because the tree has not moved yet and the echo's repair owns it instead. So the whole branch that
nine known defects live in is unexercised — see `28-caret-defects-nobody-wrote-down.md`.

## Scope

Add controlled-mode caret coverage at the shared browser harness, which already has an echo mount
helper. No production change. The point is to make the existing behaviour visible, including where
it is wrong: a test that pins a defect is fine as long as it says so in a comment and links the
item.

Cover at least: typing in the middle of a text token; Enter creating a row; a row merge; a mark
insert through the API; and a parent that TRANSFORMS the value rather than echoing it verbatim —
that last one is where the caret is reported to jump to the document end on every keystroke, and it
is the cheapest of these to write.

## Verification

The new cases run under both projects from one file. `pnpm test` green, and any case that pins
current-but-wrong behaviour carries a comment saying which item it belongs to.
