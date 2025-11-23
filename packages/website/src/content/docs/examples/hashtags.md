---
title: Hashtags
description: Twitter/Instagram hashtag system tutorial - trending topics, autocomplete, click tracking, usage analytics
keywords: [hashtags, trending topics, social media, autocomplete, tagging, analytics]
---

This example demonstrates how to build a hashtag system like Twitter, Instagram, or LinkedIn with trending topics, autocomplete, and click tracking.

## Use Case

**What we're building:**
- Type `#` to create hashtags
- Autocomplete with trending hashtags
- Click to filter by hashtag
- Track hashtag usage
- Trending hashtags sidebar

**Where to use it:**
- Social media platforms
- Blog tagging systems
- Content categorization
- Search and filtering
- Analytics dashboards

## Complete Implementation

### Step 1: Define Types

```tsx
// types.ts
export interface Hashtag {
  tag: string
  count: number
  trend: 'up' | 'down' | 'stable'
}

export interface HashtagMarkProps {
  tag: string
  count?: number
  onClick: (tag: string) => void
}
```

### Step 2: Hashtag Mark Component

```tsx
// HashtagMark.tsx
import { FC } from 'react'
import type { HashtagMarkProps } from './types'
import './HashtagMark.css'

export const HashtagMark: FC<HashtagMarkProps> = ({ tag, count, onClick }) => {
  return (
    <button
      className="hashtag"
      onClick={() => onClick(tag)}
      aria-label={`Hashtag ${tag}${count ? `, ${count} posts` : ''}`}
    >
      #{tag}
      {count !== undefined && count > 0 && (
        <span className="hashtag-count">{count}</span>
      )}
    </button>
  )
}
```

```css
/* HashtagMark.css */
.hashtag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  background-color: #e8f5e9;
  border: 1px solid #81c784;
  border-radius: 12px;
  color: #2e7d32;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
  text-decoration: none;
}

.hashtag:hover {
  background-color: #c8e6c9;
  border-color: #66bb6a;
  transform: translateY(-1px);
}

.hashtag:active {
  transform: translateY(0);
}

.hashtag-count {
  font-size: 11px;
  padding: 2px 4px;
  background-color: rgba(46, 125, 50, 0.1);
  border-radius: 6px;
  font-weight: 500;
}
```

### Step 3: Hashtag Overlay

```tsx
// HashtagOverlay.tsx
import { FC, useState, useEffect } from 'react'
import { useOverlay } from 'rc-marked-input'
import type { Hashtag } from './types'
import './HashtagOverlay.css'

interface HashtagOverlayProps {
  trending: Hashtag[]
  onSelect?: (tag: string) => void
}

export const HashtagOverlay: FC<HashtagOverlayProps> = ({
  trending,
  onSelect
}) => {
  const { style, match, select, close, ref } = useOverlay()
  const [selectedIndex, setSelectedIndex] = useState(0)

  const filteredHashtags = trending.filter((hashtag) =>
    hashtag.tag.toLowerCase().includes(match.value.toLowerCase())
  )

  useEffect(() => {
    setSelectedIndex(0)
  }, [match.value])

  const selectHashtag = (hashtag: Hashtag) => {
    select({
      value: hashtag.tag,
      meta: hashtag.count.toString()
    })
    onSelect?.(hashtag.tag)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex((prev) =>
          Math.min(prev + 1, filteredHashtags.length - 1)
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex((prev) => Math.max(prev - 1, 0))
        break
      case 'Enter':
      case 'Tab':
        e.preventDefault()
        if (filteredHashtags[selectedIndex]) {
          selectHashtag(filteredHashtags[selectedIndex])
        }
        break
      case 'Escape':
        e.preventDefault()
        close()
        break
    }
  }

  if (filteredHashtags.length === 0) {
    return (
      <div
        ref={ref}
        className="hashtag-overlay"
        style={{ position: 'absolute', left: style.left, top: style.top }}
      >
        <div className="hashtag-overlay-empty">
          No hashtags found. Create #{match.value}?
        </div>
      </div>
    )
  }

  return (
    <div
      ref={ref}
      className="hashtag-overlay"
      style={{ position: 'absolute', left: style.left, top: style.top }}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      <div className="hashtag-overlay-header">Trending Hashtags</div>
      {filteredHashtags.map((hashtag, index) => (
        <button
          key={hashtag.tag}
          className={`hashtag-overlay-item ${
            index === selectedIndex ? 'selected' : ''
          }`}
          onClick={() => selectHashtag(hashtag)}
          onMouseEnter={() => setSelectedIndex(index)}
        >
          <div className="hashtag-overlay-tag">#{hashtag.tag}</div>
          <div className="hashtag-overlay-meta">
            <span className="hashtag-overlay-count">
              {hashtag.count.toLocaleString()} posts
            </span>
            <span className={`hashtag-overlay-trend trend-${hashtag.trend}`}>
              {hashtag.trend === 'up' ? '↑' : hashtag.trend === 'down' ? '↓' : '→'}
            </span>
          </div>
        </button>
      ))}
    </div>
  )
}
```

```css
/* HashtagOverlay.css */
.hashtag-overlay {
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  min-width: 280px;
  max-height: 320px;
  overflow-y: auto;
  z-index: 1000;
}

.hashtag-overlay-header {
  padding: 12px 16px;
  border-bottom: 1px solid #f5f5f5;
  font-weight: 600;
  font-size: 13px;
  color: #616161;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.hashtag-overlay-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border: none;
  background: white;
  width: 100%;
  cursor: pointer;
  transition: background-color 0.15s ease;
  text-align: left;
}

.hashtag-overlay-item:hover,
.hashtag-overlay-item.selected {
  background-color: #f5f5f5;
}

.hashtag-overlay-item.selected {
  background-color: #e8f5e9;
}

.hashtag-overlay-tag {
  font-weight: 600;
  font-size: 14px;
  color: #2e7d32;
}

.hashtag-overlay-meta {
  display: flex;
  align-items: center;
  gap: 8px;
}

.hashtag-overlay-count {
  font-size: 12px;
  color: #757575;
}

.hashtag-overlay-trend {
  font-size: 14px;
  font-weight: 700;
}

.trend-up {
  color: #4caf50;
}

.trend-down {
  color: #f44336;
}

.trend-stable {
  color: #9e9e9e;
}

.hashtag-overlay-empty {
  padding: 16px;
  text-align: center;
  color: #757575;
  font-size: 14px;
}
```

### Step 4: Trending Sidebar

```tsx
// TrendingSidebar.tsx
import { FC } from 'react'
import type { Hashtag } from './types'
import './TrendingSidebar.css'

interface TrendingSidebarProps {
  hashtags: Hashtag[]
  onHashtagClick: (tag: string) => void
}

export const TrendingSidebar: FC<TrendingSidebarProps> = ({
  hashtags,
  onHashtagClick
}) => {
  const topTrending = hashtags
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  return (
    <aside className="trending-sidebar">
      <h3>Trending Now</h3>
      <div className="trending-list">
        {topTrending.map((hashtag, index) => (
          <button
            key={hashtag.tag}
            className="trending-item"
            onClick={() => onHashtagClick(hashtag.tag)}
          >
            <span className="trending-rank">{index + 1}</span>
            <div className="trending-info">
              <div className="trending-tag">#{hashtag.tag}</div>
              <div className="trending-count">
                {hashtag.count.toLocaleString()} posts
              </div>
            </div>
            <span className={`trending-icon trend-${hashtag.trend}`}>
              {hashtag.trend === 'up' ? '↑' : hashtag.trend === 'down' ? '↓' : '→'}
            </span>
          </button>
        ))}
      </div>
    </aside>
  )
}
```

```css
/* TrendingSidebar.css */
.trending-sidebar {
  width: 320px;
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 12px;
  padding: 20px;
}

.trending-sidebar h3 {
  margin: 0 0 16px 0;
  font-size: 20px;
  color: #212121;
}

.trending-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.trending-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: white;
  border: 1px solid transparent;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;
  width: 100%;
}

.trending-item:hover {
  background-color: #f5f5f5;
  border-color: #e0e0e0;
}

.trending-rank {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background-color: #f5f5f5;
  border-radius: 4px;
  font-weight: 700;
  font-size: 12px;
  color: #616161;
  flex-shrink: 0;
}

.trending-info {
  flex: 1;
  min-width: 0;
}

.trending-tag {
  font-weight: 600;
  font-size: 14px;
  color: #2e7d32;
  margin-bottom: 2px;
}

.trending-count {
  font-size: 12px;
  color: #757575;
}

.trending-icon {
  font-size: 16px;
  font-weight: 700;
}
```

### Step 5: Complete Editor

```tsx
// HashtagEditor.tsx
import { FC, useState, useCallback } from 'react'
import { MarkedInput } from 'rc-marked-input'
import type { Option } from 'rc-marked-input'
import { HashtagMark } from './HashtagMark'
import { HashtagOverlay } from './HashtagOverlay'
import { TrendingSidebar } from './TrendingSidebar'
import type { Hashtag, HashtagMarkProps } from './types'
import './HashtagEditor.css'

const TRENDING_HASHTAGS: Hashtag[] = [
  { tag: 'react', count: 125340, trend: 'up' },
  { tag: 'javascript', count: 98720, trend: 'stable' },
  { tag: 'typescript', count: 87650, trend: 'up' },
  { tag: 'webdev', count: 76420, trend: 'down' },
  { tag: 'programming', count: 65200, trend: 'stable' },
  { tag: 'coding', count: 54890, trend: 'up' },
  { tag: 'frontend', count: 43210, trend: 'stable' },
  { tag: 'backend', count: 38900, trend: 'up' },
  { tag: 'fullstack', count: 32450, trend: 'down' },
  { tag: 'nodejs', count: 28700, trend: 'stable' }
]

export const HashtagEditor: FC = () => {
  const [value, setValue] = useState('')
  const [selectedHashtag, setSelectedHashtag] = useState<string | null>(null)
  const [hashtagCounts, setHashtagCounts] = useState<Record<string, number>>({})

  const handleHashtagClick = useCallback((tag: string) => {
    console.log('Hashtag clicked:', tag)
    setSelectedHashtag(tag)
    // Filter posts by hashtag, navigate, etc.
  }, [])

  const handleHashtagSelect = useCallback((tag: string) => {
    setHashtagCounts((prev) => ({
      ...prev,
      [tag]: (prev[tag] || 0) + 1
    }))
  }, [])

  const hashtagOption: Option<HashtagMarkProps> = {
    markup: '#[__value__](__meta__)',
    slots: {
      mark: HashtagMark,
      overlay: () => (
        <HashtagOverlay
          trending={TRENDING_HASHTAGS}
          onSelect={handleHashtagSelect}
        />
      )
    },
    slotProps: {
      mark: ({ value, meta }) => ({
        tag: value || '',
        count: meta ? parseInt(meta) : undefined,
        onClick: handleHashtagClick
      })
    }
  }

  return (
    <div className="hashtag-editor-layout">
      <main className="hashtag-editor-main">
        <h2>Hashtag System Demo</h2>
        <p className="hint">Type # to add hashtags</p>

        <MarkedInput
          value={value}
          onChange={setValue}
          Mark={HashtagMark}
          options={[hashtagOption]}
          slotProps={{
            container: {
              className: 'hashtag-editor',
              placeholder: 'What are you working on? Use #hashtags...'
            }
          }}
        />

        {selectedHashtag && (
          <div className="selected-hashtag-info">
            <strong>Filtered by:</strong> #{selectedHashtag}
            <button onClick={() => setSelectedHashtag(null)}>Clear</button>
          </div>
        )}
      </main>

      <TrendingSidebar
        hashtags={TRENDING_HASHTAGS}
        onHashtagClick={handleHashtagClick}
      />
    </div>
  )
}
```

```css
/* HashtagEditor.css */
.hashtag-editor-layout {
  display: flex;
  gap: 24px;
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.hashtag-editor-main {
  flex: 1;
  min-width: 0;
}

.hashtag-editor-main h2 {
  margin: 0 0 8px 0;
  font-size: 24px;
  color: #212121;
}

.hint {
  margin: 0 0 16px 0;
  color: #757575;
  font-size: 14px;
}

.hashtag-editor {
  border: 2px solid #e0e0e0;
  border-radius: 12px;
  padding: 16px;
  min-height: 150px;
  font-size: 16px;
  line-height: 1.6;
  outline: none;
  transition: border-color 0.2s ease;
}

.hashtag-editor:focus {
  border-color: #4caf50;
}

.hashtag-editor:empty::before {
  content: attr(placeholder);
  color: #bdbdbd;
  pointer-events: none;
}

.selected-hashtag-info {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 16px;
  padding: 12px;
  background-color: #e8f5e9;
  border-radius: 8px;
  color: #2e7d32;
}

.selected-hashtag-info button {
  margin-left: auto;
  padding: 4px 12px;
  background: white;
  border: 1px solid #81c784;
  border-radius: 4px;
  color: #2e7d32;
  cursor: pointer;
  font-size: 13px;
}

@media (max-width: 1024px) {
  .hashtag-editor-layout {
    flex-direction: column;
  }

  .trending-sidebar {
    width: 100%;
  }
}
```

## Variations

### Variation 1: Hashtag Analytics

```tsx
const HashtagAnalytics: FC = () => {
  const [analytics, setAnalytics] = useState({
    totalHashtags: 0,
    uniqueHashtags: 0,
    topHashtag: '',
    avgPerPost: 0
  })

  const analyzeHashtags = (text: string) => {
    const matches = text.match(/#\[([^\]]+)\]/g) || []
    const hashtags = matches.map((m) => m.match(/#\[([^\]]+)\]/)?.[1])
    const unique = new Set(hashtags)

    setAnalytics({
      totalHashtags: hashtags.length,
      uniqueHashtags: unique.size,
      topHashtag: getMostUsed(hashtags),
      avgPerPost: hashtags.length / getPostCount()
    })
  }

  return (
    <div className="hashtag-analytics">
      <div className="stat">
        <div className="stat-value">{analytics.totalHashtags}</div>
        <div className="stat-label">Total Hashtags</div>
      </div>
      {/* More stats... */}
    </div>
  )
}
```

### Variation 2: Hashtag Groups/Categories

```tsx
interface HashtagCategory {
  name: string
  hashtags: string[]
  color: string
}

const categories: HashtagCategory[] = [
  {
    name: 'Technology',
    hashtags: ['react', 'javascript', 'typescript'],
    color: '#2196f3'
  },
  {
    name: 'Design',
    hashtags: ['ui', 'ux', 'figma'],
    color: '#9c27b0'
  }
]

const CategorizedHashtagMark: FC<HashtagMarkProps> = ({ tag }) => {
  const category = categories.find((c) =>
    c.hashtags.includes(tag.toLowerCase())
  )

  return (
    <span
      className="hashtag"
      style={{
        backgroundColor: category?.color || '#e0e0e0',
        color: 'white'
      }}
    >
      #{tag}
    </span>
  )
}
```

### Variation 3: Related Hashtags

```tsx
const RelatedHashtags: FC<{ currentTag: string }> = ({ currentTag }) => {
  const [related, setRelated] = useState<string[]>([])

  useEffect(() => {
    fetch(`/api/hashtags/${currentTag}/related`)
      .then((res) => res.json())
      .then(setRelated)
  }, [currentTag])

  return (
    <div className="related-hashtags">
      <h4>Related to #{currentTag}</h4>
      {related.map((tag) => (
        <button key={tag} className="related-tag">
          #{tag}
        </button>
      ))}
    </div>
  )
}
```

**Try it live:** [CodeSandbox - Hashtags](https://codesandbox.io/s/hashtags-example)
