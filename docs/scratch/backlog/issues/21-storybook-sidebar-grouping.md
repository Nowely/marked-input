# Storybook page grouping

Status: needs-info

Grouping is half applied. Of 11 pages, 8 titles carry a group segment and 3 are bare roots:
`MarkedInput` (Base), `Clipboard`, `Api`. `Api` and `API/Slots` are two distinct roots
differing only in case. `storySort.order` lists 3 of the 5 actual roots
(`.storybook/annotations.base.ts:31`). `MarkedInput` is simultaneously a root with its own
stories and the parent of four subgroups. `Styled/*` appears only in the React sidebar — all
three of its pages are React-only integration demos (antd `Tag`, MUI `Chip`, rsuite).

The `Selection` page that used to be a fourth bare root is gone: its two stories duplicated
Clipboard's byte for byte, and its one spec folded into `Slots.spec.ts`.

The note read "pages — design like ant — group", which has two readings and the reporter no
longer remembers which:

- **Sidebar taxonomy**, organised the way ant.design's docs nav is: every page under a named
  root, nothing loose. Metadata only — rewrite the 11 `title`s, extend `storySort.order` to
  cover every root, resolve the `Api`/`API` collision. Cost: every story id changes, which
  breaks bookmarked and deployed links. The `.snap` keys are safe; they derive from the
  directory name, not the title.
- **Page presentation**, the way Ant's component-doc pages look: each demo in a titled card
  with a description and a code toggle, `autodocs` on the seven pages that lack it. Real UI
  work in the storybook package, and it changes every story's rendered root — i.e. every entry
  in both `.snap` files.
