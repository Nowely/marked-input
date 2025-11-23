---
title: Why Markput?
description: What is Markput and why you should use it for annotated text inputs
version: 1.0.0
---

## What is Markput?

Markput is a React component library for building editors with **annotated text**. It renders plain text patterns as React components, enabling features like mentions, hashtags, and slash commands.

**Key difference:** Unlike HTML-based editors, Markput uses plain text with markup patterns like `@[value](meta)`, making it lightweight and easy to integrate with your existing application state.

```tsx
// Simple example: clickable mentions
<MarkedInput
  value="Hello @[World](user:123)!"
  onChange={setValue}
  Mark={ClickableMention}
/>
```

## Why Markput?

| Feature | Description |
|---------|-------------|
| **Component-First** | Annotations are React components, giving you full control over rendering and behavior. |
| **Plain Text State** | State is a string with markup (`@[value](meta)`). Easy to serialize, test, and store. |
| **Zero Dependencies** | Lightweight (~20KB) with no external dependencies. |
| **TypeScript-First** | Written in TypeScript with comprehensive type definitions. |
| **Custom Syntax** | Define your own markup patterns (markdown, HTML-like, custom). |
| **Dynamic Marks** | Support for editable, removable, and focusable annotations. |
| **Overlay System** | Built-in autocomplete and suggestion UI for mentions and commands. |
| **Nested Marks** | Support for hierarchical and nested structures. |

## When to Use Markput?

**Good For:**
- **Mention Systems** (@mentions, user tagging)
- **Slash Commands** (Notion-like menus)
- **Hashtag Systems** (#hashtags)
- **Structured Editors** (Variables, placeholders, inline tags)

**Consider Alternatives:**
- **Full WYSIWYG Editors**: For documents with tables and images, use [ProseMirror](https://prosemirror.net/), [Slate](https://www.slatejs.org/), or [Lexical](https://lexical.dev/).
- **Simple Text Input**: For basic text without annotations, use a native `<textarea>`.
- **Code Editors**: For syntax highlighting, use [CodeMirror](https://codemirror.net/) or [Monaco](https://microsoft.github.io/monaco-editor/).

## Next Steps

1. **[Getting Started](./getting-started)** - Install Markput in your project
2. **[Quick Start](./quick-start)** - Build your first annotated text editor
3. **[Core Concepts](./core-concepts)** - Understand marks, tokens, and parsing
4. **[Guides](/guides/configuration)** - Learn how to configure and customize
5. **[Examples](/examples/mention-system)** - See production-ready examples

---

**Questions?** [Open a discussion](https://github.com/Nowely/marked-input/discussions) on GitHub.
