# Markput Documentation Website

[![Built with Starlight](https://astro.badg.es/v2/built-with-starlight/tiny.svg)](https://starlight.astro.build)

Documentation site for Markput, built with [Astro](https://astro.build) and [Starlight](https://starlight.astro.build).

## 📚 Tech Stack Overview

### Astro Framework

- **Server-first rendering**: Components render on the server, sending minimal JavaScript to the browser
- **Zero JavaScript by default**: Astro automatically removes unused JavaScript
- **Content Collections**: Type-safe content management with frontmatter validation
- **File-based routing**: Each file in `src/content/docs/` becomes a route
- **Multi-framework support**: Can use React, Vue, Svelte, or other frameworks alongside Astro components

### Starlight Documentation Framework

- **Built on Astro**: Inherits all Astro performance benefits
- **Documentation-focused**: Pre-configured navigation, search, SEO, and accessibility
- **i18n ready**: Built-in internationalization support
- **Dark mode**: Automatic light/dark theme switching
- **Markdown/MDX**: Supports `.md` and `.mdx` with component integration

### Tailwind CSS

- Utility-first CSS framework for custom styling
- Configured in `src/styles/global.css`

## 🗂️ Project Structure

```
packages/website/
├── public/              # Static assets (favicons, images)
├── src/
│   ├── assets/         # Images and media files (optimized by Astro)
│   ├── content/
│   │   └── docs/       # Documentation pages (.md/.mdx)
│   ├── styles/
│   │   └── global.css  # Tailwind configuration and global styles
│   └── content.config.ts  # Content Collections schema
├── astro.config.mjs    # Astro and Starlight configuration
├── package.json
└── tsconfig.json
```

## 🧞 Commands

Run from the project root:

| Command                | Action                                           |
| :--------------------- | :----------------------------------------------- |
| `pnpm install`         | Installs dependencies                            |
| `pnpm dev`             | Starts local dev server at `localhost:4321`      |
| `pnpm build`           | Build production site to `./dist/`               |
| `pnpm preview`         | Preview build locally before deploying           |
| `pnpm astro ...`       | Run CLI commands like `astro add`, `astro check` |
| `pnpm astro -- --help` | Get help using the Astro CLI                     |

## 📝 Content Development Guidelines

### Creating Documentation Pages

1. **Location**: All docs go in `src/content/docs/`
2. **Format**: Use `.md` for simple pages, `.mdx` for pages with components
3. **Routing**: File path determines URL
    - `src/content/docs/guide.md` → `/guide`
    - `src/content/docs/api/overview.md` → `/api/overview`

### Frontmatter Schema

Every doc page should include frontmatter:

```yaml
---
title: Page Title
description: Brief description for SEO and previews
---
```

Additional optional fields (configured in `content.config.ts`):

- `sidebar`: Custom sidebar configuration
- `tableOfContents`: Control TOC visibility
- `editUrl`: Override edit link
- `lastUpdated`: Custom date override

### Working with Images

**Optimized images** (recommended):

```md
![Alt text](../../assets/image.png)
```

- Stored in `src/assets/`
- Automatically optimized by Astro
- Responsive and format-converted

**Static images**:

```md
![Alt text](/static-image.png)
```

- Stored in `public/`
- Served as-is without optimization

### Using MDX Components

MDX allows importing and using components:

```mdx
---
title: Example
---

import MyComponent from '../../components/MyComponent.astro'

# Content

<MyComponent prop="value" />
```

## 🎨 Styling Guidelines

### Tailwind CSS

- Global styles: `src/styles/global.css`
- Use Tailwind utility classes in MDX:
    ```mdx
    <div class="bg-blue-500 text-white p-4 rounded">Styled content</div>
    ```

### Custom CSS

Add custom styles in `global.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Custom styles */
.custom-class {
    /* ... */
}
```

## ⚙️ Configuration

### Astro Config (`astro.config.mjs`)

Key configuration points:

- **Starlight settings**: Site title, navigation, sidebar
- **Integrations**: Add UI frameworks or other integrations
- **Build settings**: Output directory, adapters for deployment

### Content Collections (`content.config.ts`)

- Define content schemas with Zod
- Add type-safety to frontmatter
- Validate content at build time

## 🚀 Development Best Practices

### 1. Server-First Mindset

- Astro renders on the server by default
- Only add client-side JavaScript when necessary
- Use `client:*` directives sparingly for interactivity

### 2. Content Organization

- Group related pages in folders
- Use index.md for section overviews
- Keep file names URL-friendly (lowercase, hyphens)

### 3. Performance

- Prefer `src/assets/` for images (auto-optimization)
- Minimize client-side JavaScript
- Use Astro's View Transitions for smooth navigation

### 4. Type Safety

- Define content schemas in `content.config.ts`
- Use TypeScript for components
- Validate frontmatter at build time

### 5. Navigation Structure

- Configure sidebar in `astro.config.mjs`
- Use consistent heading hierarchy (H1 → H2 → H3)
- Include descriptions for better SEO

## 🔧 Common Patterns

### Adding a New Documentation Section

1. Create folder in `src/content/docs/`
2. Add `index.md` as section overview
3. Add pages within the folder
4. Update sidebar in `astro.config.mjs`

### Creating Reusable Components

1. Create `.astro` component in `src/components/`
2. Import in MDX files
3. Pass props for customization

### Customizing Starlight

Starlight can be extended with:

- Custom CSS in `global.css`
- Astro integrations
- Custom components overriding defaults
- Plugins for additional functionality

## 📚 Resources

- [Starlight Documentation](https://starlight.astro.build/)
- [Astro Documentation](https://docs.astro.build/)
- [Astro Discord](https://astro.build/chat)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)

## 🎯 Quick Reference for AI Assistant

When working on this project:

1. **File Operations**:
    - Docs: `src/content/docs/` (.md/.mdx files)
    - Images: `src/assets/` (optimized) or `public/` (static)
    - Config: `astro.config.mjs`, `content.config.ts`
    - Styles: `src/styles/global.css`

2. **Architecture**:
    - Server-side rendering (SSR) by default
    - Zero JS baseline, hydrate components only when needed
    - Type-safe content collections
    - File-based routing

3. **Don't**:
    - Add unnecessary client-side JavaScript
    - Bypass content collections for documentation
    - Ignore frontmatter schema validation
    - Create routes outside `src/content/docs/`

4. **Do**:
    - Use Astro components for reusable UI
    - Leverage content collections for type safety
    - Optimize images through `src/assets/`
    - Follow Starlight conventions for consistency
    - Use Tailwind utilities for styling
