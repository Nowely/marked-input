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

- **Component-First**: Marks are your components - full control, no constraints.
- **Flexible Patterns**: Custom markup syntax - markdown, HTML-like, or your own.
- **Dynamic Marks**: Interactive with editing, removing, focusing, and custom actions.
- **Overlay System**: Built-in suggestions or fully custom overlays.
- **Nested Marks**: Hierarchical structures - marks inside marks.
- **Zero Dependency**: Lightweight, no external dependencies.
- **Plain Text State**: Simple string storage - easy to save and version.
- **TypeScript-First**: Full type safety included.

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
