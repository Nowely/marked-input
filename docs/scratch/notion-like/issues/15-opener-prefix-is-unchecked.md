# Two row kinds may share an opener PREFIX, and one menu click swallows the document

Type: task
Status: resolved — `shadowedRowKinds` drops the closed kind and reports (2026-08-27)
Blocked by: —

## Problem

`usableOptions` rejects a duplicate opener by exact string equality; the standing rule is strictly
wider, and nothing checks it. `insights.md:81-90`:

> **5. Two row kinds must not share an opener PREFIX when either has a raw body — and nothing
> checks it.** `usableOptions` (`TokenModel.ts:1928`) rejects a **duplicate** opener by exact
> string equality. The standing rule is strictly wider, and the failure is total and silent: the
> showcase's `properties` was `'---\n__value__\n---'` against a `'---__slot__'` divider, and one
> **Divider** click from the `/` menu took the page from **36 rows to 3**, every row between the
> two rules swallowed into one panel the caret could not enter. The text survived in the value;
> nothing on the screen did. `spec.md`'s risk 8 records that its own mitigation was falsified
> twice.

Verified at `52ef65ae` — the function has moved since the record was written, so the line cite is
`packages/core/src/features/tokens/seam/TokenModel.ts:1890` (declaration), with the check itself
around `:1927`:

    const opener = rowOpener(markup)
    if (openers.has(opener)) {
    	reportBadProp(`Duplicate row opener "${opener}" in "${markup}". …`)
    	return drop(index)
    }

A `Set` and `has` — equality, no prefix comparison. Note what this also settles for the fix: the
DUPLICATE case already drops the later kind and reports, so "drop or report" has a precedent.

## Why it matters here

`insights.md:337-339`: *"it is the only unbounded document-loss class on the open list, and it is
currently guarded by one browser spec that counts rows after adding a divider — a pin for one
instance of an unwritten rule."*

## Cost

`insights.md:340-342`:

> **Cost:** a prefix comparison beside the equality already there, one `reportBadProp` message, and
> a decision about whether it drops the later kind (what duplicates do today) or reports and keeps
> both. Doctrine A.15 applies exactly: make the invariant checkable, not a paragraph.

The decision is what keeps this out of `ready-for-agent`: dropping a kind a consumer declared is
observable, and "either kind has a raw body" has to be written down as the condition rather than
inferred at the call.

## Answer

`usableOptions` gained a second pass, `shadowedRowKinds`
(`packages/core/src/features/tokens/seam/TokenModel.ts`), and `RowKind.ts` gained the `rowCloser`
that pass reads. A row kind whose BODY closes at a literal, and whose opener extends another
declared kind's opener, contributes no row kind: it is dropped and reported, exactly as a duplicate
opener is.

**The recorded condition was wrong in two places, and both were measured before the code moved.**

- *"when either has a RAW body"* — too narrow. `'---\n__slot__\n---'` beside `'---__slot__'`
  collapses `'a⏎---⏎b⏎c⏎d⏎---⏎e'` from 7 rows to 3 identically to the `__value__` spelling. Raw
  versus inline-parsed decides nothing here; what decides is whether the body has a CLOSING LITERAL,
  because `tryKind` bounds every metadata gap by the row's separator and lets the body gap alone
  cross it.
- *"EITHER kind"* — too wide. When the SHORTER opener is the closed one the parse is already safe:
  `'@@__value__@@'` beside `'@@@__slot__'` leaves `'a⏎@@@ hi⏎b⏎@@ x @@⏎c'` at 5 rows, because
  longest-opener-first tries the longer kind first and it simply does not match. Only the kind whose
  opener EXTENDS another's can steal a row the other opened, so only that kind is dropped.

The hazard is also not the separator special case it looked like. `'---!__value__!---'` beside
`'---__slot__'` takes `'a⏎---! x⏎b⏎c⏎!---⏎e'` from 6 rows to 3 — a user typing `---! x` for a
divider loses three rows below it — so any extension of another kind's opener is enough, not just
one that continues with the separator.

**Which kind loses is not the duplicate's tie-break.** A duplicate's two kinds are interchangeable
and declaration order is the only thing to go on; here the closed kind is dropped whichever was
declared first, because dropping the shorter one leaves the swallow exactly where it was — the
longer opener matches the same bytes with or without a divider declared. Pinned by *"drops the
closed kind even when it is the EARLIER option"*.

**Behaviour change:** a consumer who declares such a pair now loses the closed kind — its rows parse
as paragraphs — and gets one `reportBadProp`. No shipped kind set in the repo declares one; the
showcase's `properties` was respelled `'@properties\n__value__\n@end'` in P11, and the full suite is
green with the check in place.

Pins: `TokenModel.parse.spec.ts` — *"drops a CLOSED row kind whose opener extends another kind and
keeps the rows it would have taken"* (7 rows, not 3), *"drops the closed kind even when it is the
EARLIER option"*, *"keeps a shared opener prefix whose longer kind ends at the row"* (the bullet /
todo pair, which is the mechanism this must not break); `RowKind.spec.ts` — `rowCloser`. All four
were seen red: deleting the drop loop gives
`expected [ 'a', '---\nb\nc\nd\n---', 'e' ] to deeply equal [ 'a', '---', 'b', 'c', 'd', …(2) ]`, and
removing the closed-body condition drops the todo kind and gives `expected [ +0, +0 ] to deeply
equal [ +0, 1 ]`.

Still NOT checked, and not checkable from the options alone: one closed kind on its own still
swallows the rows between two of its own openers (`'---\n__value__\n---'` alone collapses the same
document to 3 rows). That is `spec.md`'s risk 3 — the declared limitation every fenced kind has —
and it is untouched by this rule. What the rule catches is the case where the editor ITSELF offers
the shorter opener, so a documented gesture detonates it; risk 3's claim that risk 8's rule is its
mitigation is therefore too strong.
