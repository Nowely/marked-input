# Global defaults with per-option override

Status: ready-for-human

Half of this already exists. The overlay *component* resolves
`option.Overlay ?? global Overlay ?? Suggestions` (`slots/resolveSlot.ts:48`), which is exactly
the pattern the note asks for.

What is missing is the other direction, and it is one knob: `showOverlayOn` is global-only with
a `'change'` default (`state/PropsModel.ts:38`) although the probe reads it per match
(`OverlayController.ts:63`, `:94`). `data` is the mirror case — per-option only, with no global
default.

Decide whether the rule is general (every overlay knob takes a global default and a per-option
override) or whether `showOverlayOn` is the only one worth it. A general rule costs a resolution
helper and a documented precedence order; the narrow one costs a field.

Sequence after `01` — if config and props split, the set of knobs this rule applies to changes.
