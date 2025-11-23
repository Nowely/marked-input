---
title: Framework Integration
description: How to integrate Markput with popular React frameworks
version: 1.0.0
---

Markput works seamlessly with all major React frameworks and build tools. This guide covers integration with the most popular options.

## Next.js

Markput works with Next.js out of the box. When using the App Router, remember to mark your component as a Client Component.

### App Router

```tsx
// app/editor/page.tsx
'use client'

import { MarkedInput } from 'rc-marked-input'
import { useState } from 'react'

export default function EditorPage() {
  const [value, setValue] = useState('')
  return <MarkedInput value={value} onChange={setValue} Mark={MyMark} />
}
```

**Important:** The `'use client'` directive is required because MarkedInput uses React hooks and DOM APIs.

### Pages Router

No special configuration needed:

```tsx
// pages/editor.tsx
import { MarkedInput } from 'rc-marked-input'
import { useState } from 'react'

export default function EditorPage() {
  const [value, setValue] = useState('')
  return <MarkedInput value={value} onChange={setValue} Mark={MyMark} />
}
```

### Server-Side Rendering (SSR)

If you encounter SSR issues, use dynamic imports:

```tsx
import dynamic from 'next/dynamic'

const MarkedInput = dynamic(
  () => import('rc-marked-input').then(mod => mod.MarkedInput),
  { ssr: false }
)
```

## Vite

Vite requires no special configuration. Markput works out of the box.

```tsx
// src/App.tsx
import { MarkedInput } from 'rc-marked-input'
import { useState } from 'react'

function App() {
  const [value, setValue] = useState('')
  return <MarkedInput value={value} onChange={setValue} Mark={MyMark} />
}

export default App
```

### Vite Configuration (Optional)

If you encounter any issues, you can explicitly include the package in optimization:

```js
// vite.config.js
export default {
  optimizeDeps: {
    include: ['rc-marked-input']
  }
}
```

## Create React App

Works without any configuration:

```tsx
// src/App.tsx
import { MarkedInput } from 'rc-marked-input'
import { useState } from 'react'

function App() {
  const [value, setValue] = useState('')
  return <MarkedInput value={value} onChange={setValue} Mark={MyMark} />
}

export default App
```

## Remix

Use MarkedInput in any route component:

```tsx
// app/routes/editor.tsx
import { MarkedInput } from 'rc-marked-input'
import { useState } from 'react'

export default function EditorRoute() {
  const [value, setValue] = useState('')
  return <MarkedInput value={value} onChange={setValue} Mark={MyMark} />
}
```

## Verification

After integrating with your framework, verify everything works with this simple test:

```tsx
import { MarkedInput } from 'rc-marked-input'
import { useState } from 'react'

function TestComponent() {
  const [value, setValue] = useState('Test @[mark]')

  return (
    <MarkedInput
      value={value}
      onChange={setValue}
      Mark={({ value }) => <span style={{ background: 'yellow' }}>{value}</span>}
    />
  )
}
```

If you see "Test @mark" with the mark highlighted in yellow, you're all set! ✅

## Troubleshooting Framework Issues

### Webpack Configuration

If you're using a custom Webpack setup and encounter module resolution issues:

```js
// webpack.config.js
module.exports = {
  resolve: {
    extensions: ['.js', '.jsx', '.ts', '.tsx'],
    fullySpecified: false
  }
}
```

### Build Optimization

For production builds, ensure tree-shaking works correctly by using named imports:

```tsx
// ✅ Good - allows tree-shaking
import { MarkedInput } from 'rc-marked-input'

// ❌ Avoid - includes entire package
import * as Markput from 'rc-marked-input'
```

## Next Steps

- **[Configuration](./configuration)** - Customize MarkedInput behavior
- **[Examples](../examples/mention-system)** - See real-world implementations
