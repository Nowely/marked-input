---
title: Why Markput?
description: Lightweight React library for mentions, hashtags, and slash commands using plain text markup instead of heavy HTML editors
keywords: [markput, react mentions, marks, lightweight editor, slash commands]
---

Markput is a React component library for building editors with **custom markup**. It transforms plain text patterns into interactive React components, giving you full control over rendering and behavior.

**Key difference:** Unlike complex editors (Draft.js, Slate), Markput stores content as **plain text** with markup patterns like `@[value](meta)` — making it trivial to save, serialize, and version control.

```tsx
import { MarkedInput } from 'rc-marked-input'

function App() {
  const [value, setValue] = useState('Hello @[World]!')

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

| Feature                | Description                                                                           |
| ---------------------- | ------------------------------------------------------------------------------------- |
| **Component-First**    | Marks are React components, giving you full control over rendering and behavior.      |
| **Plain Text State**   | State is a string with markup (`@[value](meta)`). Easy to serialize, test, and store. |
| **Zero Dependencies**  | Lightweight (~20KB) with no external dependencies.                                    |
| **TypeScript-First**   | Written in TypeScript with comprehensive type definitions.                            |
| **Flexible Patterns**  | Define your own markup patterns - markdown, HTML-like, etc.                           |
| **Dynamic Marks**      | Support for editable, removable, and focusable marks.                                 |
| **Overlay System**     | Built-in autocomplete and suggestion UI for mentions and commands.                    |
| **Complex Structures** | Support for hierarchical marks and nested elements.                                   |

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
