---
title: Why Markput?
description: Lightweight React library for mentions, hashtags, and slash commands using plain text markup instead of heavy HTML editors
keywords: [markput, react mentions, text annotations, lightweight editor, slash commands]
---

Markput is a React component library for building editors with **custom markup**. It renders plain text patterns as React components, enabling features like mentions, hashtags, and slash commands.

**Key difference:** Unlike HTML-based editors, Markput uses plain text with markup patterns like `@[value](meta)`, making it lightweight and easy to integrate with your existing application state.

```tsx
// Simple example: clickable mentions
const ClickableMention = ({ value, meta }) => (
  <span
    onClick={() => console.log('Clicked user:', meta)}
    style={{ color: 'blue', cursor: 'pointer' }}
  >
    @{value}
  </span>
);

<MarkedInput
  value="Hello @[World](user:123)!"
  onChange={setValue}
  Mark={ClickableMention}
/>
```

## Features

| Feature | Description |
|---------|-------------|
| **Component-First** | Annotations are React components, giving you full control over rendering and behavior. |
| **Plain Text State** | State is a string with markup (`@[value](meta)`). Easy to serialize, test, and store. |
| **Zero Dependencies** | Lightweight (~20KB) with no external dependencies. |
| **TypeScript-First** | Written in TypeScript with comprehensive type definitions. |
| **Flexible Patterns** | Define your own markup patterns - markdown, HTML-like, etc. |
| **Dynamic Marks** | Support for editable, removable, and focusable annotations. |
| **Overlay System** | Built-in autocomplete and suggestion UI for mentions and commands. |
| **Complex Structures** | Support for hierarchical markups and nested elements. |

## When to Use Markput?

**Good For:**
- **Mention Systems** - Slack-like @mentions, team collaboration, user tagging in comments
- **Slash Commands** - Notion-like menus, quick actions, command palettes
- **Hashtag Systems** - Social media #hashtags, topic categorization, content tagging
- **Structured Editors** - Variables, placeholders, inline tags, templating systems

**Consider Alternatives:**
- **Full WYSIWYG Editors**: For documents with tables and images, use [ProseMirror](https://prosemirror.net/), [Slate](https://www.slatejs.org/), or [Lexical](https://lexical.dev/).
- **Simple Text Input**: For basic text without annotations, use a native `<textarea>`.
- **Code Editors**: For syntax highlighting, use [CodeMirror](https://codemirror.net/) or [Monaco](https://microsoft.github.io/monaco-editor/).

**Questions?** [Open a discussion](https://github.com/Nowely/marked-input/discussions) on GitHub.
