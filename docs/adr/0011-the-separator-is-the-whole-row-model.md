# The separator is the whole row model, and `layout` is deleted

`1235da9a` censused twelve production sites that forked on the `layout` enum and found **one**
irreducible reader: the parse policy. The other ~fifteen row behaviours already asked
`kind === 'row'` and no prop at all. The enum shrank to a single computed, and deleting the prop
outright was designed and measured green — then deliberately not taken, because a published prop
is decided from the outside (`494a7222`). The deferral rested on a discriminator: _a configured
separator is the mode_, so `layout` could go once the default made that unambiguous.

P2 flips the default separator to `'\n'`, which makes every editor that configures nothing a row
editor — **the deferral's own discriminator disappears**. So the question has to be answered now
rather than re-deferred against a default that no longer distinguishes anything.

Decided (2026-08-25, maintainer, supersedes `1235da9a`'s deferral): **there is one model. A
document is always rows, and the separator is the only fact that says how it splits.**
`separator?: string | null` replaces `layout`. `null` says the value never splits, which is
exactly today's inline layout; the default is `'\n\n'` here and moves to `'\n'` in the same phase.

**The fork's last reader was one line.** Before this, `props.layout` was read in production in
exactly one place — `TokenModel.rowConfig`'s `if (!this.props.layout.isBlock()) return undefined`
(`TokenModel.ts:322`) — plus Vue's prop plumbing. Every other gate in core already asked
`rowConfig`: the row parse, the grip gutter (`SlotsFeature.containerProps`), `BlockController`'s
hover/menu/drag arms and `blockEdit`'s two keyboard arms. What this record deletes is that one
line, the `layout` signal and its `isBlock` computed, the prop on both adapters, and — found by
the census this decision required — `BlockController.addRow`'s `props.separator()`, the one
remaining site that answered the parse-policy question a second time beside the gate that had
just asked it. The verb now takes the config the gate resolved.

**The count after this lands is one.** `rowConfig` is the single derivation from props, and
`separator === null` is the single spelling of "no rows". Nothing reads the mode, because there is
no mode.

## Costs, declared

**(a) An editor that configures nothing is a row editor.** That is the intent, not a side effect:
markput's default document is a stack of rows with a grip and a row menu each, and a consumer who
wants a plain annotated field says `separator={null}`. It is a breaking change for every consumer
who relied on the old `layout="inline"` default.

Its DOM shape is part of that cost and is stated here rather than left to be discovered. Measured
in Chromium through `mountComponent`, `{value: 'Hello world', Mark}`:

| props             | `host.innerHTML`                                                                                                   | first child's computed `display` |
| ----------------- | ------------------------------------------------------------------------------------------------------------------ | -------------------------------- |
| default           | `<div class="_Block_…"><span>Hello world</span></div><div class="_BlockControls_…" contenteditable="false"></div>` | `block`                          |
| `separator: null` | `<span>Hello world</span>`                                                                                         | `inline`                         |

So an editor that configures nothing gains a block-level box around content that used to be inline
— **not** `display: contents`, so layout does move — plus one permanently mounted controls layer,
which `Container` gates on `rowConfig` alone and therefore mounts even at `draggable: false`. The
grip is also the row-menu trigger, so hovering any row of any unconfigured editor now shows one.

The in-repo consumers that took this flip and were deliberately left unrespelled, as the
demonstration of it: `packages/react/app/src/Editor.tsx`, `packages/vue/app/src/Editor.vue` (both
over a two-line `INITIAL_VALUE`, now two rows), and the website's `Step1Demo`/`Step2Demo`/
`Step3Demo` (single-line, so one row each and the wrapper above).

Coverage is thin on purpose to keep the diff honest, and that is worth knowing: 206 in-repo call
sites spell `separator: null`, so the new default is exercised by `Base/rowDefault.spec`,
a handful of seam pins and the Notion probe. Cost (b)'s "not one snapshot moved" is a measurement
of the respelling, not of the flip.

**(b) `separator: null` costs no wrapper element, and here is how.** The obvious reading of "a
document is always rows" makes a non-splitting document ONE row, which would put a row element
around every inline editor's content — a box that inline layout never had, and a re-baking of
every story snapshot in the repo. It is avoided: `null` maps onto the seam's existing word for
"no rows", `rowConfig === undefined`, which is byte-for-byte the path `layout="inline"` took. No
`RowNode` is minted, so the container's children stay the root tokens and ADR-0004's
container-child-to-root-index invariant is untouched. Measured: with `layout` deleted and every
in-repo inline call site respelled `separator: null`, `git diff -- '*.snap'` is **empty** across
all 85 test files and both adapters — not one snapshot moved.

The price of avoiding the wrapper is that "always rows" is a statement about the published model,
not about the tree: a document can still have zero rows, and that is what `null` asks for.

**(c) `''` is not `null`.** An empty string separates nothing rather than declining to separate,
so it stays a bad prop: reported through `reportBadProp` and then treated as absent, which lands
on the same no-rows shape. Unchanged in behaviour from `c1796e14`; only the message moves, because
it can no longer tell the caller to drop `layout="block"` and now names `separator={null}` as the
way to ask for that shape on purpose. `Parser.parseRows` keeps THROWING on `''`, and not for the
sake of a caller — `Parser` is not exported from `packages/core/index.ts`, and inside the package
the only route to it is `parseRowsValue` fed by `rowConfig`, which cannot pass `''`. The throw
guards `scanRows`, whose loop cannot advance on an empty separator: `value.indexOf('', at)`
answers `at` and `value.startsWith('', at)` answers `true`, so `end === at`, `terminated` is
always true, and the scan never terminates.

**`Parser.parse` and `Parser.parseRows` do not become one entry**, and the deletion does not make
them one: the two differ in return type, not in mode — `parseRows` answers at least one `RowToken`
for any input, `parse` answers the inline tokens themselves. Folding `parse` into `parseRows` is
precisely the wrapper cost (b) refuses, and folding the other way is impossible. What the deletion
does remove is the _reason_ they read as a fork: they are two shapes a caller picks between by
asking for rows or not, and `rowConfig` answers that once for the whole editor.

## What stays open

Under `'\n'` a soft break inside a row has no representation. The follow-up is a `softBreak`
string scanned only inside a row's body, and nothing here forecloses it: `RowConfig` is already a
record rather than a bare separator, and the scanner reads its policy from that record alone.

**Shift+Enter is not unbound in the meantime** — an earlier draft of this record said it was, and
that was wrong. `handleRowEnter` lets the keydown through on `shiftKey`, so the `insertLineBreak`
behind it takes the shared table's `'\n'`; at the default separator that newline IS the boundary,
so Shift+Enter splits the row. It reaches the split by the generic path, so it takes none of
Enter's own rules — no all-selected arm, and a range is replaced rather than kept. At any other
separator it splices a literal newline inside the row, which is what the follow-up will give a
meaning to. Both halves are pinned in `blockEdit.spec`; measured green, and both redden when
`insertLineBreak` is dropped from the table.

## Amendment, 2026-08-25: a soft break is a CONTINUATION ROW, and `softBreak` is not built

The open item above named one reading of a soft break — a `softBreak` string scanned inside a
row's body — and the row keymap takes the other, because it adds no primitive. One line is one row,
so a second line inside a row has to BE a row, and the only question is whose: Shift+Enter writes
the separator plus an indent run, which makes the continuation a row with no kind inside the
subtree of the row whose kind owns the line. The scan already parses that shape and the tree
already pins it.

**Whose line it is, is the whole rule** (`continuationDepth`). A row with a KIND owns its lines,
and so does a ROOT with none — a root paragraph is its own block, and a paragraph receives its
child rows as ordinary children, so its second line paints inside it. Under those the continuation
is a CHILD. A NESTED row with no kind is already an interior line, so the next line is its SIBLING.
The first draft measured from the caret's row unconditionally and built a staircase: `'- a'`
soft-broken three times emitted `'- a⏎⇥one⏎⇥⇥two⏎⇥⇥⇥'`, four levels for one list item, with only
line 2 landing in the bullet's own slot.

It is ONE splice rather than a split followed by a re-indent, and that is forced rather than
preferred: in controlled mode the tree has not moved when the first verb returns, so a second verb
in the same tick would address the document as it was. The depth it asks for is the tree's own
answer to "what would a row written directly under this one land at" — `depthCeiling` — so on a row
that can take no children (an EMPTY one) the continuation is written at the row's own depth and
Shift+Enter is a plain split, with no rule restated in the keymap and no indent run the scan never
granted left in the value. With `indent: ''` every continuation is a plain split for the same
reason.

Tested against what a soft break has to do, rather than argued. It travels with its row on a drag
and copies with it, because it is inside its parent's span. It reaches a kind's component as the
`rows` prop, and a paragraph's as ordinary children, so a consumer paints it without a bullet by
styling that slot. The caret walks in and out of it natively, because one host makes every row
boundary a native step. Tab inside it re-indents rather than moving focus, because a row with no
kind asks the row it is nested in for the `indents` declaration.

Four costs, declared:

- Backspace at its start OUTDENTS before it merges, so rejoining the line takes two presses. That
  is the demote ladder answering, and it is the same answer any nested row gives. Shift+Tab is the
  same answer under another key.
- A consumer cannot tell a continuation from a row the user indented with Tab, because there is
  nothing to tell apart: the two are the same document. That is a RULE and not an ambiguity — the
  sibling reading above applies to both, and so does the inherited `indents`.
- Typed into a row that already has children, the continuation lands BEFORE them, and in-slot
  pairing is unbounded index pairing — so those children's ids shift by one. That is the gap the
  split-cells phase owns; it is not new here.
- **A kind whose component ignores the `rows` prop paints no continuation at all.** `Block` hands
  a KIND its child rows as that prop and lets the kind decide where they go; a component that
  drops it drops every child row it has — a continuation, a Tab-nested row, a moved one, a pasted
  one alike. Core cannot see whether a component reads a prop, so this is a contract on the kind
  rather than a gate in the keymap: **a row kind that is rendered without `rows` cannot hold
  lines.** Only a paragraph is safe by construction, because `slots.block` takes its child rows as
  ordinary children.

`softBreak` is therefore not built, and nothing forecloses it: the fallback stated above still
stands if a case turns up that the continuation cannot carry. The two the P6 review found — the
staircase and Tab leaving the field — were both repairable inside this reading, in one expression
each, so neither buys the prop.

**Shift+Enter is no longer the generic path.** The paragraph above describing it as an
`insertLineBreak` that reaches the shared table is superseded — the guard drops both Enter
inputTypes now, and the keydown owns them.

**The demote ladder's kind rung un-nests the children of an empty row, and that is the encoding.**
Backspace or Enter at the entry of `'- ⏎⇥- b'` emits `'⏎⇥- b'`: `turnInto(undefined)` empties the
line, an empty row takes no children, and the scan promotes them — `b`'s own bytes never change and
its surplus `⇥` survives in its lead. Declared for the verb at `rowVerbs.spec`'s "promotes the
children of a row it empties", and pinned at the keymap now, because P6 is what makes it one
keystroke. The three row verbs answer this wall differently on purpose and it is not one rule held
three times: `setDepth` REFUSES, because a re-indent that silently un-nests is a surprise with no
gain and the user can outdent the children first; `splitAt` RELOCATES the subtree to its tail,
which a split has a natural home for; `turnInto` lets the scan answer, because the user asked for
the row's own bytes to change and refusing would leave no way at all to un-type an empty parent.
