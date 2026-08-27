# The notion-like tracker

Two generations of tickets live here.

- **01–11 are the PROBE's**, filed 2026-08-25 before any of the work started, against the editor as
  it then was. Seven are closed; `outcome.md:189-212` is the account of which decision closed each,
  and that four of the seven closures are ONE decision (the scan-first inversion, ADR-0010).
- **12–40 came out of the BUILD**, filed 2026-08-27 from what the effort declared and did not
  build: `outcome.md`'s "What is declared but not built", `map.md`'s Fog, and `insights.md`'s
  ranked next steps and its "what I would not do yet". Nothing here is new analysis — every problem
  statement quotes a record and cites the file the record cites, re-verified against the code at
  `52ef65ae`.

`Status:` uses the five roles in `docs/agents/triage-labels.md`; the older tickets also use
`resolved — <what answered it>`, which is the wayfinder vocabulary in
`docs/agents/issue-tracker.md`. The narrative records point back here: `outcome.md`'s open list and
`map.md`'s Fog now name the ticket that carries each item, and they keep the measurements.

## The probe's eleven

| # | Ticket | Status |
| --- | --- | --- |
| [01](01-row-start-anchoring.md) | A markup cannot be anchored to the start of a row | resolved (P1) |
| [02](02-variadic-placeholders.md) | No repeatable placeholder, so no table structure | resolved (P9) |
| [03](03-row-node-not-nameable.md) | A consumer cannot name a Row | resolved (P1 + T-C) |
| [04](04-bare-mention.md) | A mention must be delimited; bare `@Name` is impossible | needs-triage — untouched, neither sketch taken |
| [05](05-per-item-rows.md) | One separator per editor, so a list item cannot be a row | resolved (P2) |
| [06](06-repeats-nest-instead-of-continuing.md) | A row-level markup re-matches inside its own slot | resolved (P1) |
| [07](07-closing-literal-newline.md) | A closing literal may not begin with a newline | resolved (P1) |
| [08](08-soft-breaks-are-invisible.md) | A soft break is invisible | needs-triage — representation answered, visibility half rests on a corrected grep |
| [09](09-frontmatter-only-at-offset-zero.md) | A `\n`-delimited fence matches only at offset 0 | resolved (P1) |
| [10](10-controllers-are-not-selectable.md) | `useMarkput(s => s.rows)` does not compile | resolved (T-C) |
| [11](11-overlay-inserts-one-markup.md) | An overlay can insert only its own markup | resolved (P7) |

## What the build left open

| # | Ticket | Status | One line |
| --- | --- | --- | --- |
| [12](12-upward-mouse-selection.md) | An upward mouse drag re-places the caret instead of extending the selection | resolved | The write-back's `addRange` re-seated the drag's base; a real sweep harness now exists |
| [13](13-collapsed-body-lost-on-a-row-cover.md) | A selection covering a collapsed toggle whole deletes its hidden body | resolved | `#hiddenWithin` excludes each hidden subtree; the first answer clipped the span END and was wrong twice |
| [14](14-arrowdown-skips-an-empty-row.md) | ArrowDown skips an empty row | resolved | Not the direction and not the width: the caret's own visit appended a zero-length `Text` |
| [15](15-opener-prefix-is-unchecked.md) | Two kinds may share an opener PREFIX | resolved | `shadowedRowKinds` drops a closed kind whose opener extends another's; the recorded condition was wrong twice |
| [16](16-trailing-paragraph.md) | An atomic row leaves the caret nowhere to go | ready-for-human | The top open DECLARED item; a published-contract decision, not a task |
| [17](17-cross-row-paste-is-spliced-raw.md) | A paste whose span crosses two rows is spliced raw | needs-triage | `splitPlan` refuses deliberately; widening it is a contract change |
| [18](18-carved-piece-verbs-fail-open.md) | `duplicate` and `insertAfter` fail open on a carved piece | resolved | One test in `#insertAfter` answers all three verbs; `addSibling`'s own copy came out |
| [19](19-mid-body-split-loses-the-caret.md) | A mid-body split on a row that keeps a subtree loses the caret | needs-triage | Wants a post-edit caret carried through the transaction |
| [20](20-rowspec-group.md) | `RowSpec.group` | needs-triage | THE ticket for it — three wants, and the threshold is a fourth |
| [21](21-table-gestures.md) | The table's own gestures | needs-triage | Header-only seed, a dead Tab at the last cell, no escape for the delimiter |
| [22](22-continues-carries-no-depth.md) | No option can say "Enter opens a CHILD of this row" | needs-triage | Notion's toggle entry; costed against the code in the Fog |
| [23](23-row-component-contract-is-silent.md) | A row component can drop `ref`/`className`/`style` | resolved | Taken for `ref` alone, from the adapters' post-paint hook — `bind` runs a frame too early to ask |
| [24](24-ship-the-atomic-wrapper.md) | Every consumer writes `Atomic` themselves | resolved | Shipped from `@markput/react` and the showcase's copy came out; the Vue twin waits on 26 |
| [25](25-published-type-corrections.md) | Two published types are wrong at the boundary | needs-triage | `OverlayHandler.ref`, `MarkedInputProps.Span` |
| [26](26-vue-showcase-p12.md) | The showcase's net is single-framework | ready-for-human | P12; every adapter-sensitive fix ships half-measured until it lands |
| [27](27-four-missing-affordances.md) | Gutter `+`, "Turn into", `/` menu sections and icons, selection toolbar | needs-triage | Four affordances the record groups under one verdict: not before 12, 13 and 16 |
| [28](28-gestures-the-first-session-left-standing.md) | Cmd+A, Backspace after an atomic row, one-way nesting, undo granularity | needs-triage | What session one reported and no commit since names |
| [29](29-refusal-is-silent.md) | Refusal is silent, and a click's answer depends on invisible markup | needs-triage | Correct rules, invisible to the user; the editor has one visible refusal |
| [30](30-foreign-value-disables-undo.md) | A value the editor did not write disables undo | needs-triage | Declared in P8; the collaborative-editing boundary |
| [31](31-find-in-page-edits-the-document.md) | Find-in-page inside a closed toggle edits the document | needs-triage | `beforematch` opens the row, and opening it is a retype |
| [32](32-no-per-row-view-state.md) | A cross-parent drop keeps the node and loses the component | needs-triage | No core-owned per-row view store; why 31 exists |
| [33](33-nothing-is-measured-at-document-scale.md) | Row-verb runtime and caret ergonomics are unmeasured | needs-triage | One number exists: ~1.5 ms per `dragover` at 4000 rows |
| [34](34-rot-guards-do-not-cover-prose.md) | The rot guards stop at fenced code | ready-for-agent | Prose backticks unchecked; `CONTEXT.md`'s avoid-list unenforced |
| [35](35-unexercised-clamp-distinction.md) | `rowSelectionText`'s original-vs-clamped distinction | needs-triage | Delete it or pin it; nothing exercises it |
| [36](36-published-surface-leftovers.md) | Grip `aria-label`, `Store`'s rename TODO, `RowProps.index` | resolved | "Row options" announced; `Store` keeps its name; `index` kept with its reason |
| [37](37-softbreak-stays-unbuilt.md) | `softBreak` stays unbuilt | wontfix | Standing deferral; re-open on a case the continuation row cannot carry |
| [38](38-per-kind-drag-axis.md) | A per-kind drag axis | wontfix | Cross-axis hit-testing is a phase, refused on a measurement |
| [39](39-notion-package.md) | A published `@markput/notion` package | needs-triage | A move, not a build — blocked on 03, 10, 12 and 25 |
| [40](40-copy-projects-what-the-write-excludes.md) | A copy projects content the matching write refuses to take | needs-triage | The asymmetry 13 declared, now filed: cut clipboards a collapsed toggle's body and leaves it |

## What was checked and NOT filed

- **A row selection painted as a text selection** (`outcome.md`'s item 18 and the first session's
  complaint) — **done**: `.RowSelected::after` in both adapters (`36404009`).
- **The focus ring around the container** (`outcome.md`'s item 16) — judged and kept: the container
  is the one editing host (ADR-0002), so it is the one focus target, and a consumer can style it
  (`map.md:893-896`).
- **An arrow jumping over a closed subtree** — the rule now, not a defect (`map.md:929-936`).
- **`'- [ ] pack'` typed inside a bullet giving `'- - [ ] pack'`**, and row-scoped Home/End inside a
  carved row — reported as surprises and judged correct (`insights.md:180-186`, `map.md:1136-1142`).
- **A Vue row kind whose component paints no element** — found while closing 23 and FIXED rather
  than filed: `unwrapEl` trusted a component instance's `$el`, which for a null-rendering component
  is a Comment, so consigning it threw `tokenElement.removeAttribute is not a function` out of Vue's
  own patch. Pre-existing, measured at the parent commit, and never exercised because no fixture in
  either project had such a kind (`90de09e1`).
- **The 12px drop band** and three P11.6 review findings (`#enterRow`'s `into === 0` fork,
  `RowNode.writeRows`'s placement, `replaceRowSelection`'s docstring) — measured false or fixed as
  prose; `map.md:683-689` records them so they are not re-filed.
