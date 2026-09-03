# Four affordances behind one verdict: the gutter `+`, "Turn into", `/` menu sections and icons, a selection toolbar

Type: task
Status: needs-triage — the gutter `+` is built; the other three are judged below and not taken
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

## Judged 2026-08-27 (T-D)

The record's own ordering was waiting on 12, 13 and 16, and all three have landed. Each of the four
is judged here on whether it earns the published surface it costs. **One was built. Three were not,
and the reasons are below so nobody re-opens them blind.**

**1. The gutter `+` — BUILT (`c2fca4ef`).** It is the affordance a person reaches for first and it
was undeclared rather than declined. Both adapters paint a second button in the band, left of the
grip, with the accessible name `Add a row below`; it runs the ROW MENU'S OWN first entry through the
same node verb, on the row the pointer is on, so the two cannot come to mean different things. The
menu's lookup and the button's collapsed into one method. It is not behind `draggable` — adding a
row is a row feature and only the grip's drag is drag UI — and it is behind `readOnly` with the rest
of the band.

Its honest cost is a published LAYOUT change and it is stated as one: the gutter core reserves goes
from one control wide to two, so the container's `padding-left` moves 24px → 48px while the rows
drag, and `.SidePanel` hangs 48px left of its row. Those two numbers are ONE fact and must agree — a
band wider than the reservation hangs outside the container over whatever the page has to its left.
Four core cases and four browser cases carried the old number; two of them counted grip BUTTONS to
mean "one band per editor" and count BANDS now, which is the claim they were making. Pinned in
`Drag.spec`'s `the gutter add button`, in both adapters, and mutated: the verb made a no-op reddens
two cases in each project, and the band narrowed back to 24px reddens the geometry case.

**2. "Turn into" in the row menu — NOT TAKEN. The verb is not missing; the SURFACE is duplicated.**
Measured: `OverlayController.#turnRowInto` already retypes the caret's row from any menu entry, and
a row that has text KEEPS its body — so `/` on an existing row is turn-into today, and it is
documented as such (`guides/rows.md`, "Add, duplicate and delete a row, and convert it to another
kind"). A "Turn into" entry in the GRIP's menu is therefore a second list of the same entries,
opened over a different row, with a second highlight and a nesting the list model does not have.
That is doctrine A.4's shape — two implementations of one rule — bought for discoverability. Re-open
it as a DISCOVERABILITY item if one turns up, not as a verb.

**3. `/` menu sections and icons — NOT TAKEN HERE; it wants a maintainer's yes on two published
fields.** The shape is settled and recorded (`MenuSpec.section?: string`, `icon?: Slot`), and the
cost is not the painting: `icon?: Slot` puts a COMPONENT inside what is otherwise a plain data
record, which is the reason `icon?: unknown` was dropped inside P7 in the first place, and `section`
is an ordering vocabulary every consumer then has to agree with. Both are `MenuSpec` additions, and
public API is decided from the outside on usage (doctrine A.9). Twenty-five entries in one
unsectioned list is a real cost and it stays the first thing a painter would fix — but a painter is
who should ask for it.

**4. A selection toolbar — NOT TAKEN, and what it is blocked on is a published CONTRACT, not paint.**
Bold, italic, link and colour are unreachable except by typing markup because the imperative write
path was withdrawn on purpose: `MarkputHandle` is `container` and `focus()`, and `insertMark`,
`replaceText`, `replaceRange`, `setValue` and `tx` came out in `6be66f5b` — *"the editor is driven
by its props, so a write belongs in the `value` a parent already owns, not in a second imperative
path that has to agree with it."* A toolbar button is exactly that second path. Building one means
core owning and PUBLISHING a "wrap this span in this markup" verb, which is the surface that commit
removed, in a narrower shape.

The pieces exist internally — `annotate(markup, {value, meta})` plus `edit.replace(anchor, head, …)`
is what `OverlayController.choose` already does over the trigger's own range — so this is not a
missing primitive. It is a decision about what the published contract is, and it also needs an
answer for every selection that is not plain text: crossing two rows, covering a row no caret may
enter, spanning a carved cell's delimiter. Each of those is a refusal, and a toolbar has to say
which button is greyed out and why — which is [29](29-refusal-is-silent.md)'s channel asked to
carry a REASON, the one thing it deliberately does not.

## Corrected 2026-08-27, in review — the layout cost was stated for one configuration of three

The commit and `guides/rows.md` declared the 24→48px reservation *"while the rows drag"*. That is
one of three configurations, and the other two were undeclared. Measured in both adapters, with the
container at `marginLeft: 120px` so it is not at the page edge:

| configuration | before | after |
| --- | --- | --- |
| `draggable: true`, no consumer style | reservation 24, band 24, overhang **0** | reservation 48, band 48, overhang **0** |
| `draggable: false` | reservation 0, band 24, overhang **24** | reservation 0, band 48, overhang **48** |
| `draggable: true` + consumer `style={{paddingLeft: '24px'}}` | overhang **0** | `+` at x=96, container at x=120 → **24px outside** |

The band's width and the container's reservation are set from two different conditions:
`.SidePanel` is 48px whenever the controls layer paints, `ROW_GUTTER_WIDTH` is applied only when
`rowsDraggable && !readOnly`, and it is spread BEFORE the consumer's own style so a consumer
`paddingLeft` wins. Nothing became newly outside — with `draggable: false` the band was already
100% outside, which `Drag.spec`'s `hang the grip band LEFT of its row` pins as INTENDED — but the
page room it needs doubled, and the `+` is the outermost 24px of it.

**Done here:** the `draggable: false` overhang is now asserted (48px, band width 48, reservation
0px), so a later widening cannot double it unnoticed; mutating `.SidePanel` back to 24px reddens it
in both projects. The four stale `24px` claims in files this pass edited are corrected.

**NOT done, and it is a maintainer's call rather than a fixer's.** The width is TWO copies of one
fact and the rows README now instructs hand-agreement rather than deriving it. The single-owner
shape is to delete `ROW_GUTTER_WIDTH` and the `mergedStyle` ternary and put the reservation in
`styles.module.css` beside `.SidePanel`, toggled through the class the container already builds —
one file holds the number and the two cannot disagree. The cost is real: `containerProps().style` is
published surface, `Store.spec.ts` asserts `paddingLeft` on it in four places, and a consumer inline
`style={{paddingLeft}}` currently overrides core and would stop doing so.
