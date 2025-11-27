---
title: Why Markput?
description: Lightweight React library for building custom markup text editors with plain text storage and full component control
keywords: [markput, react mentions, marks, custom markup, text editor, slash commands, autocomplete, typescript]
---

Markput (marked input) is a React component library for building editors with **custom markup**. It transforms plain text patterns into interactive React components, giving you full control over rendering and behavior.

**The Problem**: Building custom text editors usually means choosing between:

- **Simple but limited** (basic input + regex)
- **Powerful but complex** (Draft.js, Slate with steep learning curves)

**Our Philosophy**: You shouldn't have to choose. Markput combines:

- **Simple API**: Define patterns like `@[__value__](__meta__)`, pass components - done.
- **No framework overhead**: Your React components work as-is, no adapters.
- **Debuggable state**: Plain text strings, not complex JSON schemas.
- **Scale naturally**: Start with @mentions, add nested formatting later - same API.

## Features

- **Component-First**: Marks are your components - full control, no constraints.
- **Flexible Patterns**: Custom markup syntax - markdown, HTML-like, or your own.
- **Dynamic Marks**: Interactive marks with editing, removing, focusing, and custom actions.
- **Overlay System**: Built-in suggestions or fully custom overlays.
- **Nested Marks**: Hierarchical structures - marks inside marks.
- **Cross Selection**: Select text across multiple marks - seamless text highlighting.
- **Zero Dependency**: Lightweight, no external dependencies.
- **Plain Text State**: Simple string storage - easy to save and version.
- **TypeScript-First**: Full type safety included.

## Use Cases

**Ideal for:**

- **Social features** - @mentions, #hashtags, /commands
- **Markdown/HTML formatting** - Bold, italic, links, code, custom tags
- **Custom markup** - Templates, BBCode, domain-specific languages
- **Lightweight editors** - Plain text + markup patterns approach

**Can be built (requires work):**

- **WYSIWYG editors** - Rich documents with tables and images
  _(Markput supports this, but requires custom implementation)_

**Not ideal for:**

- **Plain text only** - Use native `<textarea>` if no markup needed
- **Code editing** - Use [CodeMirror](https://codemirror.net/) for syntax highlighting and LSP

**Have questions or found a bug?** [Start a discussion](https://github.com/Nowely/marked-input/discussions) or [open an issue](https://github.com/Nowely/marked-input/issues) on GitHub.
