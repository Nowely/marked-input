---
title: Installation
description: How to install Markput in your project
version: 1.0.0
---

## Package Installation

Install Markput using your preferred package manager:

### npm
```bash
npm install rc-marked-input
```

### yarn
```bash
yarn add rc-marked-input
```

### pnpm
```bash
pnpm add rc-marked-input
```

### bun
```bash
bun add rc-marked-input
```

## Requirements

### Peer Dependencies

Markput requires React as a peer dependency:

```json
{
  "peerDependencies": {
    "react": ">=17.0.0"
  }
}
```

If you don't have React installed:

```bash
npm install react react-dom
```

### Browser Support

Markput supports all modern browsers:

- Chrome/Edge (latest 2 versions)
- Firefox (latest 2 versions)
- Safari (latest 2 versions)
- iOS Safari (latest 2 versions)
- Android Chrome (latest 2 versions)

**Note:** Internet Explorer is not supported.

## TypeScript Setup

Markput is written in TypeScript and includes type definitions. No additional packages are needed!

### Verify TypeScript Types

If you encounter type errors, ensure you have React types installed:

```bash
npm install --save-dev @types/react @types/react-dom
```

### tsconfig.json Recommendations

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "strict": true
  }
}
```

## Package Structure

When you install `rc-marked-input`, you get:

```
node_modules/
└── rc-marked-input/
    ├── index.js          # Main entry (ESM)
    ├── index.d.ts        # TypeScript definitions
    └── styles.css        # Optional styles
```

### Core Package

Markput also exports a core package for advanced use cases:

```tsx
import { parse, createStore } from '@markput/core'
```

This is useful if you're building custom integrations or need framework-agnostic parsing.

## Import Styles (Optional)

Markput includes optional base styles for the default Suggestions component:

```tsx
import 'rc-marked-input/styles.css'
```

**Note:** These styles are optional. You can style components entirely with your own CSS.

## Framework Integration

### Next.js

Markput works with Next.js out of the box:

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

**Important:** Use `'use client'` directive for Next.js App Router.

### Vite

No special configuration needed:

```tsx
// src/App.tsx
import { MarkedInput } from 'rc-marked-input'
import { useState } from 'react'

function App() {
  const [value, setValue] = useState('')
  return <MarkedInput value={value} onChange={setValue} Mark={MyMark} />
}
```

### Create React App

Works without configuration:

```tsx
import { MarkedInput } from 'rc-marked-input'
```

### Remix

Use in route components:

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

Verify your installation works:

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

If you see "Test mark" with a yellow background, you're all set! ✅

## Troubleshooting

### Module Not Found

**Error:** `Cannot find module 'rc-marked-input'`

**Solutions:**
1. Check the package is installed: `npm list rc-marked-input`
2. Delete node_modules and reinstall: `rm -rf node_modules && npm install`
3. Clear your bundler cache (Vite: `rm -rf .vite`, Next: `rm -rf .next`)

### Type Errors

**Error:** `Could not find a declaration file for module 'rc-marked-input'`

**Solutions:**
1. Ensure TypeScript is installed: `npm install --save-dev typescript`
2. Install React types: `npm install --save-dev @types/react`
3. Restart your IDE/TypeScript server

### React Version Mismatch

**Error:** `Hooks can only be called inside the body of a function component`

**Cause:** Multiple React versions installed

**Solution:**
```bash
# Check for duplicate React
npm ls react

# If duplicates found, deduplicate
npm dedupe
```

### Build Errors with Bundlers

**Error:** Build fails with ESM/CJS issues

**Solutions:**

For Webpack:
```js
// webpack.config.js
module.exports = {
  resolve: {
    extensions: ['.js', '.jsx', '.ts', '.tsx'],
    fullySpecified: false
  }
}
```

For Vite (usually works by default):
```js
// vite.config.js
export default {
  optimizeDeps: {
    include: ['rc-marked-input']
  }
}
```

### Server-Side Rendering (SSR) Issues

**Error:** `document is not defined` or `window is not defined`

**Solution:** Use dynamic imports:

```tsx
// Next.js
import dynamic from 'next/dynamic'

const MarkedInput = dynamic(
  () => import('rc-marked-input').then(mod => mod.MarkedInput),
  { ssr: false }
)
```

## Getting Help

Still having issues?

1. **Search existing issues:** [GitHub Issues](https://github.com/Nowely/marked-input/issues)
2. **Ask a question:** [GitHub Discussions](https://github.com/Nowely/marked-input/discussions)
3. **Check examples:** [CodeSandbox Templates](https://codesandbox.io/s/marked-input-x5wx6k)

## Next Steps

Installation complete! Now let's build something:

- **[Quick Start](./quick-start)** - Build your first editor in 5 minutes
- **[Core Concepts](./core-concepts)** - Understand how Markput works
- **[Examples](../examples/mention-system)** - See production-ready examples

