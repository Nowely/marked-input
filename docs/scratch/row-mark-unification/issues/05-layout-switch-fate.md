# The layout switch's fate

Type: grilling
Status: open
Blocked by: 01, 02, 03

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
