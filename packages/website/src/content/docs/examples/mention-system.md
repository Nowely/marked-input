---
title: 🚧 Mention System
description: Twitter/Slack @mention system tutorial - autocomplete, user avatars, clickable marks, backend integration, mobile optimization
keywords: [mentions, social media, chat, autocomplete, avatars, user tagging, backend integration]
---

This example demonstrates how to build a complete mention system with autocomplete, user avatars, and clickable mentions. Perfect for social media apps, chat applications, and collaborative tools.

## Contents

- [Use Case](#use-case) - What we're building and where to use it
- [Complete Implementation](#complete-implementation) - Step-by-step code walkthrough
- [Step-by-Step Explanation](#step-by-step-explanation) - Detailed explanation of each part
- [Variations](#variations) - Different implementation approaches
- [Mobile Optimization](#mobile-optimization) - Making it work on mobile devices
- [Integration with Backend](#integration-with-backend) - Server-side integration
- [Next Steps](#next-steps) - Further learning resources

## Use Case

**What we're building:**

- Type `@` to trigger user suggestions
- Autocomplete with user search
- Clickable mentions that link to profiles
- User avatars and display names
- Keyboard navigation
- Mobile-friendly design

**Where to use it:**

- Social media posts (Twitter, LinkedIn)
- Chat applications (Slack, Discord)
- Comments sections
- Collaborative documents
- Task management tools

## Complete Implementation

### Step 1: Define Types

```tsx
// types.ts
export interface User {
    id: string
    username: string
    displayName: string
    avatar: string
}

export interface MentionProps {
    username: string
    userId: string
    displayName: string
    avatar: string
    onMentionClick: (userId: string) => void
}
```

### Step 2: Create the Mention Component

```tsx
// MentionMark.tsx
import {FC} from 'react'
import type {MentionProps} from './types'
import './MentionMark.css'

export const MentionMark: FC<MentionProps> = ({username, userId, displayName, avatar, onMentionClick}) => {
    const handleClick = (e: React.MouseEvent) => {
        e.preventDefault()
        onMentionClick(userId)
    }

    return (
        <button className="mention" onClick={handleClick} aria-label={`Mention ${displayName}`} data-user-id={userId}>
            <img src={avatar} alt={displayName} className="mention-avatar" />
            <span className="mention-username">@{username}</span>
        </button>
    )
}
```

### Step 3: Style the Mention

```css
/* MentionMark.css */
.mention {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px 2px 4px;
    background-color: #e3f2fd;
    border: 1px solid #90caf9;
    border-radius: 16px;
    color: #1976d2;
    font-weight: 500;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.2s ease;
    text-decoration: none;
    vertical-align: middle;
}

.mention:hover {
    background-color: #bbdefb;
    border-color: #64b5f6;
    transform: translateY(-1px);
}

.mention:active {
    transform: translateY(0);
}

.mention:focus {
    outline: 2px solid #2196f3;
    outline-offset: 2px;
}

.mention-avatar {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    object-fit: cover;
}

.mention-username {
    line-height: 1;
}
```

### Step 4: Create Custom Suggestions Overlay

```tsx
// MentionOverlay.tsx
import {FC, useState, useEffect} from 'react'
import {useOverlay} from '@markput/react'
import type {User} from './types'
import './MentionOverlay.css'

interface MentionOverlayProps {
    users: User[]
}

export const MentionOverlay: FC<MentionOverlayProps> = ({users}) => {
    const {style, match, select, close, ref} = useOverlay()
    const [selectedIndex, setSelectedIndex] = useState(0)

    // Filter users based on typed text
    const filteredUsers = users.filter(
        user =>
            user.username.toLowerCase().includes(match.value.toLowerCase()) ||
            user.displayName.toLowerCase().includes(match.value.toLowerCase())
    )

    // Reset selection when filtered list changes
    useEffect(() => {
        setSelectedIndex(0)
    }, [match.value])

    // Keyboard navigation
    const handleKeyDown = (e: React.KeyboardEvent) => {
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault()
                setSelectedIndex(prev => Math.min(prev + 1, filteredUsers.length - 1))
                break

            case 'ArrowUp':
                e.preventDefault()
                setSelectedIndex(prev => Math.max(prev - 1, 0))
                break

            case 'Enter':
            case 'Tab':
                e.preventDefault()
                if (filteredUsers[selectedIndex]) {
                    selectUser(filteredUsers[selectedIndex])
                }
                break

            case 'Escape':
                e.preventDefault()
                close()
                break
        }
    }

    const selectUser = (user: User) => {
        select({
            value: user.username,
            meta: `${user.userId}|${user.displayName}|${user.avatar}`,
        })
    }

    if (filteredUsers.length === 0) {
        return (
            <div
                ref={ref}
                className="mention-overlay"
                style={{
                    position: 'absolute',
                    left: style.left,
                    top: style.top,
                }}
            >
                <div className="mention-overlay-empty">No users found for "{match.value}"</div>
            </div>
        )
    }

    return (
        <div
            ref={ref}
            className="mention-overlay"
            style={{
                position: 'absolute',
                left: style.left,
                top: style.top,
            }}
            onKeyDown={handleKeyDown}
            tabIndex={-1}
        >
            {filteredUsers.map((user, index) => (
                <button
                    key={user.id}
                    className={`mention-overlay-item ${index === selectedIndex ? 'selected' : ''}`}
                    onClick={() => selectUser(user)}
                    onMouseEnter={() => setSelectedIndex(index)}
                >
                    <img src={user.avatar} alt={user.displayName} className="mention-overlay-avatar" />
                    <div className="mention-overlay-info">
                        <div className="mention-overlay-name">{user.displayName}</div>
                        <div className="mention-overlay-username">@{user.username}</div>
                    </div>
                </button>
            ))}
        </div>
    )
}
```

### Step 5: Style the Overlay

```css
/* MentionOverlay.css */
.mention-overlay {
    background: white;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    max-height: 300px;
    overflow-y: auto;
    min-width: 280px;
    z-index: 1000;
}

.mention-overlay-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    border: none;
    background: white;
    width: 100%;
    cursor: pointer;
    transition: background-color 0.15s ease;
    text-align: left;
}

.mention-overlay-item:hover,
.mention-overlay-item.selected {
    background-color: #f5f5f5;
}

.mention-overlay-item.selected {
    background-color: #e3f2fd;
}

.mention-overlay-avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    object-fit: cover;
    flex-shrink: 0;
}

.mention-overlay-info {
    flex: 1;
    min-width: 0;
}

.mention-overlay-name {
    font-weight: 600;
    font-size: 14px;
    color: #212121;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.mention-overlay-username {
    font-size: 13px;
    color: #757575;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.mention-overlay-empty {
    padding: 16px;
    text-align: center;
    color: #757575;
    font-size: 14px;
}

/* Scrollbar styling */
.mention-overlay::-webkit-scrollbar {
    width: 8px;
}

.mention-overlay::-webkit-scrollbar-track {
    background: #f5f5f5;
    border-radius: 0 8px 8px 0;
}

.mention-overlay::-webkit-scrollbar-thumb {
    background: #bdbdbd;
    border-radius: 4px;
}

.mention-overlay::-webkit-scrollbar-thumb:hover {
    background: #9e9e9e;
}
```

### Step 6: Compose the Editor

```tsx
// MentionEditor.tsx
import {FC, useState} from 'react'
import {MarkedInput} from '@markput/react'
import type {Option} from '@markput/react'
import {MentionMark} from './MentionMark'
import {MentionOverlay} from './MentionOverlay'
import type {User, MentionProps} from './types'
import './MentionEditor.css'

// Sample users data
const USERS: User[] = [
    {
        id: '1',
        username: 'alice',
        displayName: 'Alice Johnson',
        avatar: 'https://i.pravatar.cc/150?img=1',
    },
    {
        id: '2',
        username: 'bob',
        displayName: 'Bob Smith',
        avatar: 'https://i.pravatar.cc/150?img=2',
    },
    {
        id: '3',
        username: 'charlie',
        displayName: 'Charlie Brown',
        avatar: 'https://i.pravatar.cc/150?img=3',
    },
    {
        id: '4',
        username: 'diana',
        displayName: 'Diana Prince',
        avatar: 'https://i.pravatar.cc/150?img=4',
    },
    {
        id: '5',
        username: 'eve',
        displayName: 'Eve Davis',
        avatar: 'https://i.pravatar.cc/150?img=5',
    },
]

export const MentionEditor: FC = () => {
    const [value, setValue] = useState('')

    const handleMentionClick = (userId: string) => {
        console.log('Mention clicked:', userId)
        // Navigate to user profile, open modal, etc.
        window.alert(`Navigating to user profile: ${userId}`)
    }

    const mentionOption: Option<MentionProps> = {
        markup: '@[__value__](__meta__)',
        slots: {
            mark: MentionMark,
            overlay: () => <MentionOverlay users={USERS} />,
        },
        slotProps: {
            mark: ({value, meta}) => {
                // Parse meta: "userId|displayName|avatar"
                const [userId = '', displayName = '', avatar = ''] = (meta || '').split('|')

                return {
                    username: value || '',
                    userId,
                    displayName,
                    avatar,
                    onMentionClick: handleMentionClick,
                }
            },
        },
    }

    return (
        <div className="mention-editor-container">
            <h2>Mention System Demo</h2>
            <p className="hint">Type @ to mention someone</p>

            <MarkedInput
                value={value}
                onChange={setValue}
                Mark={MentionMark}
                options={[mentionOption]}
                slotProps={{
                    container: {
                        className: 'mention-editor',
                        placeholder: "What's on your mind?",
                    },
                }}
            />

            <div className="mention-editor-footer">
                <span className="char-count">{value.length} characters</span>
                <button className="post-button" disabled={!value.trim()}>
                    Post
                </button>
            </div>
        </div>
    )
}
```

### Step 7: Editor Styles

```css
/* MentionEditor.css */
.mention-editor-container {
    max-width: 600px;
    margin: 0 auto;
    padding: 20px;
}

.mention-editor-container h2 {
    margin: 0 0 8px 0;
    font-size: 24px;
    color: #212121;
}

.hint {
    margin: 0 0 16px 0;
    color: #757575;
    font-size: 14px;
}

.mention-editor {
    border: 2px solid #e0e0e0;
    border-radius: 12px;
    padding: 16px;
    min-height: 120px;
    font-size: 16px;
    line-height: 1.5;
    outline: none;
    transition: border-color 0.2s ease;
}

.mention-editor:focus {
    border-color: #2196f3;
}

.mention-editor:empty::before {
    content: attr(placeholder);
    color: #bdbdbd;
    pointer-events: none;
}

.mention-editor-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 12px;
}

.char-count {
    font-size: 14px;
    color: #757575;
}

.post-button {
    padding: 10px 24px;
    background-color: #2196f3;
    color: white;
    border: none;
    border-radius: 20px;
    font-weight: 600;
    font-size: 14px;
    cursor: pointer;
    transition: background-color 0.2s ease;
}

.post-button:hover:not(:disabled) {
    background-color: #1976d2;
}

.post-button:disabled {
    background-color: #e0e0e0;
    color: #9e9e9e;
    cursor: not-allowed;
}
```

## Step-by-Step Explanation

### 1. Type System

We define clear TypeScript interfaces:

- `User` - User data structure
- `MentionProps` - Props for the MentionMark component

This ensures type safety throughout the implementation.

### 2. Mention Component

The `MentionMark` component:

- Displays user avatar and username
- Is keyboard accessible (button element)
- Has hover and focus states
- Triggers click handler for navigation

### 3. Custom Overlay

The `MentionOverlay` component:

- Filters users based on typed text
- Supports keyboard navigation (↑↓, Enter, Esc)
- Shows user avatars and names
- Handles empty states

### 4. Data Flow

```
User types "@"
  → Overlay appears
  → User types "ali"
  → Filters to matching users (Alice)
  → User selects (click or Enter)
  → Inserts: @[alice](1|Alice Johnson|avatar.jpg)
  → Renders as clickable mention with avatar
```

### 5. Metadata Encoding

We encode multiple values in `meta` using pipe separator:

```
meta: "userId|displayName|avatarUrl"
```

This allows the mark to have all necessary data for rendering.

## Variations

### Variation 1: Async User Loading

```tsx
const MentionOverlayAsync: FC = () => {
    const {match, select} = useOverlay()
    const [users, setUsers] = useState<User[]>([])
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        const fetchUsers = async () => {
            setLoading(true)
            try {
                const response = await fetch(`/api/users/search?q=${encodeURIComponent(match.value)}`)
                const data = await response.json()
                setUsers(data)
            } catch (error) {
                console.error('Failed to fetch users:', error)
            } finally {
                setLoading(false)
            }
        }

        if (match.value.length >= 2) {
            fetchUsers()
        } else {
            setUsers([])
        }
    }, [match.value])

    if (loading) {
        return <div className="mention-overlay-loading">Loading...</div>
    }

    // Render filtered users...
}
```

### Variation 2: Group Mentions

```tsx
interface Group {
    id: string
    name: string
    memberCount: number
}

const GroupMentionMark: FC<{name: string; memberCount: number}> = ({name, memberCount}) => {
    return (
        <span className="mention mention-group">
            @{name} <small>({memberCount} members)</small>
        </span>
    )
}

// Usage
const groupOption: Option = {
    markup: '@@[__value__](__meta__)',
    slots: {mark: GroupMentionMark},
    slotProps: {
        mark: ({value, meta}) => ({
            name: value,
            memberCount: parseInt(meta || '0'),
        }),
    },
}
```

### Variation 3: Rich User Cards on Hover

```tsx
const MentionWithCard: FC<MentionProps> = props => {
    const [showCard, setShowCard] = useState(false)
    const [cardData, setCardData] = useState(null)

    const handleMouseEnter = async () => {
        setShowCard(true)
        const data = await fetchUserCard(props.userId)
        setCardData(data)
    }

    return (
        <span className="mention" onMouseEnter={handleMouseEnter} onMouseLeave={() => setShowCard(false)}>
            @{props.username}
            {showCard && cardData && <UserCard data={cardData} position="bottom" />}
        </span>
    )
}
```

### Variation 4: Mention Notifications

```tsx
const MentionEditorWithNotifications: FC = () => {
    const [value, setValue] = useState('')
    const [mentionedUsers, setMentionedUsers] = useState<string[]>([])

    const handleChange = (newValue: string) => {
        setValue(newValue)

        // Extract mentioned user IDs
        const mentionRegex = /@\[([^\]]+)\]\(([^|]+)\|/g
        const matches = [...newValue.matchAll(mentionRegex)]
        const userIds = matches.map(match => match[2])

        setMentionedUsers(userIds)
    }

    const handlePost = async () => {
        await fetch('/api/posts', {
            method: 'POST',
            body: JSON.stringify({
                content: value,
                mentionedUsers, // Send for notifications
            }),
        })
    }

    return (
        <div>
            <MarkedInput value={value} onChange={handleChange} />
            {mentionedUsers.length > 0 && <p>{mentionedUsers.length} user(s) will be notified</p>}
            <button onClick={handlePost}>Post</button>
        </div>
    )
}
```

## Mobile Optimization

```css
/* Add to MentionEditor.css */
@media (max-width: 768px) {
    .mention-editor-container {
        padding: 12px;
    }

    .mention-overlay {
        max-width: calc(100vw - 32px);
        max-height: 50vh;
    }

    .mention-overlay-item {
        padding: 10px;
    }

    .mention-overlay-avatar {
        width: 32px;
        height: 32px;
    }

    .mention {
        font-size: 13px;
    }

    .mention-avatar {
        width: 18px;
        height: 18px;
    }
}
```

## Integration with Backend

### Saving Mentions

```tsx
const handleSubmit = async () => {
    // Extract mentions from value
    const mentions = extractMentions(value)

    await fetch('/api/posts', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            content: value, // Store raw marked text
            mentions: mentions.map(m => ({
                userId: m.userId,
                position: m.position,
            })),
        }),
    })
}

function extractMentions(text: string) {
    const regex = /@\[([^\]]+)\]\(([^|]+)\|/g
    const mentions = []
    let match

    while ((match = regex.exec(text)) !== null) {
        mentions.push({
            username: match[1],
            userId: match[2],
            position: match.index,
        })
    }

    return mentions
}
```

### Loading Saved Mentions

```tsx
const loadPost = async (postId: string) => {
    const response = await fetch(`/api/posts/${postId}`)
    const post = await response.json()

    // post.content is already in marked format:
    // "Hey @[alice](1|Alice Johnson|avatar.jpg)!"
    setValue(post.content)
}
```

## Accessibility

```tsx
const AccessibleMentionMark: FC<MentionProps> = props => {
    return (
        <button
            className="mention"
            onClick={() => props.onMentionClick(props.userId)}
            aria-label={`Mention ${props.displayName}, username ${props.username}`}
            role="link"
        >
            <img
                src={props.avatar}
                alt="" // Decorative, description in aria-label
                aria-hidden="true"
            />
            <span>@{props.username}</span>
        </button>
    )
}

// Announce to screen readers
;<div role="status" aria-live="polite" className="sr-only">
    {mentionedUsers.length > 0 && `${mentionedUsers.length} users mentioned`}
</div>
```
