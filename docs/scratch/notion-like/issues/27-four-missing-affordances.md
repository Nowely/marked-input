# Four affordances behind one verdict: the gutter `+`, "Turn into", `/` menu sections and icons, a selection toolbar

Type: task
Status: needs-triage
Blocked by: — (the record's own ordering named 12, 13 and 16; all three are now answered)

> ONE ticket, because the record itself groups these four under one verdict and one reason to wait
> (`insights.md:392-395`, `outcome.md:594-597`). Each keeps its own measurement below, so splitting
> it later costs nothing.

## Problem

**1. The gutter `+` was never built, and nothing said so.** `map.md:697-704`:

> `showcase.md:56` asks for "its **drag grip** and a **+** on the left gutter". MEASURED
> 2026-08-26: `packages/react/markput/src/components/BlockControls.tsx` paints exactly ONE
> `<button>` … There is no add affordance in either adapter, no test names one, and no earlier
> decision retires it. So it is undeclared rather than declined … The row verb it was also blocked
> on now exists — `RowNode.addSibling()`, P11.6.

Re-verified at `52ef65ae`, after the rename: `RowControls.tsx:116` and `RowControls.vue:119` each
paint exactly one `<button>`.

**2. `ROW_MENU_ITEMS` is three entries and there is no "Turn into".** Verified at
`packages/core/src/features/rows/menu.ts:12-16`: Add below, Duplicate, Delete. The driving session
named the absence (`outcome.md:479`, `:274`), and no set-wide verb beyond indent and drag exists.

**3. The `/` menu is a flat, unsectioned list.** `map.md:775-787`: P11 shipped without bringing
`MenuSpec.section` or an icon back, *"because the shipped `BlockMenu` paints neither and the exit
criterion — 'the showcase's menu component contains no filtering and no insert logic' — is met by
there being no such component. Twenty-five entries in one unsectioned list is the cost, and it is
the first thing a painter would fix."* The shape is settled and the reason is recorded:
*"`icon?: Slot` is still the version that keeps the criterion"* — `MenuSpec.icon`'s original
`icon?: unknown` was unrenderable and was rightly dropped inside P7. (`outcome.md:276` counts 23
entries, `map.md` counts 25, `insights.md:70` counts 24 menu entries; nobody re-counted for this
ticket.)

**4. There is no selection toolbar.** `outcome.md:508-509`: bold, italic, link and colour *"are
unreachable except by typing markup"*.

## Why it matters here

They are what a person expects to find and does not. They are also the four items the doctrine's
own first test refuses today.

## Why not yet (`insights.md:392-395`)

> All real gaps. The doctrine's own first test asks what a proposal deletes, and none of these
> delete anything; every one adds published surface over gestures items 1–3 say are not finished.
> `ROW_MENU_ITEMS` being three entries is a symptom of that, not a reason to add a fourth.

Re-open when [12](12-upward-mouse-selection.md), [13](13-collapsed-body-lost-on-a-row-cover.md) and
[16](16-trailing-paragraph.md) have landed — the gestures underneath these four.
