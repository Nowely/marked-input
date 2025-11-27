---
title: 🚧 Slash Commands
description: Notion-style slash commands tutorial - command menu, text transformation, keyboard navigation, content insertion
keywords: [slash commands, command menu, Notion, text transformation, command palette, content insertion]
---

This example demonstrates how to build a slash command system like Notion, Slack, or Linear. Type `/` to trigger a menu of commands that transform text or insert content.

## Use Case

**What we're building:**
- Type `/` to show command menu
- Commands for headings, lists, code blocks
- Search/filter commands as you type
- Keyboard navigation
- Command execution with content transformation

**Where to use it:**
- Note-taking apps (Notion, Obsidian)
- Document editors (Google Docs, Confluence)
- Chat applications (Slack, Discord)
- Project management tools (Linear, Height)
- Code editors with command palette

## Complete Implementation

### Step 1: Define Command Types

```tsx
// types.ts
export type CommandType =
  | 'heading1'
  | 'heading2'
  | 'heading3'
  | 'bulletList'
  | 'numberedList'
  | 'quote'
  | 'code'
  | 'divider'
  | 'todo'

export interface Command {
  id: CommandType
  label: string
  description: string
  icon: string
  aliases: string[]
  execute: (editor: EditorContext) => void
}

export interface EditorContext {
  insertText: (text: string) => void
  replaceSelection: (text: string) => void
  getCurrentLine: () => string
}

export interface CommandMarkProps {
  command: CommandType
  label: string
}
```

### Step 2: Define Available Commands

```tsx
// commands.ts
import type { Command } from './types'

export const COMMANDS: Command[] = [
  {
    id: 'heading1',
    label: 'Heading 1',
    description: 'Large section heading',
    icon: 'H1',
    aliases: ['h1', 'title'],
    execute: (ctx) => {
      ctx.replaceSelection('# ')
    }
  },
  {
    id: 'heading2',
    label: 'Heading 2',
    description: 'Medium section heading',
    icon: 'H2',
    aliases: ['h2', 'subtitle'],
    execute: (ctx) => {
      ctx.replaceSelection('## ')
    }
  },
  {
    id: 'heading3',
    label: 'Heading 3',
    description: 'Small section heading',
    icon: 'H3',
    aliases: ['h3'],
    execute: (ctx) => {
      ctx.replaceSelection('### ')
    }
  },
  {
    id: 'bulletList',
    label: 'Bullet List',
    description: 'Create a simple bullet list',
    icon: '•',
    aliases: ['ul', 'list', 'bullet'],
    execute: (ctx) => {
      ctx.replaceSelection('- ')
    }
  },
  {
    id: 'numberedList',
    label: 'Numbered List',
    description: 'Create a numbered list',
    icon: '1.',
    aliases: ['ol', 'ordered'],
    execute: (ctx) => {
      ctx.replaceSelection('1. ')
    }
  },
  {
    id: 'quote',
    label: 'Quote',
    description: 'Insert a blockquote',
    icon: '"',
    aliases: ['blockquote', 'citation'],
    execute: (ctx) => {
      ctx.replaceSelection('> ')
    }
  },
  {
    id: 'code',
    label: 'Code Block',
    description: 'Insert a code block',
    icon: '<>',
    aliases: ['codeblock', 'pre'],
    execute: (ctx) => {
      ctx.insertText('\n```\n\n```\n')
    }
  },
  {
    id: 'divider',
    label: 'Divider',
    description: 'Insert a horizontal divider',
    icon: '―',
    aliases: ['hr', 'line', 'separator'],
    execute: (ctx) => {
      ctx.insertText('\n---\n')
    }
  },
  {
    id: 'todo',
    label: 'To-do List',
    description: 'Create a checklist',
    icon: '☑',
    aliases: ['checkbox', 'task', 'checklist'],
    execute: (ctx) => {
      ctx.replaceSelection('- [ ] ')
    }
  }
]

export function searchCommands(query: string): Command[] {
  const lowerQuery = query.toLowerCase()

  return COMMANDS.filter(
    (cmd) =>
      cmd.label.toLowerCase().includes(lowerQuery) ||
      cmd.description.toLowerCase().includes(lowerQuery) ||
      cmd.aliases.some((alias) => alias.includes(lowerQuery))
  )
}
```

### Step 3: Command Mark Component

```tsx
// CommandMark.tsx
import { FC } from 'react'
import type { CommandMarkProps } from './types'
import './CommandMark.css'

export const CommandMark: FC<CommandMarkProps> = ({ command, label }) => {
  return (
    <span className={`command-mark command-${command}`}>
      /{label}
    </span>
  )
}
```

```css
/* CommandMark.css */
.command-mark {
  display: inline-block;
  padding: 2px 8px;
  background-color: #f5f5f5;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 13px;
  color: #616161;
  font-weight: 500;
}

.command-mark:hover {
  background-color: #eeeeee;
}
```

### Step 4: Command Overlay Component

```tsx
// CommandOverlay.tsx
import { FC, useState, useEffect, useRef } from 'react'
import { useOverlay } from 'rc-marked-input'
import { COMMANDS, searchCommands } from './commands'
import type { Command } from './types'
import './CommandOverlay.css'

export const CommandOverlay: FC = () => {
  const { style, match, select, close, ref } = useOverlay()
  const [selectedIndex, setSelectedIndex] = useState(0)
  const selectedRef = useRef<HTMLButtonElement>(null)

  // Filter commands based on search
  const filteredCommands = searchCommands(match.value)

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0)
  }, [match.value])

  // Scroll selected item into view
  useEffect(() => {
    selectedRef.current?.scrollIntoView({
      block: 'nearest',
      behavior: 'smooth'
    })
  }, [selectedIndex])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex((prev) =>
          Math.min(prev + 1, filteredCommands.length - 1)
        )
        break

      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex((prev) => Math.max(prev - 1, 0))
        break

      case 'Enter':
      case 'Tab':
        e.preventDefault()
        if (filteredCommands[selectedIndex]) {
          selectCommand(filteredCommands[selectedIndex])
        }
        break

      case 'Escape':
        e.preventDefault()
        close()
        break
    }
  }

  const selectCommand = (command: Command) => {
    select({
      value: command.id,
      meta: command.label
    })

    // Execute command after selection
    // This will be handled by the editor
  }

  if (filteredCommands.length === 0) {
    return (
      <div
        ref={ref}
        className="command-overlay"
        style={{
          position: 'absolute',
          left: style.left,
          top: style.top
        }}
      >
        <div className="command-overlay-empty">
          No commands found for "/{match.value}"
        </div>
      </div>
    )
  }

  return (
    <div
      ref={ref}
      className="command-overlay"
      style={{
        position: 'absolute',
        left: style.left,
        top: style.top
      }}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      <div className="command-overlay-header">
        <span className="command-overlay-title">Commands</span>
        <span className="command-overlay-hint">
          ↑↓ to navigate • Enter to select
        </span>
      </div>

      <div className="command-overlay-list">
        {filteredCommands.map((command, index) => (
          <button
            key={command.id}
            ref={index === selectedIndex ? selectedRef : null}
            className={`command-overlay-item ${
              index === selectedIndex ? 'selected' : ''
            }`}
            onClick={() => selectCommand(command)}
            onMouseEnter={() => setSelectedIndex(index)}
          >
            <span className="command-overlay-icon">{command.icon}</span>
            <div className="command-overlay-info">
              <div className="command-overlay-label">{command.label}</div>
              <div className="command-overlay-description">
                {command.description}
              </div>
            </div>
            {command.aliases.length > 0 && (
              <div className="command-overlay-aliases">
                {command.aliases[0]}
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
```

### Step 5: Overlay Styles

```css
/* CommandOverlay.css */
.command-overlay {
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  width: 360px;
  max-height: 400px;
  overflow: hidden;
  z-index: 1000;
}

.command-overlay-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #f5f5f5;
  background-color: #fafafa;
}

.command-overlay-title {
  font-weight: 600;
  font-size: 13px;
  color: #424242;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.command-overlay-hint {
  font-size: 12px;
  color: #9e9e9e;
}

.command-overlay-list {
  max-height: 352px;
  overflow-y: auto;
}

.command-overlay-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border: none;
  background: white;
  width: 100%;
  cursor: pointer;
  transition: background-color 0.1s ease;
  text-align: left;
}

.command-overlay-item:hover,
.command-overlay-item.selected {
  background-color: #f5f5f5;
}

.command-overlay-item.selected {
  background-color: #e3f2fd;
}

.command-overlay-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background-color: #f5f5f5;
  border-radius: 6px;
  font-weight: 700;
  font-size: 16px;
  color: #616161;
  flex-shrink: 0;
}

.command-overlay-item.selected .command-overlay-icon {
  background-color: #2196f3;
  color: white;
}

.command-overlay-info {
  flex: 1;
  min-width: 0;
}

.command-overlay-label {
  font-weight: 500;
  font-size: 14px;
  color: #212121;
  margin-bottom: 2px;
}

.command-overlay-description {
  font-size: 12px;
  color: #757575;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.command-overlay-aliases {
  font-size: 11px;
  color: #9e9e9e;
  padding: 2px 6px;
  background-color: #fafafa;
  border-radius: 3px;
  font-family: monospace;
}

.command-overlay-empty {
  padding: 24px;
  text-align: center;
  color: #757575;
  font-size: 14px;
}

/* Scrollbar */
.command-overlay-list::-webkit-scrollbar {
  width: 6px;
}

.command-overlay-list::-webkit-scrollbar-track {
  background: transparent;
}

.command-overlay-list::-webkit-scrollbar-thumb {
  background: #e0e0e0;
  border-radius: 3px;
}

.command-overlay-list::-webkit-scrollbar-thumb:hover {
  background: #bdbdbd;
}
```

### Step 6: Editor Component

```tsx
// SlashCommandEditor.tsx
import { FC, useState, useRef } from 'react'
import { MarkedInput } from 'rc-marked-input'
import type { Option } from 'rc-marked-input'
import { CommandMark } from './CommandMark'
import { CommandOverlay } from './CommandOverlay'
import { COMMANDS } from './commands'
import type { CommandMarkProps, CommandType } from './types'
import './SlashCommandEditor.css'

export const SlashCommandEditor: FC = () => {
  const [value, setValue] = useState('')
  const editorRef = useRef<HTMLDivElement>(null)

  const handleChange = (newValue: string) => {
    // Check if a command was just inserted
    const commandMatch = newValue.match(/\/\[([^\]]+)\]\(([^\)]+)\)/)

    if (commandMatch) {
      const commandId = commandMatch[1] as CommandType
      const command = COMMANDS.find((cmd) => cmd.id === commandId)

      if (command) {
        // Remove the command mark from the text
        const beforeCommand = newValue.substring(0, commandMatch.index)
        const afterCommand = newValue.substring(
          commandMatch.index! + commandMatch[0].length
        )

        // Execute the command
        const editorContext = {
          insertText: (text: string) => {
            setValue(beforeCommand + text + afterCommand)
          },
          replaceSelection: (text: string) => {
            setValue(beforeCommand + text + afterCommand)
          },
          getCurrentLine: () => {
            const lines = beforeCommand.split('\n')
            return lines[lines.length - 1]
          }
        }

        command.execute(editorContext)
        return
      }
    }

    setValue(newValue)
  }

  const commandOption: Option<CommandMarkProps> = {
    markup: '/[__value__](__meta__)',
    slots: {
      mark: CommandMark,
      overlay: CommandOverlay
    },
    slotProps: {
      mark: ({ value, meta }) => ({
        command: value as CommandType,
        label: meta || value || ''
      })
    }
  }

  return (
    <div className="slash-command-editor-container">
      <h2>Slash Commands Demo</h2>
      <p className="hint">Type / to see available commands</p>

      <MarkedInput
        value={value}
        onChange={handleChange}
        Mark={CommandMark}
        options={[commandOption]}
        slotProps={{
          container: {
            ref: editorRef,
            className: 'slash-command-editor'
          }
        }}
      />

      <div className="keyboard-shortcuts">
        <h3>Keyboard Shortcuts</h3>
        <div className="shortcuts-grid">
          <div className="shortcut">
            <kbd>/</kbd>
            <span>Open command menu</span>
          </div>
          <div className="shortcut">
            <kbd>↑</kbd> <kbd>↓</kbd>
            <span>Navigate commands</span>
          </div>
          <div className="shortcut">
            <kbd>Enter</kbd>
            <span>Execute command</span>
          </div>
          <div className="shortcut">
            <kbd>Esc</kbd>
            <span>Close menu</span>
          </div>
        </div>
      </div>
    </div>
  )
}
```

### Step 7: Editor Styles

```css
/* SlashCommandEditor.css */
.slash-command-editor-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}

.slash-command-editor-container h2 {
  margin: 0 0 8px 0;
  font-size: 28px;
  color: #212121;
}

.hint {
  margin: 0 0 20px 0;
  color: #757575;
  font-size: 14px;
}

.slash-command-editor {
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 24px;
  min-height: 300px;
  font-size: 16px;
  line-height: 1.6;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  outline: none;
  transition: border-color 0.2s ease;
}

.slash-command-editor:focus {
  border-color: #2196f3;
}

.keyboard-shortcuts {
  margin-top: 32px;
  padding: 20px;
  background-color: #fafafa;
  border-radius: 8px;
}

.keyboard-shortcuts h3 {
  margin: 0 0 16px 0;
  font-size: 16px;
  color: #424242;
}

.shortcuts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
}

.shortcut {
  display: flex;
  align-items: center;
  gap: 12px;
}

.shortcut kbd {
  display: inline-block;
  padding: 4px 8px;
  background-color: white;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  font-family: monospace;
  font-size: 12px;
  font-weight: 600;
  color: #424242;
  min-width: 28px;
  text-align: center;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.shortcut span {
  font-size: 13px;
  color: #616161;
}
```

## Step-by-Step Explanation

### 1. Command System Architecture

```
User types "/"
  → Overlay shows all commands
  → User types "hea"
  → Filters to heading commands
  → User selects "Heading 1" (Enter or click)
  → Inserts /[heading1](Heading 1)
  → onChange detects command mark
  → Executes command.execute()
  → Replaces mark with "# "
  → User continues typing
```

### 2. Command Execution Flow

When a command is selected:
1. Mark is inserted: `/[heading1](Heading 1)`
2. `onChange` handler detects the pattern
3. Finds corresponding command from `COMMANDS`
4. Calls `command.execute(editorContext)`
5. Command transforms text (e.g., adds `# `)
6. Mark is removed, transformation remains

### 3. Search and Filtering

Commands are searchable by:
- Label ("Heading 1")
- Description ("Large section heading")
- Aliases (["h1", "title"])

### 4. Keyboard Navigation

Full keyboard support:
- `↑↓` - Navigate commands
- `Enter` / `Tab` - Execute selected command
- `Esc` - Close menu
- Auto-scroll selected item into view

## Variations

### Variation 1: Commands with Parameters

```tsx
interface ParameterizedCommand extends Command {
  parameters?: {
    name: string
    type: 'text' | 'number' | 'select'
    options?: string[]
  }[]
}

const linkCommand: ParameterizedCommand = {
  id: 'link',
  label: 'Link',
  description: 'Insert a hyperlink',
  icon: '🔗',
  aliases: ['url', 'anchor'],
  parameters: [
    { name: 'url', type: 'text' },
    { name: 'text', type: 'text' }
  ],
  execute: (ctx, params) => {
    const { url, text } = params
    ctx.insertText(`[${text}](${url})`)
  }
}
```

### Variation 2: Recent Commands

```tsx
const useRecentCommands = () => {
  const [recent, setRecent] = useState<string[]>([])

  const addRecentCommand = (commandId: string) => {
    setRecent((prev) => {
      const filtered = prev.filter((id) => id !== commandId)
      return [commandId, ...filtered].slice(0, 5)
    })
  }

  return { recent, addRecentCommand }
}

// Show recent commands first in overlay
const sortedCommands = [
  ...filteredCommands.filter((cmd) => recent.includes(cmd.id)),
  ...filteredCommands.filter((cmd) => !recent.includes(cmd.id))
]
```

### Variation 3: Command Categories

```tsx
interface CommandCategory {
  id: string
  label: string
  icon: string
  commands: Command[]
}

const CATEGORIES: CommandCategory[] = [
  {
    id: 'text',
    label: 'Text Formatting',
    icon: '✏️',
    commands: [/* heading commands */]
  },
  {
    id: 'lists',
    label: 'Lists',
    icon: '📋',
    commands: [/* list commands */]
  },
  {
    id: 'media',
    label: 'Media',
    icon: '🖼️',
    commands: [/* image, video commands */]
  }
]

// Render with categories
{CATEGORIES.map((category) => (
  <div key={category.id} className="command-category">
    <div className="command-category-header">
      <span>{category.icon}</span>
      <span>{category.label}</span>
    </div>
    {category.commands.map((cmd) => (
      <CommandItem key={cmd.id} command={cmd} />
    ))}
  </div>
))}
```

### Variation 4: Custom Command Registration

```tsx
const useCustomCommands = () => {
  const [customCommands, setCustomCommands] = useState<Command[]>([])

  const registerCommand = (command: Command) => {
    setCustomCommands((prev) => [...prev, command])
  }

  const allCommands = [...COMMANDS, ...customCommands]

  return { allCommands, registerCommand }
}

// Usage
const MyEditor: FC = () => {
  const { allCommands, registerCommand } = useCustomCommands()

  useEffect(() => {
    // Register custom command
    registerCommand({
      id: 'timestamp',
      label: 'Insert Timestamp',
      description: 'Insert current date and time',
      icon: '🕐',
      aliases: ['time', 'date', 'now'],
      execute: (ctx) => {
        const timestamp = new Date().toLocaleString()
        ctx.insertText(timestamp)
      }
    })
  }, [])

  return <SlashCommandEditor commands={allCommands} />
}
```

### Variation 5: AI-Powered Commands

```tsx
const aiCommands: Command[] = [
  {
    id: 'ai-continue',
    label: 'Continue Writing',
    description: 'Let AI continue your text',
    icon: '✨',
    aliases: ['ai', 'continue', 'complete'],
    execute: async (ctx) => {
      const currentText = ctx.getCurrentLine()
      const completion = await fetchAICompletion(currentText)
      ctx.insertText(completion)
    }
  },
  {
    id: 'ai-summarize',
    label: 'Summarize',
    description: 'Summarize selected text',
    icon: '📝',
    aliases: ['summary', 'tldr'],
    execute: async (ctx) => {
      const selection = ctx.getSelection()
      const summary = await fetchAISummary(selection)
      ctx.replaceSelection(summary)
    }
  }
]
```

## Mobile Optimization

```css
@media (max-width: 768px) {
  .command-overlay {
    width: calc(100vw - 32px);
    max-height: 60vh;
  }

  .command-overlay-header {
    padding: 10px 12px;
  }

  .command-overlay-hint {
    display: none; /* Hide on mobile */
  }

  .command-overlay-item {
    padding: 10px 12px;
  }

  .command-overlay-icon {
    width: 28px;
    height: 28px;
    font-size: 14px;
  }

  .command-overlay-label {
    font-size: 13px;
  }

  .command-overlay-description {
    font-size: 11px;
  }

  .command-overlay-aliases {
    display: none; /* Hide aliases on mobile */
  }
}
```

## Advanced Features

### Command History and Undo

```tsx
interface CommandHistory {
  commandId: string
  timestamp: number
  textBefore: string
  textAfter: string
}

const useCommandHistory = () => {
  const [history, setHistory] = useState<CommandHistory[]>([])

  const addToHistory = (entry: CommandHistory) => {
    setHistory((prev) => [...prev, entry].slice(-20)) // Keep last 20
  }

  const undo = () => {
    if (history.length === 0) return null

    const lastCommand = history[history.length - 1]
    setHistory((prev) => prev.slice(0, -1))
    return lastCommand.textBefore
  }

  return { history, addToHistory, undo }
}
```

### Command Shortcuts

```tsx
const COMMAND_SHORTCUTS: Record<string, string> = {
  'Mod-1': 'heading1',
  'Mod-2': 'heading2',
  'Mod-3': 'heading3',
  'Mod-Shift-7': 'bulletList',
  'Mod-Shift-8': 'numberedList'
}

const handleKeyDown = (e: React.KeyboardEvent) => {
  const mod = e.metaKey || e.ctrlKey
  const shift = e.shiftKey
  const key = e.key

  const shortcut = `${mod ? 'Mod-' : ''}${shift ? 'Shift-' : ''}${key}`
  const commandId = COMMAND_SHORTCUTS[shortcut]

  if (commandId) {
    e.preventDefault()
    const command = COMMANDS.find((cmd) => cmd.id === commandId)
    if (command) {
      command.execute(editorContext)
    }
  }
}
```

**Try it live:** [CodeSandbox - Slash Commands](https://codesandbox.io/s/slash-commands-example)

**Source code:** [GitHub - Complete Example](https://github.com/Nowely/marked-input/tree/main/examples/slash-commands)
