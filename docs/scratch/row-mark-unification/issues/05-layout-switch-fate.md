# The layout switch's fate

Type: grilling
Status: open
Blocked by: 01, 02

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

## Round 1 (2026-08-22) — narrower, and the blocker is chrome

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

**The one concrete blocker a lens found is chrome, not structure.**
`Block.tsx:56-68` renders DragHandle/DropIndicator/BlockMenu unconditionally,
gated only by `readOnly`, so inline rendered through rows would grow a grip per
row. If 02's chrome layer lands, that blocker disappears and this ticket
becomes answerable. If chrome had stayed per-row, it would have stayed shut.
