---
title: Why Markput?
description: Lightweight React library for building custom markup text editors with plain text storage and full component control
keywords: [markput, react mentions, marks, custom markup, text editor, slash commands, autocomplete, typescript]
---

Markput is a React component library for building editors with **custom markup**. It transforms plain text patterns into interactive React components, giving you full control over rendering and behavior.

**The Problem**: Building custom text editors usually means choosing between:
- **Simple but limited** (basic input + regex)
- **Powerful but complex** (Draft.js, Slate with steep learning curves)

**Our Philosophy**: You shouldn't have to choose. Markput combines:

- **Simple API**: Define patterns like `@[__value__](__meta__)`, pass components — done.
- **No framework overhead**: Your React components work as-is, no adapters.
- **Debuggable state**: Plain text strings, not complex JSON schemas.
- **Scale naturally**: Start with @mentions, add nested formatting later — same API.

## Features

- **Component-First**: Marks are your components - full control, no constraints.
- **Flexible Patterns**: Custom markup syntax - markdown, HTML-like, or your own.
- **Dynamic Marks**: Interactive marks with editing, removing, focusing, and custom actions.
- **Overlay System**: Built-in suggestions or fully custom overlays.
- **Nested Marks**: Hierarchical structures - marks inside marks.
- **Zero Dependency**: Lightweight, no external dependencies.
- **Plain Text State**: Simple string storage - easy to save and version.
- **TypeScript-First**: Full type safety included.

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
