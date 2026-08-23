# Is a Row a Token? — glossary decision

Type: grilling
Status: open
Blocked by: 02

## Question

CONTEXT.md declares "A **Mark** is a **Token**" while a Row is only "Block
layout's top-level node"; the Token entry reads "either text or a mark". The
tree already has three node kinds (`'text' | 'mark' | 'row'`).

Under one structure: does Row enter the language as a Token? What do the
Row, Block layout, and Relationships entries become? Update CONTEXT.md in the
session (domain-modeling discipline: glossary only, no implementation
detail). Write an ADR only if the change is hard to reverse, surprising, and
a real trade-off — otherwise skip it.

Blocked on [02](02-one-render-path.md)'s slot-registry sub-question, which
would rename `slots.block` — the very name `CONTEXT.md:110` calls "not a
rename target". Closing 06 first would write a glossary entry that decision
deletes.

## Round 1 (2026-08-22) — two live options, three mandatory repairs

**The website already publishes an answer and the glossary contradicts it.**
`architecture.md:436`, verbatim: "a block row's wrapper included, since a row
IS a token (ADR-0009)". `CONTEXT.md:10` says a Token is "either text or a
mark". The contradiction is live today, in published docs.

**Survived:** (1) *Widen the Token* — `Token = text | mark | row`, the Row
entry declares membership, Flagged ambiguity 2 is amended. The smallest edit
that makes CONTEXT.md agree with both `architecture.md:436` and ADR-0009.
(2) *The unit is a Node* — align the language with every published type name
(`TreeNode`, `MarkNode`, `nodes()`, `NodeCommands`), which dissolves the row
question and lets the **Lexeme** entry be DELETED, since "Token" goes back to
meaning only the parser's output. It reverses Flagged ambiguity 1, whose only
real collision is one published field, `OverlayMatch.node`.

**Died:** "Row is NOT a Token" — its discriminator, "what Tokens sit in",
describes a slot Mark too, and it must reverse shipped prose no other option
touches. "Token by criterion" — spans NEST, so "owns a span of the Value"
partitions nothing, and the separator region lies inside a Row's span while
being owned by no Token. "Rows all the way down" — measured 195/1001 core
tests red, and it must supersede ADR-0009.

**Three repairs are owed whichever option wins:**

- `CONTEXT.md:70` is stale — "every top-level token is its own row" is false
  under ADR-0009; `parseRows` groups the top level and a row holds many tokens.
- `CONTEXT.md:102` "Every Token is mirrored into one Surface" is already false
  for MARKS, not just rows (`bind.ts:206`: `textElement` only when
  `kind === 'text'`). The repair must be phrased about Surfaces, not children —
  an ATOMIC mark has no children yet owns a consigned wrapper.
- The Row entry's "span between Separator occurrences" is **factually wrong**,
  proven from `Parser.parseRows`' own docblock: separator occurrences inside a
  match extent are hidden, so a markup whose literal text absorbs newlines
  yields three visual lines as ONE row with ONE grip.

One inaccuracy already sitting in `CONTEXT.md:108`, worth fixing in the same
pass: it calls `MarkToken` parser-local, but `MarkToken` is a published export.
