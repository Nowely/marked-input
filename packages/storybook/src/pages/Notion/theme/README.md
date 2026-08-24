# Notion showcase theme

Two files, one rule.

**A token** (`tokens.css`) is a named design decision — a colour, a spacing step, a radius,
a font stack, a size, a line height. Tokens are declared as custom properties on the
`.notionTheme` class, never on `:root`, so the page can be embedded without repainting the
host document. Their names say the ROLE (`--notion-surface-card`, `--notion-text-muted`),
never the theme, so a light set can later be added as a sibling class declaring the same
names with other values.

**A component class** (`notion.module.css`) is what an element wears: layout, box model,
and which tokens it reads. It is a CSS Module, so `styles.chipRed` is what React writes to
`className`. Variants use `composes`, so a modifier class already carries its base.

**The rule: a component class never carries a raw colour.** No hex, no `rgb()`, no colour
keyword beyond `transparent` and `currentColor` outside `tokens.css`. Retheming is then a
one-file edit, and a colour that appears twice is a token that is missing.

Two consequences worth knowing:

- These classes live inside ONE contenteditable host. Furniture that never holds editable
  text (gutter buttons, list bullet, toggle arrow, empty-row placeholder) may use
  `position: absolute`, `user-select: none` and `content:`; text-bearing elements may not.
- Nesting depth is `--notion-indent-step` multiplied by `--notion-block-depth`, which the
  component sets inline — one class, any depth.
