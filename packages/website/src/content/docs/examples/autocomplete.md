---
title: Autocomplete System
description: Build advanced autocomplete with fuzzy search, categories, and recent items
version: 1.0.0
---

This example demonstrates how to build a comprehensive autocomplete system with fuzzy matching, categories, keyboard navigation, and recent selections.

## Use Case

**What we're building:**
- Multi-source autocomplete (users, emojis, variables)
- Fuzzy search matching
- Categorized suggestions
- Recent selections history
- Configurable triggers
- Loading states

**Where to use it:**
- IDE autocomplete
- Email composers (Gmail, Outlook)
- Command palettes
- Search interfaces
- Template editors

## Complete Implementation

### Step 1: Define Types

```tsx
// types.ts
export interface AutocompleteItem {
  id: string
  label: string
  value: string
  category: string
  icon?: string
  description?: string
  meta?: any
}

export interface AutocompleteSource {
  trigger: string
  category: string
  items: AutocompleteItem[]
  fuzzy?: boolean
  async?: boolean
  fetchItems?: (query: string) => Promise<AutocompleteItem[]>
}
```

### Step 2: Fuzzy Search Utility

```tsx
// fuzzySearch.ts
export function fuzzyMatch(query: string, text: string): boolean {
  const pattern = query.toLowerCase().split('').join('.*')
  const regex = new RegExp(pattern)
  return regex.test(text.toLowerCase())
}

export function fuzzyScore(query: string, text: string): number {
  if (text.toLowerCase().startsWith(query.toLowerCase())) {
    return 100 // Exact prefix match gets highest score
  }

  let score = 0
  let queryIndex = 0
  const lowerQuery = query.toLowerCase()
  const lowerText = text.toLowerCase()

  for (let i = 0; i < lowerText.length && queryIndex < lowerQuery.length; i++) {
    if (lowerText[i] === lowerQuery[queryIndex]) {
      score += 10
      queryIndex++
    }
  }

  return queryIndex === lowerQuery.length ? score : 0
}

export function fuzzyFilter(
  items: AutocompleteItem[],
  query: string
): AutocompleteItem[] {
  if (!query) return items

  return items
    .map((item) => ({
      item,
      score: Math.max(
        fuzzyScore(query, item.label),
        fuzzyScore(query, item.value)
      )
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ item }) => item)
}
```

### Step 3: Autocomplete Mark

```tsx
// AutocompleteMark.tsx
import { FC } from 'react'
import './AutocompleteMark.css'

interface AutocompleteMarkProps {
  value: string
  category: string
  icon?: string
}

export const AutocompleteMark: FC<AutocompleteMarkProps> = ({
  value,
  category,
  icon
}) => {
  return (
    <span className={`autocomplete-mark category-${category}`}>
      {icon && <span className="mark-icon">{icon}</span>}
      <span className="mark-value">{value}</span>
    </span>
  )
}
```

```css
/* AutocompleteMark.css */
.autocomplete-mark {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 8px;
  font-weight: 500;
  font-size: 14px;
  vertical-align: middle;
}

.category-user {
  background-color: #e3f2fd;
  color: #1976d2;
  border: 1px solid #90caf9;
}

.category-emoji {
  background-color: #fff9c4;
  color: #f57f17;
  border: 1px solid #fff176;
}

.category-variable {
  background-color: #f3e5f5;
  color: #7b1fa2;
  border: 1px solid #ce93d8;
}

.mark-icon {
  font-size: 16px;
}

.mark-value {
  line-height: 1;
}
```

### Step 4: Advanced Overlay

```tsx
// AdvancedAutocompleteOverlay.tsx
import { FC, useState, useEffect, useMemo, useRef } from 'react'
import { useOverlay } from 'rc-marked-input'
import { fuzzyFilter } from './fuzzySearch'
import type { AutocompleteItem, AutocompleteSource } from './types'
import './AdvancedAutocompleteOverlay.css'

interface Props {
  sources: AutocompleteSource[]
  recentItems?: AutocompleteItem[]
  onSelect?: (item: AutocompleteItem) => void
}

export const AdvancedAutocompleteOverlay: FC<Props> = ({
  sources,
  recentItems = [],
  onSelect
}) => {
  const { style, match, select, close, ref } = useOverlay()
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [loading, setLoading] = useState(false)
  const [asyncItems, setAsyncItems] = useState<AutocompleteItem[]>([])
  const selectedRef = useRef<HTMLButtonElement>(null)

  // Find active source based on trigger
  const activeSource = sources.find((s) => match.trigger === s.trigger)

  // Get all items
  const allItems = useMemo(() => {
    if (!activeSource) return []

    let items = activeSource.async ? asyncItems : activeSource.items

    // Add recent items at the top if query is empty
    if (!match.value && recentItems.length > 0) {
      const recentForCategory = recentItems.filter(
        (item) => item.category === activeSource.category
      )
      items = [...recentForCategory, ...items]
    }

    // Apply fuzzy filtering
    if (activeSource.fuzzy && match.value) {
      return fuzzyFilter(items, match.value)
    }

    // Simple filtering
    return items.filter((item) =>
      item.label.toLowerCase().includes(match.value.toLowerCase())
    )
  }, [activeSource, asyncItems, recentItems, match.value])

  // Fetch async items
  useEffect(() => {
    if (activeSource?.async && activeSource.fetchItems) {
      setLoading(true)
      activeSource
        .fetchItems(match.value)
        .then(setAsyncItems)
        .finally(() => setLoading(false))
    }
  }, [activeSource, match.value])

  // Reset selection on results change
  useEffect(() => {
    setSelectedIndex(0)
  }, [allItems.length])

  // Scroll selected into view
  useEffect(() => {
    selectedRef.current?.scrollIntoView({
      block: 'nearest',
      behavior: 'smooth'
    })
  }, [selectedIndex])

  const selectItem = (item: AutocompleteItem) => {
    select({
      value: item.value,
      meta: `${item.category}|${item.icon || ''}`
    })
    onSelect?.(item)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex((prev) => Math.min(prev + 1, allItems.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex((prev) => Math.max(prev - 1, 0))
        break
      case 'Enter':
      case 'Tab':
        e.preventDefault()
        if (allItems[selectedIndex]) {
          selectItem(allItems[selectedIndex])
        }
        break
      case 'Escape':
        e.preventDefault()
        close()
        break
    }
  }

  if (!activeSource) return null

  if (loading) {
    return (
      <div
        ref={ref}
        className="autocomplete-overlay"
        style={{ position: 'absolute', left: style.left, top: style.top }}
      >
        <div className="autocomplete-loading">
          <div className="spinner"></div>
          <span>Loading...</span>
        </div>
      </div>
    )
  }

  if (allItems.length === 0) {
    return (
      <div
        ref={ref}
        className="autocomplete-overlay"
        style={{ position: 'absolute', left: style.left, top: style.top }}
      >
        <div className="autocomplete-empty">
          No results for "{match.value}"
        </div>
      </div>
    )
  }

  // Group items by category
  const itemsByCategory = allItems.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = []
    acc[item.category].push(item)
    return acc
  }, {} as Record<string, AutocompleteItem[]>)

  let globalIndex = 0

  return (
    <div
      ref={ref}
      className="autocomplete-overlay"
      style={{ position: 'absolute', left: style.left, top: style.top }}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      <div className="autocomplete-header">
        <span className="autocomplete-title">{activeSource.category}</span>
        <span className="autocomplete-count">
          {allItems.length} {allItems.length === 1 ? 'result' : 'results'}
        </span>
      </div>

      <div className="autocomplete-list">
        {Object.entries(itemsByCategory).map(([category, items]) => (
          <div key={category} className="autocomplete-category">
            {Object.keys(itemsByCategory).length > 1 && (
              <div className="category-header">{category}</div>
            )}
            {items.map((item) => {
              const index = globalIndex++
              const isSelected = index === selectedIndex

              return (
                <button
                  key={item.id}
                  ref={isSelected ? selectedRef : null}
                  className={`autocomplete-item ${isSelected ? 'selected' : ''}`}
                  onClick={() => selectItem(item)}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  {item.icon && <span className="item-icon">{item.icon}</span>}
                  <div className="item-info">
                    <div className="item-label">{item.label}</div>
                    {item.description && (
                      <div className="item-description">{item.description}</div>
                    )}
                  </div>
                  {index < 9 && (
                    <kbd className="item-shortcut">{index + 1}</kbd>
                  )}
                </button>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
```

```css
/* AdvancedAutocompleteOverlay.css */
.autocomplete-overlay {
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  width: 400px;
  max-height: 400px;
  overflow: hidden;
  z-index: 1000;
}

.autocomplete-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #f5f5f5;
  background-color: #fafafa;
}

.autocomplete-title {
  font-weight: 600;
  font-size: 13px;
  color: #424242;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.autocomplete-count {
  font-size: 12px;
  color: #9e9e9e;
}

.autocomplete-list {
  max-height: 340px;
  overflow-y: auto;
}

.autocomplete-category {
  margin: 8px 0;
}

.category-header {
  padding: 8px 16px 4px;
  font-size: 11px;
  font-weight: 600;
  color: #757575;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.autocomplete-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  border: none;
  background: white;
  width: 100%;
  cursor: pointer;
  transition: background-color 0.1s ease;
  text-align: left;
}

.autocomplete-item:hover,
.autocomplete-item.selected {
  background-color: #f5f5f5;
}

.autocomplete-item.selected {
  background-color: #e3f2fd;
}

.item-icon {
  font-size: 20px;
  flex-shrink: 0;
}

.item-info {
  flex: 1;
  min-width: 0;
}

.item-label {
  font-weight: 500;
  font-size: 14px;
  color: #212121;
  margin-bottom: 2px;
}

.item-description {
  font-size: 12px;
  color: #757575;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-shortcut {
  display: inline-block;
  padding: 2px 6px;
  background-color: #f5f5f5;
  border: 1px solid #e0e0e0;
  border-radius: 3px;
  font-size: 11px;
  font-weight: 600;
  color: #757575;
  min-width: 20px;
  text-align: center;
}

.autocomplete-loading,
.autocomplete-empty {
  padding: 24px;
  text-align: center;
  color: #757575;
  font-size: 14px;
}

.autocomplete-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

.spinner {
  width: 20px;
  height: 20px;
  border: 2px solid #e0e0e0;
  border-top-color: #2196f3;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
```

### Step 5: Complete Editor

```tsx
// AutocompleteEditor.tsx
import { FC, useState, useCallback } from 'react'
import { MarkedInput } from 'rc-marked-input'
import { AutocompleteMark } from './AutocompleteMark'
import { AdvancedAutocompleteOverlay } from './AdvancedAutocompleteOverlay'
import type { AutocompleteSource, AutocompleteItem } from './types'
import './AutocompleteEditor.css'

const AUTOCOMPLETE_SOURCES: AutocompleteSource[] = [
  {
    trigger: '@',
    category: 'Users',
    fuzzy: true,
    items: [
      { id: '1', label: 'Alice Johnson', value: 'alice', category: 'user', icon: '👤' },
      { id: '2', label: 'Bob Smith', value: 'bob', category: 'user', icon: '👤' },
      { id: '3', label: 'Charlie Brown', value: 'charlie', category: 'user', icon: '👤' }
    ]
  },
  {
    trigger: ':',
    category: 'Emojis',
    fuzzy: true,
    items: [
      { id: 'smile', label: 'smile', value: '😊', category: 'emoji', icon: '😊' },
      { id: 'heart', label: 'heart', value: '❤️', category: 'emoji', icon: '❤️' },
      { id: 'fire', label: 'fire', value: '🔥', category: 'emoji', icon: '🔥' },
      { id: 'rocket', label: 'rocket', value: '🚀', category: 'emoji', icon: '🚀' },
      { id: 'star', label: 'star', value: '⭐', category: 'emoji', icon: '⭐' }
    ]
  },
  {
    trigger: '{',
    category: 'Variables',
    items: [
      { id: 'name', label: 'User Name', value: 'user.name', category: 'variable', icon: '📝', description: 'Current user name' },
      { id: 'email', label: 'User Email', value: 'user.email', category: 'variable', icon: '📧', description: 'Current user email' },
      { id: 'date', label: 'Current Date', value: 'date.now', category: 'variable', icon: '📅', description: 'Today\'s date' }
    ]
  }
]

export const AutocompleteEditor: FC = () => {
  const [value, setValue] = useState('')
  const [recentItems, setRecentItems] = useState<AutocompleteItem[]>([])

  const handleSelect = useCallback((item: AutocompleteItem) => {
    setRecentItems((prev) => {
      const filtered = prev.filter((i) => i.id !== item.id)
      return [item, ...filtered].slice(0, 5) // Keep last 5
    })
  }, [])

  const autocompleteOptions = AUTOCOMPLETE_SOURCES.map((source) => ({
    markup: `${source.trigger}[__value__](__meta__)`,
    slots: {
      mark: AutocompleteMark,
      overlay: () => (
        <AdvancedAutocompleteOverlay
          sources={AUTOCOMPLETE_SOURCES}
          recentItems={recentItems}
          onSelect={handleSelect}
        />
      )
    },
    slotProps: {
      mark: ({ value, meta }: any) => {
        const [category = '', icon = ''] = (meta || '').split('|')
        return { value, category, icon }
      }
    }
  }))

  return (
    <div className="autocomplete-editor-container">
      <h2>Advanced Autocomplete Demo</h2>
      <div className="triggers-info">
        <span className="trigger-badge">@ Users</span>
        <span className="trigger-badge">: Emojis</span>
        <span className="trigger-badge">{'{ Variables'}</span>
      </div>

      <MarkedInput
        value={value}
        onChange={setValue}
        Mark={AutocompleteMark}
        options={autocompleteOptions}
        slotProps={{
          container: {
            className: 'autocomplete-editor',
            placeholder: 'Try @, :, or { to trigger autocomplete...'
          }
        }}
      />

      {recentItems.length > 0 && (
        <div className="recent-items">
          <h4>Recent Selections</h4>
          <div className="recent-list">
            {recentItems.map((item) => (
              <span key={item.id} className="recent-item">
                {item.icon} {item.label}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
```

```css
/* AutocompleteEditor.css */
.autocomplete-editor-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}

.autocomplete-editor-container h2 {
  margin: 0 0 12px 0;
  font-size: 24px;
  color: #212121;
}

.triggers-info {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.trigger-badge {
  padding: 4px 12px;
  background-color: #f5f5f5;
  border: 1px solid #e0e0e0;
  border-radius: 12px;
  font-size: 13px;
  color: #616161;
  font-family: monospace;
}

.autocomplete-editor {
  border: 2px solid #e0e0e0;
  border-radius: 12px;
  padding: 16px;
  min-height: 200px;
  font-size: 16px;
  line-height: 1.6;
  outline: none;
  transition: border-color 0.2s ease;
}

.autocomplete-editor:focus {
  border-color: #2196f3;
}

.autocomplete-editor:empty::before {
  content: attr(placeholder);
  color: #bdbdbd;
  pointer-events: none;
}

.recent-items {
  margin-top: 24px;
  padding: 16px;
  background-color: #fafafa;
  border-radius: 8px;
}

.recent-items h4 {
  margin: 0 0 12px 0;
  font-size: 14px;
  color: #616161;
}

.recent-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.recent-item {
  padding: 6px 12px;
  background-color: white;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  font-size: 13px;
  color: #424242;
}
```

**Try it live:** [CodeSandbox - Autocomplete](https://codesandbox.io/s/autocomplete-example)
