# The rot guards stop at fenced code, and `CONTEXT.md`'s own vocabulary is unenforced

Type: task
Status: resolved — `packages/website/samples/vocabulary.spec.ts`; the avoid-list half was measured and REFUSED
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

## Answered, 2026-08-27

Both halves, in one file — `packages/website/samples/vocabulary.spec.ts`, in the `docs` vitest
project, which is the one with a filesystem and no browser to boot. It copies
`addressSpace.spec.ts`'s two rules: comments are stripped before scanning, and every scan carries a
non-vacuity guard, because `toEqual([])` is satisfied by looking at nothing.

**The prose backticks are checked.** The filter the ticket asked for — the one that tells
`` `store.rows` `` from English in backticks — is: a span qualifies when it is DOTTED or camelCase
with an internal capital, optionally ending in `()`. Measured over the guides as they stand, 259
spans qualify, and each segment of each one has to appear as an identifier in
`packages/{core,react/markput,vue/markput}/src` with comments stripped. Membership, not resolution:
that is the floor that catches the rot mode which actually happens — a name is deleted and the
prose keeps citing it — without pretending to type-check a sentence.

Eight spans in the guides today are correctly there and are not ours to declare, and they are named
with their reasons rather than skipped: `React` and `forwardRef` are React's, `defaultPrevented`,
`isContentEditable` and `insertCompositionText` are the DOM's, and `insertMark`, `replaceText` and
`replaceRange` appear inside the sentence that says they were WITHDRAWN. A budget pins the list at
eight, for `SKETCH_BUDGET`'s reason.

Two refinements came out of trying to break it rather than out of design, and both are pinned:

- **the corpus is PRODUCTION only.** A spec's `it('fails closed when the mark is gone')` puts
  English into the corpus as a declared name, and measured, `` `store.gone` `` PASSED the check
  until specs, benches and `__testing__` came out of it — 4565 names against 1963 now. The
  retired-vocabulary scan keeps them, because a rename has to reach a test too.
- **a file name is not an identifier.** `` `package.json` `` and `` `oxfmt.config.ts` `` are dotted
  and nothing declares a `json` or a `ts`. The guides happen to carry none today and `AGENTS.md`
  carries four, so leaving it would have been a trap for the next page that names a config file.

The retired scan also reads `packages/storybook/src`, which is the largest consumer this repository
has and where a rename lands next; measured clean on all ten identifiers.

**The avoid-list half was measured and NOT taken, and that is the ticket's own false-positive risk
turning out to be fatal.** Extracting every single-word `_Avoid_` entry from `CONTEXT.md` answers
**74 words**, among them `dom`, `state`, `focus`, `selection`, `props`, `ref`, `index`, `position`,
`text`, `element`, `line`, `item`, `body` and `field` — every one a legitimate name on the published
surface, several of them banned by one glossary entry for a concept a different entry names them
for. `RowProps.index` alone would redden it, and ticket 36 kept that name on purpose. An avoided
word is only wrong when it names the thing the glossary renamed, which is a judgement about a
sentence and not a grep.

**What IS checkable is the deletions, and those are checked.** `CONTEXT.md`'s "Flagged ambiguities"
resolves two words by DELETION and enumerates the identifiers each used to be: `Lexeme`, and
`BlockStore` / `blockIndex` / `BlockController` / `BlockMenu` / `BLOCK_MENU_ITEMS` / `isBlock` /
`slots.block` / `slotProps.block` / `store.block`. Each is banned from package source, and each
test also asserts that the glossary still contains the sentence that bans it — so un-banning a word
means editing `CONTEXT.md` and watching this go red, rather than editing `CONTEXT.md` alone. A BARE
`block` is deliberately not banned, for the reason the glossary gives: the word is CSS's,
markdown's and the Notion showcase's before it is ours, which is why this check needs no allowlist
for any of the three.

Seen to redden, not merely seen to pass: a `const BlockStore = 1` added to `RowController.ts` turned
the `BlockStore` case red; `` `store.bus` `` and `` `effectScopeGone` `` added to `guides/rows.md`
turned that page red with `store.bus — no \`bus\` in any package source`; a `const BlockMenu = 1` in
the showcase's own `options.tsx` turned it red through the consumer scan; `` `store.gone` `` turned
it red once the corpus lost the specs and passed before; and rewriting one glossary line to
`` `BlockMenu` is fine again `` turned the `BlockMenu` case red on the pin that holds the two
together.

## Reopened and closed again, 2026-08-27 — the guard stopped one shape short of its own headline

Three reviewers found the same hole independently, and it was the ticket's own headline: the prose
half could not see an undotted PascalCase span, and the retired scan never read a doc page at all.
Reproduced — appending ``The `BlockMenu` and `RowControllerGone` are gone.`` to `guides/rows.md`
left the file at **36 passed**. `BlockMenu` is entry 5 of this file's own deletion list;
`RowControllerGone` exists nowhere.

Both halves are closed, and the bill was measured before either was taken.

**The retired scan now reads the doc pages.** Raw text, fences included — a sample naming a deleted
export is exactly this rot, and `samples.spec.ts` only type-checks the fences it can compile.
Measured first: all ten patterns answer **nothing** across the 23 hand-written pages, so it costs no
allowlist, no exception and no budget.

**The prose arm now accepts PascalCase with an internal capital.** That is the same rule the
camelCase arm already used, and on this arm it is what keeps English out. Measured over the pages:

| arm | spans added | `FOREIGN` entries needed |
| --- | --- | --- |
| any leading capital | +151 | 14 — adds `Alice`, `World`, `User`, `Esc`, `Shift`, `Down`, `Right` |
| an INTERNAL capital | +62 | 9 |

The nine are five names a page's own sample declares (`CustomContainer`, `MentionMark`,
`MentionOverlay`, `MentionProps`, `TableLine`), one recording a deletion (`DragAction`, in the
sentence of `architecture.md` that says it is gone), and three shouted in prose (`BBB`, `BODY`,
`COMMANDS`). The budget moves 8 → 17 and the span floor 150 → 300, both deliberately. What it buys
is the published surface: every exported type, class and component here is PascalCase, so
`RowNode`, `MenuSpec`, `DomModel`, `MarkputHandle`, `MarkupRegistry`, `RowController` and
`OverlayListModel` were exactly the names the check could not see.

Seen to redden: the same appended sentence now fails **two** cases —
`docs/guides/rows.md:243 The \`BlockMenu\` and \`RowControllerGone\` are gone.` from the deletion
scan, and `BlockMenu — no \`BlockMenu\` in any package source` plus the same for
`RowControllerGone` from the prose scan.

The claim this ticket made — *"the glossary's DELETIONS are enforced"* — is true of prose as well as
of source now. It was not before.
