# The layout switch's fate

Type: grilling
Status: resolved — superseded: the enum dies as a mode AND as a prop (2026-08-25, ADR-0011)
Blocked by: —  (01 resolved 2026-08-24; 02's paused half is about prop names, not the layout mode)

## Question

After unification, ~6 runtime `isBlock()` sites remain: the parse fork
(`valueBoundary.ts:71`), the props-watch tuple (`TokenModel.ts:356`), the grip
gutter (`SlotsFeature.ts:42`), the controller gate (`BlockController.ts:34`),
and the two input arms (`input.ts:57,114`). Tickets 01–03 decide how many
survive.

Does `layout: 'inline' | 'block'` survive as a mode, or does block collapse
into configuration (e.g. separator presence)? Reading C is evaluated here,
not assumed. A layout flip currently means reparse/remount (ADR-0009's
declared rule) — whatever the answer, that rule is restated or replaced
explicitly.

## Round 1 (2026-08-22) — narrower, and the blocker is the row controls

Still genuinely open, but the guard census is now exact and one candidate
answer is dead.

**Exact, non-definition `isBlock` forks — eleven:** `valueBoundary:71` (+ its
dep at `:37`), `TokenModel:356` and `:568`, `SlotsFeature:42`, `input.ts:57`
and `:114`, `blockEdit:70` and `:86`, `BlockController:34`, `Container.tsx:34`
and `Container.vue:49`. The [03](03-one-input-pipeline.md) decision removes two
of the keyboard forks; whatever [02](02-one-render-path.md) lands removes the
two adapter forks. What is left is parse policy, the `draggable` gate and the
block feature itself — i.e. layout stops being a RENDER fork and becomes a
PARSE-POLICY plus feature-enable fork.

**Dead: "inline is just one row."** It cannot be spelled with today's props,
all verified in source — `separator` is block-only, defaults to `'\n\n'` and is
`readonly: true`; `Parser.parseRows` throws on `''`. The naive precondition
measured 195/1001 core tests red.

**The one concrete blocker a lens found is the row controls, not structure.**
`Block.tsx:56-68` renders DragHandle/DropIndicator/BlockMenu unconditionally,
gated only by `readOnly`, so inline rendered through rows would grow a grip per
row. If 02's controls layer lands, that blocker disappears and this ticket
becomes answerable. If they had stayed per-row, it would have stayed shut.

## Answer (2026-08-24) — the enum survives as a PROP, dies as a MODE

Taken by the maintainer after a four-agent census, two designers and two
adversarial passes over twelve production sites. Only the PARSE POLICY is
irreducible; the biggest sort — roughly fifteen row behaviours across `bind.ts`,
`DomModel`, `renderSubscription`, `anchors`, `siblings`, `tree`, `adopt` and
`resolveSlot` — already read `kind === 'row'` and no prop at all.

**Option A, implemented.** `TokenModel.rowSeparator` —
`computed(() => layout.isBlock() ? separator() : undefined)` — is the SOLE reader
of the enum. The parse fork, the four feature gates and the grip gutter all ask
it. Measured afterwards:

    grep -rn 'layout.isBlock' packages --include='*.ts' --include='*.tsx' --include='*.vue' \
      | grep -v '\.spec\.' | grep -v node_modules | grep -v '/dist/'
    packages/core/src/features/tokens/seam/TokenModel.ts:306

One hit, and it is the computed itself. `PropsModel.ts:33` is the DEFINITION
(`isBlock: () => self() === 'block'`), not a reader.

Option B — deleting `layout` outright and dropping `separator`'s default — was
NOT taken; it is a separate published-API decision.

### Round 1's "reparse/remount" was half wrong, and it was ours

ADR-0009 line 39 says a layout flip is a **reparse**. It never said remount;
"reparse/remount" is this ticket's own wording. Re-measured here on one live
store: `update({layout: 'block'})` on an attached container pulses `committed`
ONCE and nothing else — the same `Store`, the same container, the same tree
object, adoption pairing what it can. No remount is involved at any level core
can see.

### The declared behaviour change

In a document with NO rows, changing `separator` no longer pulses the commit
clock. Measured on `'one\n\n@[m]\n\nthree'`, inline, `'\n\n'` → `'\n'`:

| | tree before | tree after | `committed` pulses |
| --- | --- | --- | --- |
| before | `["text#1"]` | `["text#1"]` | 1 |
| after | `["text#1"]` | `["text#1"]` | 0 |

The tree and the projection are identical on both sides; only the commit is
gone. `committed` is published through `useMarkput`, so it is observable. Strict
improvement — an inline editor stops re-deriving every token because a prop it
ignores changed.

**The pulse is not only a counter, and the second consumer is UI-visible.**
`tokens.committed` has exactly two production readers — `grep -rn '\.committed'
packages | grep -v '\.spec\.'` gives `OverlayController.ts:111` and
`BlockController.ts:143`. The overlay one re-probes the `'change'` trigger on
every pulse, so before this change a rowless `separator` change RE-OPENED an
overlay the user had just dismissed. Measured on `'hello @wo'`, inline, caret at
9, `options: [{overlay: {trigger: '@'}}]`, `overlay.close()` and then
`update({separator: '\n'})`:

| | match after `close()` | match after the separator change |
| --- | --- | --- |
| before (`8ef1a30a`, and step 2) | `undefined` | `"wo"` — reopened |
| after | `undefined` | `undefined` — stays closed |

That is the better answer — a dismissed overlay should not come back because an
unrelated prop moved — but it is a visible change, not a bookkeeping one, and it
is pinned in `OverlayController.spec.ts`. `BlockController.ts:143`'s reader only
bumps `state.geometry` for block controls, which an inline document never
renders, so it is genuinely unaffected.

Nothing is lost the other way. `rowSeparator` is a computed with DYNAMIC
dependencies, so a rowless document is not subscribed to `separator` — the
question is whether it re-subscribes when rows appear. It does; identical before
and after the change (re-measured on `8ef1a30a`, on step 2 and at the tip — all
three print the same three lines):

    start (inline)            text#1                                    | 0 pulses
    update({layout:'block'})  row#2,row#4,row#6                         | 1 pulse
    update({separator:'\n'})  row#2,row#4,row#6,row#8,row#10            | 2 pulses

Two of the three pins are in `TokenModel.clocks.spec.ts`; the overlay one sits
where its own consumer lives. All three were checked against a MUTATED mechanism
rather than re-read: putting `props.separator()` back into the watch tuple
reddens the rowless-clock pin AND the overlay pin (the latter printing the
resurrected `{value: "wo"}` match in its diff), and wrapping `rowSeparator`'s
read in `untracked` reddens the re-subscribe pin alone.

### Where the enforcement is recorded, and why not in the ADR

ADR-0009's sentence "the separator does not apply in inline layout" stays true
and becomes ENFORCED rather than declared — after this, the separator is simply
not read when there are no rows. That is a change of MECHANISM, not of the
ratified decision, and the ADR's subject is the separator's structural status
rather than which module reads which prop. So the record lands here and in
`packages/website/src/content/docs/development/architecture.md`, and the
ratified paragraph is left alone.

### Deliberately left open

- ~~`batch` runs `flush()` in its `finally` before restoring `mutableScope`, so
  a watcher that throws during flush leaves every readonly prop signal writable
  process-wide.~~ **FIXED** at `9ab844ca`, pinned by
  `shared/signals/mutableLeak.spec.ts`; `batch` restores `mutableScope` before
  the flush now. This line said "untouched" and had gone stale.
- ~~A runtime layout/separator change DESTROYS the caret rather than shifting
  it.~~ **REFUTED — measured 2026-08-24, see below.** The claim was never
  measured; it was inherited through two reports and this file repeated it.
- ~~Two prop values crash the editor outright — `layout="block"` with
  `separator: ''`, and a typo'd `markup`. Both throw out of `props.set`, which is
  where the leak above was reachable from.~~ **FIXED**, both, answered the same
  way; see below.

### The caret survives a parse-policy change, and the mechanism is `adopt`'s

Measured at `4697043e` on three levels. Nothing was changed to make this true —
it is what the code already does.

**Tree space.** A `Store` on an attached container, `'first row here\n\nsecond
row here\n\nthird row here'`, caret collapsed at offset 19 (mid-word, second
row), then `props.update(…)`:

| change | root kinds | root ids | stored offset |
| --- | --- | --- | --- |
| — (block, start) | `row,row,row` | `1,3,5` | 19 |
| `layout: 'inline'` | `text` | `7` | **19** |
| `separator: '\n'` | `row` ×5 | — | **19** |

Node identity is destroyed completely — every root id is new and the stored
`NodeAnchor` object is a different object — and the OFFSET is preserved anyway.

**Why.** `TokenModel`'s props watch takes the reparse arm (the value is
byte-identical), `valueBoundary.reparse` folds through `gapWindow(v, v)` — the
empty window `{start: n, end: n, insertedLength: 0}`, delta 0 — and `adopt`
already expresses the selection as an OFFSET before it mutates anything:
`beforeOffsets` is formed pre-mutation from `offsetOfAnchor(prev, …)`, and
`map` re-resolves it with `anchorAt` against the NEW roots. `selection.repair`
stores that, and `SelectionDriver`'s `bound` watch re-applies it to the DOM once
bind has made handles for the fresh nodes. So the design the reports asked for —
"map the caret through the projected value, whose offsets are stable when node
identity is not" — is the design that shipped.

The pairing question the reports raised does not arise: adoption CANNOT pair a
row candidate with a text token, and does not try. Preservation does not depend
on pairing at all.

**Both adapters, real Chromium, through the public surface.** `mountComponent` +
`rerender`, i.e. the `store.props.set(props)` every render already performs
(`MarkedInput.tsx:104`, `MarkedInput.vue:35`). Caret placed by a REAL
`userEvent.click`, then the prop changed, then a REAL `beforeinput/insertText`
of `'X'`, and the emitted value read off `onChange`:

| scenario | X lands at the pre-change position |
| --- | --- |
| block → inline | yes |
| block → inline, `draggable: true` | yes |
| block → inline, trailing empty row | yes |
| block → inline, document with marks | yes |
| `separator` `'\n\n'` → `'\n'` (3 rows → 5) | yes |
| block → inline with no task between click and change | yes |

React and Vue printed byte-identical reports. A separate collapsed/ranged sweep
(11 scenarios: both directions, row start, row end, document end, a document
with marks, CONTROLLED, and the `readOnly`/`className` controls) agreed: every
caret and every ranged selection came back at the same position in the
projection, `document.activeElement` stayed the container throughout, and the
selected text of a range was unchanged (`"ond "` before and after). The control
props moved nothing, so the layout arm has no special status here.

**What "shifting" would even mean is worth stating**, because the raw DOM number
does change: block layout does not render the separators, so a caret at
`raw=29` in block is `raw=31` in inline. Same position in the projection, and
the reports appear to have read that as loss.

## Comments

**2026-08-25, P2 (ADR-0011).** The Answer above is superseded on its central point, and this
ticket is where that has to be said, because this is where the question was reserved.

- **"Option B — deleting `layout` outright — was NOT taken; it is a separate published-API
  decision."** It was taken, as exactly that: a decision from the outside, recorded in
  [ADR-0011](../../../adr/0011-the-separator-is-the-whole-row-model.md). The reason it could not
  be deferred again is this ticket's own argument turned around — the deferral rested on _a
  configured separator is the mode_, and P2's default of `'\n'` makes every unconfigured editor a
  row editor, so nothing is left to discriminate.
- **`TokenModel.rowSeparator`** is gone by name and by shape: `rowConfig: Computed<RowConfig |
  undefined>` (P1, `3c4b54ad`) is the sole derivation, and `separator === null` is the single
  spelling of "no rows". The grep in the Answer has no target left; the census at HEAD returns
  zero production hits for `props.layout`, `isBlock` and `rowSeparator` alike.
- **The declared behaviour change is withdrawn with its premise.** "In a document with NO rows,
  changing `separator` no longer pulses the commit clock" was a property of a computed that read
  `separator` only when `layout` said block. `rowConfig` reads `separator` FIRST and always —
  `null` is how it answers — so a rowless document is subscribed to it, and moving the separator
  reparses. The overlay-dismissal outcome the table above records still holds, by a different
  mechanism: the `separator` signal drops an identical write before it propagates, so a per-render
  prop sync never wakes anything. Its pin lives on in `OverlayController.spec.ts` with the
  mechanism corrected.
- **The two crashing prop pairs stay fixed**, and one of them is now unspellable: `layout="block"`
  with `separator: ''` has no `layout` to spell. `''` alone is still reported and treated as absent.
