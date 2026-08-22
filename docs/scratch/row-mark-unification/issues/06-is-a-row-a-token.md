# Is a Row a Token? — glossary decision

Type: grilling
Status: open

## Question

CONTEXT.md declares "A **Mark** is a **Token**" while a Row is only "Block
layout's top-level node"; the Token entry reads "either text or a mark". The
tree already has three node kinds (`'text' | 'mark' | 'row'`).

Under one structure: does Row enter the language as a Token? What do the
Row, Block layout, and Relationships entries become? Update CONTEXT.md in the
session (domain-modeling discipline: glossary only, no implementation
detail). Write an ADR only if the change is hard to reverse, surprising, and
a real trade-off — otherwise skip it.
