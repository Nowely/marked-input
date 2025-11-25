---
title: Why Markput?
description: Lightweight React library for mentions, hashtags, and slash commands using plain text markup instead of heavy HTML editors
keywords: [markput, react mentions, marks, lightweight editor, slash commands]
---

Markput is a React component library for building editors with **custom markup**. It transforms plain text patterns into interactive React components, giving you full control over rendering and behavior.

**Simple API, complex possibilities.** Define patterns like `@[__value__](__meta__)`, pass React components — done. Markput handles parsing, rendering, keyboard navigation, and autocomplete. Build @mentions, /commands, or nested formatting in minutes.

```tsx
import { MarkedInput } from 'rc-marked-input'

function App() {
  const [value, setValue] = useState('Hello @[World](id:123)!')

  return (
    <MarkedInput
      value={value}
      onChange={setValue}
      Mark={props => <mark>{props.value}</mark>}
    />
  )
}
```

## Features

- **Component-First** - Marks are your components. Full control over rendering and behavior.
- **Flexible Patterns** - Define your own markup patterns - markdown, HTML-like, etc.
- **Dynamic Marks** - Marks can be edited, removed, focused, and trigger custom interactions.
- **Overlay System** - Trigger-based overlays with built-in suggestions or custom components.
- **Nested Marks** - Create hierarchical structures with marks inside marks.
- **Zero Dependency** - Lightweight with no external dependencies.
- **Plain Text State** - State is a string with your markup.
- **TypeScript-First** - Written in TypeScript with comprehensive type definitions.

## When to Use Markput?

**Good For:**

- **Mention Systems** - Slack-like @mentions, team collaboration, user tagging in comments
- **Slash Commands** - Notion-like menus, quick actions, command palettes
- **Hashtag Systems** - Social media #hashtags, topic categorization, content tagging
- **Structured Editors** - Variables, placeholders, inline tags, templating systems

**Consider Alternatives:**

- **Full WYSIWYG Editors**: For documents with tables and images, use [ProseMirror](https://prosemirror.net/), [Slate](https://www.slatejs.org/), or [Lexical](https://lexical.dev/).
- **Simple Text Input**: For basic text without marks, use a native `<textarea>`.
- **Code Editors**: For syntax highlighting, use [CodeMirror](https://codemirror.net/) or [Monaco](https://microsoft.github.io/monaco-editor/).

**Questions?** [Open a discussion](https://github.com/Nowely/marked-input/discussions) on GitHub.
