# The rot guards stop at fenced code, and `CONTEXT.md`'s own vocabulary is unenforced

Type: task
Status: ready-for-agent
Blocked by: —

## Problem

`outcome.md`'s item 29:

> **The doc-sample check reads fenced code only.** `effectScope` and `store.bus` also sat in prose
> backticks, where nothing checks them. **`CONTEXT.md`'s own `_Avoid_` and DELETED words are
> unenforced** — nothing stops a rename re-introducing `block` or `lexeme`.

Verified at `52ef65ae`, and one part of the record has moved on:

- The doc-sample harness is **committed** now (`packages/website/samples/` is tracked), where
  `outcome.md:14-18` recorded it as untracked and *"the maintainer's to accept or drop"*.
- `packages/website/samples/extract.ts` is fence-scoped by construction: its whole vocabulary is
  fence directives (`fragment`, `markup`, `value`, `elide`, `uses=`, `sketch=`), and the extractor
  walks fences. Prose backticks are outside it.
- `CONTEXT.md` carries `_Avoid_:` lines at `:13`, `:21`, `:27`, `:31`, `:35`, `:39`, `:43`, `:47`
  and nothing reads them.

## Why it matters here

The effort renamed the entire `block` vocabulary in one pass (`outcome.md:116-119`). The next
rename will be the same shape, and the file that says which words are banned is prose that no check
reads. `insights.md:239-243` states the general form: *"A record is evidence about the day it was
written."*

## Cost

`insights.md:366-371` ranks the harder half ninth and prices the rest as afternoon work:

> **Extend the doc-sample check to prose backticks.** Highest-value of the three rot-guard
> follow-ups, and the one that is not trivial: it needs a filter that tells `` `store.rows` `` from
> English in backticks. The other two — a grep spec over `CONTEXT.md`'s avoid-list, and the link
> check that is already built — are afternoon work and can ride along.

The grep spec over the avoid-list is fully specified and independent; take it first.
