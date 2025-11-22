---
title: Introduction
description: What is Markput and why should you use it
---

## What is Markput?

Markput is a powerful React component library for building rich text editors with **annotated text**. It allows you to seamlessly combine editable text with any React components, enabling you to create sophisticated editing experiences like mentions, slash commands, hashtags, and custom markup systems.

Unlike traditional rich text editors that operate on HTML or complex document models, Markput works with **plain text patterns** that are parsed and rendered as React components. This makes it lightweight, flexible, and easy to integrate with your existing application state.

```tsx
// Simple example: clickable mentions
<MarkedInput
  value="Hello @[World](user:123)!"
  onChange={setValue}
  Mark={ClickableMention}
/>
```

## Why Markput?

### 🎯 **Component-First Approach**
Markput treats annotations as React components, not DOM nodes. This means:
- Full control over rendering and styling
- Access to React hooks and context
- Type-safe props with TypeScript
- Easy integration with UI libraries (MUI, Chakra, etc.)

### 📝 **Plain Text State**
Your editor state is just a string with markup patterns like `@[value](meta)`. This makes:
- Serialization trivial (no complex JSON structures)
- Version control friendly (easy to diff)
- Backend integration simple (store as text)
- Testing straightforward (work with strings)

### 🔧 **Highly Flexible**
- **Custom Syntax**: Define your own markup patterns (markdown, HTML-like, custom)
- **Nested Marks**: Support for complex hierarchical structures
- **Dynamic Marks**: Editable, removable, focusable annotations
- **Custom Overlays**: Build autocomplete, suggestion menus, tooltips

### 🚀 **Zero Dependencies**
Markput has no external dependencies (except React as peer dependency). This means:
- Smaller bundle size
- No dependency conflicts
- Better long-term maintainability
- Full control over the codebase

### ⚡ **TypeScript-First**
Written entirely in TypeScript with comprehensive type definitions:
- Type-safe component props
- Generic type inference
- Excellent IDE support
- Catch errors at compile time

## When to Use Markput?

Markput is ideal for building:

### ✅ **Great Fit**
- **Mention Systems** - Twitter-like @mentions, Slack-style user tagging
- **Slash Commands** - Notion-like `/` command menus
- **Hashtag Systems** - Instagram-style #hashtags
- **Tag Editors** - Inline tags with autocomplete
- **Markdown Editors** - Bold, italic, and other formatting
- **Template Editors** - Variable insertion with `{{placeholder}}`
- **Custom Markup Languages** - Domain-specific notation systems

### ⚠️ **Consider Alternatives**
- **Full WYSIWYG Editors** - If you need complex document editing with tables, images, etc., consider [ProseMirror](https://prosemirror.net/), [Slate](https://www.slatejs.org/), or [Lexical](https://lexical.dev/)
- **Simple Text Input** - If you just need a basic textarea without annotations, use native `<textarea>`
- **Code Editors** - For syntax-highlighted code editing, use [CodeMirror](https://codemirror.net/) or [Monaco](https://microsoft.github.io/monaco-editor/)

## Key Features at a Glance

| Feature | Description |
|---------|-------------|
| **Annotations** | Add, edit, remove, and visualize text annotations |
| **Nested Marks** | Support for hierarchical and nested structures |
| **Custom Syntax** | Define your own markup patterns (regex-based) |
| **Dynamic Marks** | Create editable and interactive annotations |
| **Overlay System** | Built-in autocomplete and suggestion UI |
| **Keyboard Navigation** | Smart handling of arrows, delete, backspace, escape |
| **TypeScript** | Full type safety and IDE autocomplete |
| **Slots Pattern** | Customize internal components (MUI-style) |
| **Zero Dependencies** | Lightweight with no external packages |
| **Cross Selection** | Select text across multiple marks and nodes |

## Architecture Overview

Markput consists of two main packages:

### `rc-marked-input`
The React component wrapper. This is what you'll typically use in your application.
```bash
npm install rc-marked-input
```

### `@markput/core`
The framework-agnostic core library containing the parser, tokenizer, and state management. You only need this if you're building custom integrations.

```
┌─────────────────────────────────────┐
│        Your Application             │
└─────────────────┬───────────────────┘
                  │
┌─────────────────▼───────────────────┐
│      rc-marked-input (React)        │
│  • MarkedInput Component            │
│  • Hooks (useMark, useOverlay)      │
│  • createMarkedInput                │
└─────────────────┬───────────────────┘
                  │
┌─────────────────▼───────────────────┐
│      @markput/core (Framework-free) │
│  • Parser & Tokenizer               │
│  • State Management                 │
│  • Event System                     │
└─────────────────────────────────────┘
```

## Quick Comparison

| Feature | Markput | ContentEditable | ProseMirror/Slate |
|---------|---------|-----------------|-------------------|
| **Learning Curve** | Low | Medium | High |
| **Bundle Size** | ~20KB | N/A | ~100-200KB |
| **TypeScript** | ✅ Excellent | ⚠️ Varies | ✅ Good |
| **Custom Components** | ✅ Native | ❌ Limited | ✅ Possible |
| **State Model** | Plain Text | HTML/DOM | JSON Schema |
| **Annotations** | ✅ Native | ⚠️ Complex | ✅ Native |
| **Nested Structures** | ✅ Yes | ✅ Yes | ✅ Yes |
| **Collaborative Editing** | ⚠️ Manual | ⚠️ Complex | ✅ Built-in (some) |

## Next Steps

Ready to get started? Here's your learning path:

1. **[Installation](./installation)** - Install Markput in your project
2. **[Quick Start](./quick-start)** - Build your first annotated text editor
3. **[Core Concepts](./core-concepts)** - Understand marks, tokens, and parsing
4. **[Guides](/guides/configuration)** - Learn how to configure and customize
5. **[Examples](/examples/mention-system)** - See production-ready examples

---

**Questions?** Check out the [FAQ](#) or [open a discussion](https://github.com/Nowely/marked-input/discussions) on GitHub.
