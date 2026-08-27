# Two row kinds may share an opener PREFIX, and one menu click swallows the document

Type: task
Status: ready-for-human
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
