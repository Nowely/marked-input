---
title: 🚧 Markdown Editor
description: GitHub markdown editor tutorial - bold, italic, code blocks, links, live preview, keyboard shortcuts
keywords: [markdown editor, rich text, formatting, bold, italic, code blocks, live preview, WYSIWYG]
---

This example demonstrates how to build a Markdown editor with bold, italic, links, images, and live preview - similar to GitHub, Stack Overflow, or Reddit.

## Use Case

**What we're building:**

- Markdown formatting (bold, italic, code, links)
- Live preview
- Formatting toolbar
- Keyboard shortcuts (Ctrl+B, Ctrl+I, etc.)
- Nested formatting support

**Where to use it:**

- Documentation platforms (GitHub, GitLab)
- Q&A sites (Stack Overflow)
- Blogging platforms (Dev.to, Medium)
- Note-taking apps (Obsidian, Notion)
- Comment systems

## Complete Implementation

### Step 1: Define Markdown Rules

```tsx
// markdown.ts
export interface MarkdownRule {
    id: string
    markup: string
    component: React.ComponentType<any>
    icon: string
    label: string
    shortcut?: string
    insertPattern?: {before: string; after: string}
}

export const MARKDOWN_RULES: MarkdownRule[] = [
    {
        id: 'bold',
        markup: '**__nested__**',
        component: BoldMark,
        icon: 'B',
        label: 'Bold',
        shortcut: 'Mod-b',
        insertPattern: {before: '**', after: '**'},
    },
    {
        id: 'italic',
        markup: '*__nested__*',
        component: ItalicMark,
        icon: 'I',
        label: 'Italic',
        shortcut: 'Mod-i',
        insertPattern: {before: '*', after: '*'},
    },
    {
        id: 'code',
        markup: '`__value__`',
        component: CodeMark,
        icon: '<>',
        label: 'Inline Code',
        insertPattern: {before: '`', after: '`'},
    },
    {
        id: 'link',
        markup: '[__value__](__meta__)',
        component: LinkMark,
        icon: '🔗',
        label: 'Link',
        shortcut: 'Mod-k',
        insertPattern: {before: '[', after: '](url)'},
    },
    {
        id: 'image',
        markup: '![__value__](__meta__)',
        component: ImageMark,
        icon: '🖼️',
        label: 'Image',
    },
]
```

### Step 2: Mark Components

```tsx
// MarkdownMarks.tsx
import {FC, ReactNode} from 'react'
import './MarkdownMarks.css'

export const BoldMark: FC<{children: ReactNode}> = ({children}) => <strong className="md-bold">{children}</strong>

export const ItalicMark: FC<{children: ReactNode}> = ({children}) => <em className="md-italic">{children}</em>

export const CodeMark: FC<{value: string}> = ({value}) => <code className="md-code">{value}</code>

export const LinkMark: FC<{value: string; meta: string}> = ({value, meta}) => (
    <a
        href={meta}
        className="md-link"
        target="_blank"
        rel="noopener noreferrer"
        onClick={e => {
            if (!meta || meta === 'url') {
                e.preventDefault()
            }
        }}
    >
        {value}
    </a>
)

export const ImageMark: FC<{value: string; meta: string}> = ({value, meta}) => (
    <span className="md-image">
        <img
            src={meta}
            alt={value}
            onError={e => {
                e.currentTarget.style.display = 'none'
            }}
        />
        <span className="md-image-alt">{value}</span>
    </span>
)
```

```css
/* MarkdownMarks.css */
.md-bold {
    font-weight: 700;
}

.md-italic {
    font-style: italic;
}

.md-code {
    font-family: 'Monaco', 'Menlo', monospace;
    background-color: #f5f5f5;
    border: 1px solid #e0e0e0;
    border-radius: 3px;
    padding: 2px 6px;
    font-size: 0.9em;
    color: #d32f2f;
}

.md-link {
    color: #2196f3;
    text-decoration: underline;
    cursor: pointer;
}

.md-link:hover {
    color: #1976d2;
}

.md-image {
    display: inline-block;
    position: relative;
}

.md-image img {
    max-width: 100%;
    height: auto;
    border-radius: 4px;
}

.md-image-alt {
    display: block;
    font-size: 12px;
    color: #757575;
    margin-top: 4px;
}
```

### Step 3: Formatting Toolbar

```tsx
// FormattingToolbar.tsx
import {FC} from 'react'
import type {MarkdownRule} from './markdown'
import './FormattingToolbar.css'

interface FormattingToolbarProps {
    rules: MarkdownRule[]
    onFormat: (rule: MarkdownRule) => void
}

export const FormattingToolbar: FC<FormattingToolbarProps> = ({rules, onFormat}) => {
    return (
        <div className="formatting-toolbar">
            {rules.map(rule => (
                <button
                    key={rule.id}
                    className="toolbar-button"
                    onClick={() => onFormat(rule)}
                    title={`${rule.label}${rule.shortcut ? ` (${rule.shortcut})` : ''}`}
                    aria-label={rule.label}
                >
                    <span className="toolbar-icon">{rule.icon}</span>
                </button>
            ))}
        </div>
    )
}
```

```css
/* FormattingToolbar.css */
.formatting-toolbar {
    display: flex;
    gap: 4px;
    padding: 8px;
    background-color: #f5f5f5;
    border: 1px solid #e0e0e0;
    border-radius: 8px 8px 0 0;
    border-bottom: none;
}

.toolbar-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    background: white;
    border: 1px solid #e0e0e0;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s ease;
}

.toolbar-button:hover {
    background-color: #eeeeee;
    border-color: #bdbdbd;
}

.toolbar-button:active {
    transform: scale(0.95);
}

.toolbar-icon {
    font-weight: 700;
    font-size: 14px;
    color: #424242;
}
```

### Step 4: Markdown Editor

```tsx
// MarkdownEditor.tsx
import {FC, useState, useCallback, useRef} from 'react'
import {MarkedInput} from '@markput/react'
import {FormattingToolbar} from './FormattingToolbar'
import {MARKDOWN_RULES} from './markdown'
import type {MarkdownRule} from './markdown'
import './MarkdownEditor.css'

export const MarkdownEditor: FC = () => {
    const [value, setValue] = useState('')
    const [showPreview, setShowPreview] = useState(false)
    const editorRef = useRef<HTMLDivElement>(null)

    const handleFormat = useCallback(
        (rule: MarkdownRule) => {
            if (!rule.insertPattern) return

            const {before, after} = rule.insertPattern
            const selection = window.getSelection()
            const selectedText = selection?.toString() || 'text'

            // Insert formatted text at cursor
            const newText = `${before}${selectedText}${after}`

            // Get cursor position and insert
            const cursorPos = getCursorPosition(editorRef.current)
            const beforeCursor = value.substring(0, cursorPos)
            const afterCursor = value.substring(cursorPos)

            setValue(beforeCursor + newText + afterCursor)
        },
        [value]
    )

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            const isMod = e.metaKey || e.ctrlKey

            if (isMod) {
                const rule = MARKDOWN_RULES.find(r => {
                    if (!r.shortcut) return false
                    const [mod, key] = r.shortcut.split('-')
                    return key === e.key.toLowerCase()
                })

                if (rule) {
                    e.preventDefault()
                    handleFormat(rule)
                }
            }
        },
        [handleFormat]
    )

    const markdownOptions = MARKDOWN_RULES.map(rule => ({
        markup: rule.markup,
        slots: {mark: rule.component},
    }))

    return (
        <div className="markdown-editor-container">
            <div className="markdown-editor-header">
                <h2>Markdown Editor</h2>
                <button className="preview-toggle" onClick={() => setShowPreview(!showPreview)}>
                    {showPreview ? 'Edit' : 'Preview'}
                </button>
            </div>

            <FormattingToolbar rules={MARKDOWN_RULES} onFormat={handleFormat} />

            <div className="markdown-editor-layout">
                <div className={`editor-pane ${showPreview ? 'hidden' : ''}`}>
                    <MarkedInput
                        value={value}
                        onChange={setValue}
                        Mark={MARKDOWN_RULES[0].component}
                        options={markdownOptions}
                        slotProps={{
                            container: {
                                ref: editorRef,
                                className: 'markdown-input',
                                onKeyDown: handleKeyDown,
                            },
                        }}
                    />
                </div>

                {showPreview && (
                    <div className="preview-pane">
                        <div className="preview-content">{renderMarkdownPreview(value)}</div>
                    </div>
                )}
            </div>

            <div className="markdown-editor-footer">
                <span className="char-count">{value.length} characters</span>
                <a
                    href="https://www.markdownguide.org/cheat-sheet/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="markdown-help"
                >
                    Markdown Guide
                </a>
            </div>
        </div>
    )
}

// Helper to render markdown preview
function renderMarkdownPreview(markdown: string): string {
    // Simple preview - in production use a library like marked or remark
    return markdown
        .replace(/\*\*([^\*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/\*([^\*]+)\*/g, '<em>$1</em>')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\[([^\]]+)\]\(([^\)]+)\)/g, '<a href="$2">$1</a>')
}

function getCursorPosition(element: HTMLElement | null): number {
    if (!element) return 0

    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return 0

    const range = selection.getRangeAt(0)
    const preCaretRange = range.cloneRange()
    preCaretRange.selectNodeContents(element)
    preCaretRange.setEnd(range.endContainer, range.endOffset)

    return preCaretRange.toString().length
}
```

```css
/* MarkdownEditor.css */
.markdown-editor-container {
    max-width: 900px;
    margin: 0 auto;
    padding: 20px;
}

.markdown-editor-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
}

.markdown-editor-header h2 {
    margin: 0;
    font-size: 24px;
    color: #212121;
}

.preview-toggle {
    padding: 8px 16px;
    background-color: #2196f3;
    color: white;
    border: none;
    border-radius: 6px;
    font-weight: 600;
    cursor: pointer;
    transition: background-color 0.2s;
}

.preview-toggle:hover {
    background-color: #1976d2;
}

.markdown-editor-layout {
    position: relative;
}

.editor-pane {
    transition: opacity 0.2s;
}

.editor-pane.hidden {
    display: none;
}

.markdown-input {
    border: 1px solid #e0e0e0;
    border-radius: 0 0 8px 8px;
    border-top: none;
    padding: 16px;
    min-height: 300px;
    font-size: 15px;
    line-height: 1.6;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    outline: none;
}

.markdown-input:focus {
    border-color: #2196f3;
}

.preview-pane {
    border: 1px solid #e0e0e0;
    border-radius: 0 0 8px 8px;
    border-top: none;
    padding: 16px;
    min-height: 300px;
    background-color: #fafafa;
}

.preview-content {
    font-size: 15px;
    line-height: 1.6;
}

.markdown-editor-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 12px;
    font-size: 14px;
    color: #757575;
}

.markdown-help {
    color: #2196f3;
    text-decoration: none;
}

.markdown-help:hover {
    text-decoration: underline;
}
```

## Variations

### Variation 1: Syntax Highlighting

```tsx
import Prism from 'prismjs'
import 'prismjs/themes/prism.css'

const CodeBlockMark: FC<{value: string; meta: string}> = ({value, meta}) => {
    const highlighted = Prism.highlight(value, Prism.languages[meta] || Prism.languages.plaintext, meta)

    return (
        <pre className="code-block">
            <code dangerouslySetInnerHTML={{__html: highlighted}} />
        </pre>
    )
}
```

### Variation 2: Table Support

```tsx
const TableMark: FC<{value: string}> = ({value}) => {
    const rows = value.split('\\n').map(row => row.split('|'))

    return (
        <table className="md-table">
            <thead>
                <tr>
                    {rows[0].map((cell, i) => (
                        <th key={i}>{cell.trim()}</th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {rows.slice(2).map((row, i) => (
                    <tr key={i}>
                        {row.map((cell, j) => (
                            <td key={j}>{cell.trim()}</td>
                        ))}
                    </tr>
                ))}
            </tbody>
        </table>
    )
}
```
