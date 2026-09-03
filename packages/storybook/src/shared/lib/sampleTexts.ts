/**
 * Sample text for drag mode: rows are spans between the structural separator
 * (ADR-0009), and the Drag stories configure `'\n\n'`, so each blank line ends a
 * row. List items use loose-list format so every item is its own row there — under
 * a tight list `'\n\n'` would make the whole list one row, while the DEFAULT `'\n'`
 * splits per line (the TodoList story does exactly that).
 */
export const DRAG_MARKDOWN = `# Welcome to **Marked Input**

A powerful library for parsing rich text with markdown formatting.

## Features

- **Bold** and *italic* text support

- \`Code snippets\` and \`code blocks\`

- ~~Strikethrough~~ for deleted content

- Links like [GitHub](https://github.com)

## Example

\`\`\`javascript
const parser = new ParserV2(['**__value__**', '*__value__*'])
const result = parser.parse('Hello **world**!')
\`\`\`

Visit our docs for more details.`

export const COMPLEX_MARKDOWN = `# Welcome to **Marked Input**

This is a *powerful* library for parsing **rich text** with *markdown* formatting.
You can use \`inline code\` snippets like \`const parser = new ParserV2()\` in your text.

## Features

- **Bold text** with **strong emphasis**
- *Italic text* and *emphasis* support
- \`Code snippets\` and \`code blocks\`
- ~~Strikethrough~~ for deleted content
- Links like [GitHub](https://github.com)

## Example

Here's how to use it:

\`\`\`javascript
const parser = new ParserV2(['**__value__**', '*__value__*'])
const result = parser.parse('Hello **world**!')
\`\`\`

Visit our [documentation](https://docs.example.com) for more details.
~~This feature is deprecated~~ and will be removed in v3.0.`