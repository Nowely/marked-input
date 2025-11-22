---
title: Browser Compatibility
description: Browser support, known issues, and compatibility solutions
version: 1.0.0
---

This guide covers browser compatibility for Markput, including supported browsers, known issues, and workarounds.

## Supported Browsers

### Desktop Browsers

| Browser | Minimum Version | Recommended | Status |
|---------|----------------|-------------|--------|
| **Chrome** | 90+ | Latest | ✅ Fully supported |
| **Firefox** | 88+ | Latest | ✅ Fully supported |
| **Safari** | 14+ | Latest | ✅ Fully supported |
| **Edge** | 90+ | Latest | ✅ Fully supported |
| **Opera** | 76+ | Latest | ✅ Fully supported |

### Mobile Browsers

| Browser | Minimum Version | Recommended | Status |
|---------|----------------|-------------|--------|
| **Chrome Mobile** | 90+ | Latest | ✅ Fully supported |
| **Safari iOS** | 14+ | Latest | ✅ Fully supported |
| **Firefox Mobile** | 88+ | Latest | ✅ Fully supported |
| **Samsung Internet** | 15+ | Latest | ✅ Fully supported |

### Browser Requirements

Markput requires browsers with support for:

- **ES6+ JavaScript**: Classes, arrow functions, destructuring
- **contenteditable**: Core editing functionality
- **Selection API**: Cursor positioning and ranges
- **Proxy**: Store reactivity
- **WeakMap/WeakSet**: Memory management
- **CSS Custom Properties**: Theming
- **Flexbox**: Layout

## Feature Compatibility

### Core Features

| Feature | Chrome | Firefox | Safari | Edge |
|---------|--------|---------|--------|------|
| contenteditable | ✅ | ✅ | ✅ | ✅ |
| Selection API | ✅ | ✅ | ✅ | ✅ |
| getSelection() | ✅ | ✅ | ✅ | ✅ |
| Range API | ✅ | ✅ | ✅ | ✅ |
| MutationObserver | ✅ | ✅ | ✅ | ✅ |
| Custom Events | ✅ | ✅ | ✅ | ✅ |
| Proxy | ✅ | ✅ | ✅ | ✅ |
| WeakMap | ✅ | ✅ | ✅ | ✅ |

### React Features

| Feature | Chrome | Firefox | Safari | Edge |
|---------|--------|---------|--------|------|
| React 18 | ✅ | ✅ | ✅ | ✅ |
| React 17 | ✅ | ✅ | ✅ | ✅ |
| React 16.8+ | ✅ | ✅ | ✅ | ✅ |
| Hooks | ✅ | ✅ | ✅ | ✅ |
| Context | ✅ | ✅ | ✅ | ✅ |
| Portals | ✅ | ✅ | ✅ | ✅ |
| Suspense | ✅ | ✅ | ✅ | ✅ |

### CSS Features

| Feature | Chrome | Firefox | Safari | Edge |
|---------|--------|---------|--------|------|
| Flexbox | ✅ | ✅ | ✅ | ✅ |
| CSS Grid | ✅ | ✅ | ✅ | ✅ |
| Custom Properties | ✅ | ✅ | ✅ | ✅ |
| position: sticky | ✅ | ✅ | ✅ | ✅ |
| :focus-visible | ✅ | ✅ | ✅ | ✅ |
| user-select | ✅ | ✅ | ✅ | ✅ |

## Known Issues

### Issue 1: Safari contenteditable Quirks

**Problem:** Safari has stricter requirements for contenteditable.

**Symptoms:**
- Editor not editable on first click
- Paste doesn't work as expected
- Selection behaves differently

**Solution:**

```typescript
<MarkedInput
  Mark={MyMark}
  slotProps={{
    container: {
      contentEditable: "true",  // ✅ String, not boolean
      suppressContentEditableWarning: true,
      // Safari-specific fixes
      onPaste: (e) => {
        e.preventDefault()
        const text = e.clipboardData.getData('text/plain')
        document.execCommand('insertText', false, text)
      }
    }
  }}
/>
```

### Issue 2: Firefox Overlay Positioning

**Problem:** Overlay position calculation differs in Firefox.

**Symptoms:**
- Overlay appears offset from cursor
- Overlay clips incorrectly

**Solution:**

```typescript
const CustomOverlay: FC = () => {
  const { style, ref } = useOverlay()
  const [adjustedStyle, setAdjustedStyle] = useState(style)

  useEffect(() => {
    // Firefox-specific adjustment
    const isFirefox = navigator.userAgent.includes('Firefox')

    if (isFirefox) {
      setAdjustedStyle({
        ...style,
        top: `${parseFloat(style.top || '0') + 2}px`,  // Adjust offset
        left: `${parseFloat(style.left || '0') + 1}px`
      })
    } else {
      setAdjustedStyle(style)
    }
  }, [style])

  return (
    <div
      ref={ref}
      style={{
        position: 'absolute',
        ...adjustedStyle
      }}
    >
      {/* Content */}
    </div>
  )
}
```

### Issue 3: Mobile Safari Virtual Keyboard

**Problem:** Virtual keyboard covers overlay.

**Symptoms:**
- Overlay hidden behind keyboard
- Can't see suggestions

**Solution:**

```typescript
function MobileEditor() {
  const [keyboardHeight, setKeyboardHeight] = useState(0)

  useEffect(() => {
    // Detect keyboard on iOS
    const handleResize = () => {
      if (window.visualViewport) {
        const height = window.innerHeight - window.visualViewport.height
        setKeyboardHeight(height)
      }
    }

    window.visualViewport?.addEventListener('resize', handleResize)
    return () => window.visualViewport?.removeEventListener('resize', handleResize)
  }, [])

  return (
    <MarkedInput
      Mark={MyMark}
      slotProps={{
        overlay: {
          style: {
            bottom: `${keyboardHeight}px`  // Position above keyboard
          }
        }
      }}
    />
  )
}
```

### Issue 4: Edge Legacy Selection Issues

**Problem:** Edge (pre-Chromium) has selection bugs.

**Status:** Not supported. Use Edge 90+ (Chromium-based).

**Migration:**

```typescript
// Detect Edge version
const isOldEdge = /Edge\/(\d+)/.test(navigator.userAgent)

if (isOldEdge) {
  return (
    <div className="browser-warning">
      Please upgrade to Microsoft Edge 90 or later for the best experience.
    </div>
  )
}
```

### Issue 5: Chrome Mobile Autocomplete Conflict

**Problem:** Chrome's built-in autocomplete conflicts with custom overlay.

**Symptoms:**
- Both overlays appear
- Native autocomplete suggestions interfere

**Solution:**

```typescript
<MarkedInput
  Mark={MyMark}
  slotProps={{
    container: {
      autoComplete: 'off',          // Disable native autocomplete
      autoCorrect: 'off',            // Disable autocorrect
      autoCapitalize: 'off',         // Disable auto-capitalization
      spellCheck: false,             // Disable spellcheck (optional)
      'data-gramm': 'false',         // Disable Grammarly
      'data-gramm_editor': 'false',
      'data-enable-grammarly': 'false'
    }
  }}
/>
```

### Issue 6: Safari Paste Formatting

**Problem:** Safari preserves unwanted formatting on paste.

**Solution:**

```typescript
function Editor() {
  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()

    // Get plain text only
    const text = e.clipboardData.getData('text/plain')

    // Insert as plain text
    const selection = window.getSelection()
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0)
      range.deleteContents()
      range.insertNode(document.createTextNode(text))
      range.collapse(false)
    }
  }

  return (
    <MarkedInput
      Mark={MyMark}
      slotProps={{
        container: {
          onPaste: handlePaste
        }
      }}
    />
  )
}
```

## Browser-Specific Workarounds

### Chrome

#### Issue: Performance with large documents

```typescript
// Use virtualization for Chrome
import { FixedSizeList } from 'react-window'

function LargeEditor() {
  // Only render visible portion
  return (
    <FixedSizeList
      height={600}
      itemCount={lines.length}
      itemSize={24}
    >
      {({ index }) => (
        <MarkedInput value={lines[index]} />
      )}
    </FixedSizeList>
  )
}
```

### Firefox

#### Issue: Caret position after mark insertion

```typescript
// Firefox-specific caret fix
const MyMark: FC<MarkProps> = ({ value }) => {
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (navigator.userAgent.includes('Firefox')) {
      // Add zero-width space after mark
      const parent = ref.current?.parentElement
      if (parent && !parent.textContent?.endsWith('\u200B')) {
        parent.insertAdjacentText('afterend', '\u200B')
      }
    }
  }, [])

  return <span ref={ref}>{value}</span>
}
```

### Safari

#### Issue: Input events not firing consistently

```typescript
function SafariEditor() {
  const handleInput = useDebouncedCallback(
    (e: React.FormEvent) => {
      const text = (e.target as HTMLElement).textContent || ''
      onChange(text)
    },
    50  // Slight delay helps Safari
  )

  return (
    <MarkedInput
      Mark={MyMark}
      slotProps={{
        container: {
          onInput: handleInput
        }
      }}
    />
  )
}
```

### Mobile Safari (iOS)

#### Issue: Touch events vs click events

```typescript
const MobileMark: FC<MarkProps> = ({ value }) => {
  const { remove } = useMark()

  const handleTouch = (e: React.TouchEvent) => {
    e.preventDefault()  // Prevent ghost clicks
    remove()
  }

  return (
    <button
      className="mark"
      onClick={remove}       // Desktop
      onTouchEnd={handleTouch}  // Mobile
    >
      {value}
    </button>
  )
}
```

## Mobile Compatibility

### Touch Events

```typescript
function MobileEditor() {
  const [value, setValue] = useState('')

  const handleTouchStart = (e: React.TouchEvent) => {
    // Handle touch start
    const touch = e.touches[0]
    console.log('Touch at:', touch.clientX, touch.clientY)
  }

  return (
    <MarkedInput
      value={value}
      onChange={setValue}
      Mark={MyMark}
      slotProps={{
        container: {
          onTouchStart: handleTouchStart
        }
      }}
    />
  )
}
```

### Virtual Keyboard

```typescript
function KeyboardAwareEditor() {
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false)

  useEffect(() => {
    const handleFocus = () => setIsKeyboardOpen(true)
    const handleBlur = () => setIsKeyboardOpen(false)

    const editor = document.querySelector('[contenteditable]')
    editor?.addEventListener('focus', handleFocus)
    editor?.addEventListener('blur', handleBlur)

    return () => {
      editor?.removeEventListener('focus', handleFocus)
      editor?.removeEventListener('blur', handleBlur)
    }
  }, [])

  return (
    <div className={isKeyboardOpen ? 'keyboard-open' : ''}>
      <MarkedInput Mark={MyMark} />
    </div>
  )
}
```

```css
.keyboard-open {
  /* Adjust layout when keyboard is open */
  padding-bottom: 300px;
}

@media (max-height: 500px) {
  /* Landscape mode adjustments */
  .keyboard-open {
    padding-bottom: 150px;
  }
}
```

### Viewport Meta Tag

Add to HTML for proper mobile scaling:

```html
<meta
  name="viewport"
  content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"
/>
```

### Mobile-Specific Styles

```css
/* Touch-friendly mark components */
@media (pointer: coarse) {
  .mark {
    min-height: 44px;      /* iOS minimum touch target */
    padding: 12px 16px;    /* Larger padding */
    font-size: 16px;       /* Prevent zoom on iOS */
  }

  .overlay {
    max-height: 50vh;      /* Don't cover entire screen */
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;  /* Smooth scrolling on iOS */
  }
}

/* Prevent text selection on mobile (optional) */
@media (pointer: coarse) {
  .mark {
    -webkit-user-select: none;
    user-select: none;
  }
}
```

## Polyfills

### Required Polyfills

Markput requires no polyfills for modern browsers (Chrome 90+, Firefox 88+, Safari 14+, Edge 90+).

### Optional Polyfills

For older browser support:

```bash
npm install core-js
```

```typescript
// src/polyfills.ts
import 'core-js/stable'

// Specific polyfills
import 'core-js/es/proxy'
import 'core-js/es/weak-map'
import 'core-js/es/weak-set'
```

Import polyfills before React:

```typescript
// src/index.tsx
import './polyfills'  // ✅ Import first
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

ReactDOM.createRoot(document.getElementById('root')!).render(<App />)
```

### Selection API Polyfill

For very old browsers:

```bash
npm install selection-polyfill
```

```typescript
import 'selection-polyfill'
```

## Testing Across Browsers

### Manual Testing Checklist

Test on each target browser:

- [ ] **Basic editing**: Type, delete, select text
- [ ] **Mark rendering**: Marks display correctly
- [ ] **Overlay**: Opens at correct position
- [ ] **Keyboard navigation**: Tab, arrows, enter work
- [ ] **Copy/paste**: Text copies/pastes correctly
- [ ] **Touch events**: Taps work on mobile
- [ ] **Performance**: No lag during typing

### Automated Testing

#### BrowserStack Configuration

```javascript
// wdio.conf.js
exports.config = {
  user: process.env.BROWSERSTACK_USERNAME,
  key: process.env.BROWSERSTACK_ACCESS_KEY,

  capabilities: [
    // Desktop browsers
    {
      browserName: 'Chrome',
      browserVersion: 'latest',
      os: 'Windows',
      osVersion: '11'
    },
    {
      browserName: 'Firefox',
      browserVersion: 'latest',
      os: 'Windows',
      osVersion: '11'
    },
    {
      browserName: 'Safari',
      browserVersion: '16',
      os: 'OS X',
      osVersion: 'Ventura'
    },
    // Mobile browsers
    {
      browserName: 'Safari',
      device: 'iPhone 14',
      os: 'iOS',
      osVersion: '16'
    },
    {
      browserName: 'Chrome',
      device: 'Samsung Galaxy S23',
      os: 'Android',
      osVersion: '13.0'
    }
  ]
}
```

#### Playwright Configuration

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] }
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] }
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] }
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 13'] }
    }
  ]
})
```

#### Cross-Browser Test Example

```typescript
// test/cross-browser.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Cross-browser compatibility', () => {
  test('typing works in all browsers', async ({ page }) => {
    await page.goto('http://localhost:3000')

    const editor = page.locator('[contenteditable]')
    await editor.click()
    await editor.type('Hello @[World]')

    await expect(editor).toContainText('Hello')
    await expect(page.locator('[data-mark]')).toContainText('World')
  })

  test('overlay opens in all browsers', async ({ page }) => {
    await page.goto('http://localhost:3000')

    const editor = page.locator('[contenteditable]')
    await editor.click()
    await editor.type('@')

    // Overlay should appear
    await expect(page.locator('[role="listbox"]')).toBeVisible()
  })
})
```

### Browser Detection

```typescript
function getBrowserInfo() {
  const ua = navigator.userAgent

  return {
    isChrome: /Chrome/.test(ua) && !/Edge/.test(ua),
    isFirefox: /Firefox/.test(ua),
    isSafari: /Safari/.test(ua) && !/Chrome/.test(ua),
    isEdge: /Edg/.test(ua),
    isIOS: /iPhone|iPad|iPod/.test(ua),
    isAndroid: /Android/.test(ua),
    isMobile: /Mobile|Android|iPhone|iPad|iPod/.test(ua)
  }
}

// Usage
function Editor() {
  const browser = getBrowserInfo()

  return (
    <MarkedInput
      Mark={MyMark}
      slotProps={{
        container: {
          // Apply browser-specific fixes
          style: {
            ...(browser.isSafari && { WebkitUserSelect: 'text' }),
            ...(browser.isFirefox && { MozUserSelect: 'text' })
          }
        }
      }}
    />
  )
}
```

## Performance by Browser

### Baseline Performance

| Browser | Parse (1000 chars) | Render (100 marks) | Memory Usage |
|---------|-------------------|-------------------|--------------|
| Chrome | ~1ms | ~5ms | ~10MB |
| Firefox | ~1.2ms | ~6ms | ~12MB |
| Safari | ~1.5ms | ~7ms | ~11MB |
| Edge | ~1ms | ~5ms | ~10MB |

### Mobile Performance

| Browser | Parse (1000 chars) | Render (100 marks) | Memory Usage |
|---------|-------------------|-------------------|--------------|
| Chrome Mobile | ~2ms | ~10ms | ~15MB |
| Safari iOS | ~3ms | ~12ms | ~18MB |
| Firefox Mobile | ~2.5ms | ~11ms | ~16MB |

### Optimization Tips

#### Chrome-Specific

```typescript
// Enable Chrome's optimization hints
<MarkedInput
  Mark={memo(MyMark)}  // Memoize for Chrome's optimizer
  slotProps={{
    container: {
      // Chrome performs better with specific values
      style: { willChange: 'contents' }
    }
  }}
/>
```

#### Safari-Specific

```typescript
// Safari benefits from simpler DOM
const SimpleMark: FC<MarkProps> = memo(({ value }) => (
  <span className="mark">{value}</span>  // Minimal DOM
))
```

## Accessibility by Browser

### Screen Reader Support

| Screen Reader | Browser | Support |
|--------------|---------|---------|
| **NVDA** | Chrome, Firefox | ✅ Excellent |
| **JAWS** | Chrome, Firefox, Edge | ✅ Excellent |
| **VoiceOver** | Safari (macOS) | ✅ Excellent |
| **VoiceOver** | Safari (iOS) | ✅ Good |
| **TalkBack** | Chrome (Android) | ✅ Good |

### Testing with Screen Readers

```typescript
<MarkedInput
  Mark={MyMark}
  slotProps={{
    container: {
      role: 'textbox',
      'aria-label': 'Message editor',
      'aria-multiline': true
    }
  }}
/>
```

## Debugging Browser Issues

### Browser DevTools

**Chrome DevTools:**
```javascript
// Check selection
console.log(window.getSelection())

// Monitor contenteditable events
document.querySelector('[contenteditable]').addEventListener('input', (e) => {
  console.log('Input event:', e)
})
```

**Firefox DevTools:**
```javascript
// Check caret position
const selection = window.getSelection()
console.log('Range:', selection.getRangeAt(0))
```

**Safari DevTools:**
```javascript
// Monitor touch events
document.addEventListener('touchstart', (e) => {
  console.log('Touch:', e.touches[0])
})
```

### Remote Debugging

#### iOS Safari

1. Enable Web Inspector on iPhone: Settings → Safari → Advanced → Web Inspector
2. Connect iPhone to Mac
3. Safari → Develop → [Your iPhone] → [Your Page]

#### Android Chrome

1. Enable USB debugging on Android
2. Connect to computer
3. Chrome → chrome://inspect → Inspect

### Browser Feature Detection

```typescript
function checkBrowserSupport() {
  const features = {
    contentEditable: 'contentEditable' in document.createElement('div'),
    selectionAPI: typeof window.getSelection === 'function',
    proxy: typeof Proxy !== 'undefined',
    weakMap: typeof WeakMap !== 'undefined'
  }

  console.table(features)

  const unsupported = Object.entries(features)
    .filter(([_, supported]) => !supported)
    .map(([feature]) => feature)

  if (unsupported.length > 0) {
    console.error('Unsupported features:', unsupported)
    return false
  }

  return true
}

// Run on app start
if (!checkBrowserSupport()) {
  alert('Your browser is not supported. Please upgrade.')
}
```

## Browser-Specific CSS

```css
/* Chrome-specific */
@supports (-webkit-appearance: none) {
  .mark {
    -webkit-font-smoothing: antialiased;
  }
}

/* Firefox-specific */
@-moz-document url-prefix() {
  .mark {
    -moz-osx-font-smoothing: grayscale;
  }
}

/* Safari-specific */
@supports (-webkit-backdrop-filter: blur(1px)) {
  .overlay {
    -webkit-backdrop-filter: blur(10px);
    backdrop-filter: blur(10px);
  }
}

/* Edge-specific */
@supports (-ms-ime-align: auto) {
  .mark {
    /* Edge-specific styles */
  }
}

/* Mobile-specific */
@media (hover: none) and (pointer: coarse) {
  .mark {
    /* Mobile touch styles */
    padding: 12px;
    min-height: 44px;
  }
}
```

## Common Browser Errors

### Error 1: "Selection API not supported"

**Browser:** Old browsers

**Fix:** Add polyfill or show upgrade message

```typescript
if (!window.getSelection) {
  return (
    <div className="browser-warning">
      Your browser is not supported. Please upgrade to a modern browser.
    </div>
  )
}
```

### Error 2: "Proxy is not defined"

**Browser:** IE11, old Edge

**Fix:** Not supported. Show upgrade message.

```typescript
if (typeof Proxy === 'undefined') {
  return (
    <div className="browser-warning">
      Internet Explorer is not supported. Please use Edge, Chrome, or Firefox.
    </div>
  )
}
```

### Error 3: contenteditable not working on mobile

**Browser:** iOS Safari

**Fix:** Ensure proper viewport meta tag

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0">
```

## Migration from Old Browsers

### Detect and Warn

```typescript
function BrowserWarning() {
  const isSupported = useCallback(() => {
    // Check critical features
    return (
      typeof Proxy !== 'undefined' &&
      typeof WeakMap !== 'undefined' &&
      'contentEditable' in document.createElement('div')
    )
  }, [])

  if (!isSupported()) {
    return (
      <div className="alert alert-warning">
        <h3>Unsupported Browser</h3>
        <p>Markput requires a modern browser. Please upgrade to:</p>
        <ul>
          <li>Chrome 90+</li>
          <li>Firefox 88+</li>
          <li>Safari 14+</li>
          <li>Edge 90+</li>
        </ul>
      </div>
    )
  }

  return null
}
```

## Best Practices

### ✅ Do

- Test on all target browsers regularly
- Use feature detection, not browser detection
- Provide fallbacks for unsupported features
- Test with screen readers on each browser
- Monitor performance across browsers
- Use CSS prefixes when needed
- Test on real mobile devices

### ❌ Don't

- Assume all browsers behave the same
- Use browser-specific hacks without documentation
- Ignore mobile browsers
- Test only on your development browser
- Use deprecated APIs
- Block users based on User-Agent alone

## Resources

- [Can I Use](https://caniuse.com/) - Browser feature support
- [BrowserStack](https://www.browserstack.com/) - Cross-browser testing
- [Playwright](https://playwright.dev/) - Browser automation
- [MDN Browser Compatibility](https://developer.mozilla.org/en-US/docs/MDN/Writing_guidelines/Page_structures/Compatibility_tables) - Compatibility data

## Next Steps

- **[Troubleshooting](./troubleshooting)** - Common issues and solutions
- **[FAQ](./faq)** - Frequently asked questions
- **[Accessibility Guide](../advanced/accessibility)** - Screen reader support

---

**Found a browser-specific bug?** [Report it on GitHub](https://github.com/Nowely/marked-input/issues/new)
