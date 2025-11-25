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

## Design Principles

Markput was built with clear principles to solve real problems in building custom text editors.

**Markput is…**

- **Simple by default**: Start with 3 lines of code, scale to complex interactions.
- **Component-first**: Your React components, your styling, your behavior — no adapters.
- **Flexible**: Define any markup pattern — not locked into mentions or hashtags.
- **Lightweight**: Zero dependencies, plain text storage, minimal overhead.
- **Developer-friendly**: TypeScript-first, clear APIs, no hidden magic.

## Use Cases

**Perfect for:**

- **Mention Systems** - Slack-like @mentions, team collaboration, user tagging
- **Slash Commands** - Notion-like menus, quick actions, command palettes
- **Hashtag Systems** - Social media #hashtags, topic categorization
- **Structured Editors** - Variables, placeholders, templating systems

**Not ideal for:**

- **Full WYSIWYG Editors** - For documents with tables and images, use [ProseMirror](https://prosemirror.net/), [Slate](https://www.slatejs.org/), or [Lexical](https://lexical.dev/)
- **Basic Text Input** - For simple text without marks, use native `<textarea>`
- **Code Editors** - For syntax highlighting, use [CodeMirror](https://codemirror.net/) or [Monaco](https://microsoft.github.io/monaco-editor/)

**Questions?** [Open a discussion](https://github.com/Nowely/marked-input/discussions) on GitHub.
