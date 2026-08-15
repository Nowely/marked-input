# Keyboard selection — which chord

Status: needs-info

Reported as "keyboard selection doesn't work", with no chord attached. The reporter no longer
remembers which one, so this records the map and the ranked candidates instead.

Core handles exactly one selection chord: Ctrl/Cmd+A (`keyboard/input.ts:41`). Shift+Arrow,
Shift+Home/End, Ctrl/Alt+Shift+Arrow and Shift+Click are all left to Chromium. Coverage is zero
— the only `Shift` in any spec in this repo is Shift+Enter.

Top candidate, mechanism proven from code and effect unmeasured: the DOM→model round trip
discards selection direction. `SelectionDriver.ts:120-121` stores `anchor` from `range.start`
and `head` from `range.end`, and the write-back builds a document-ordered forward range
(`dom/caret.ts:91`). Backward extension (Shift+Left/Up/Home) should therefore shrink by one
unit per press once the write-back has moved the focus end. Two facts push back, which is why
this needs measuring rather than fixing: a forward cross-mark drag sweep runs the same ranged
path and is measured PASS (`docs/records/one-host-migration.md:74`), and the re-place is gated
by an anchor-identity dedupe (`tree/selection.ts:77`), so a selection that resolves to the same
anchors writes nothing.

Second mechanism worth capturing in the same sweep: `removeAllRanges() + addRange()` also
destroys Chromium's remembered goal column, so vertical extension may drift toward the current
column. That one also affects plain Arrow Up/Down.

The cheap first step is issue 08's missing measurement — `inconsistencies.md:54` already admits
the Shift+Arrow row was never measured after #274. Measure Shift+Left/Right/Up/Down,
Shift+Home/End, Ctrl/Alt+Shift+Arrow and Shift+Click, in both inline and block layout, before
anything is designed.

Related: 07 is the same write path, already measured. 26 swallows Shift+Arrow outright while a
suggestion list is open — rule that out first if the report came from a page with an overlay.
