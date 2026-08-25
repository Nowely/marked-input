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
way to ask for that shape on purpose. `Parser.parseRows` keeps refusing `''` outright for callers
that reach it directly.

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
