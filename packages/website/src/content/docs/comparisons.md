---
title: Comparison with Other Editors
description: How Markput compares to other rich text editor libraries
version: 1.0.0
---

This page compares Markput with other popular rich text editor libraries to help you understand when Markput is the right choice for your project.

## Feature Comparison

| Feature | Markput | Draft.js | Slate | ProseMirror |
|---------|---------|----------|-------|-------------|
| **Markup-based** | ✅ | ❌ | ❌ | ❌ |
| **Custom patterns** | ✅ | Limited | Limited | Limited |
| **Bundle size** | ~15KB | ~100KB | ~150KB | ~200KB |
| **Learning curve** | Easy | Steep | Steep | Very steep |
| **TypeScript** | ✅ First-class | ✅ | ✅ | ⚠️ Limited |

## When to Use Markput

**Best for:**
- Lightweight editors with custom markup (mentions, tags, commands)
- Applications that need @mentions, #hashtags, or /commands
- Projects where bundle size matters
- Teams that value simple, straightforward APIs
- Applications requiring pattern-based text formatting

**Not for:**
- Complex WYSIWYG editors with rich formatting toolbars
- Document editors with extensive formatting options (bold, italic, lists, etc.)
- Applications that need complex nested document structures
- Full-featured word processor replacements

## Detailed Comparison

### Markput

**Strengths:**
- Markup-based approach makes it easy to work with patterns like @mentions and #hashtags
- Very small bundle size (~15KB)
- Simple API with minimal learning curve
- First-class TypeScript support
- Pattern matching with regular expressions

**Limitations:**
- Not designed for complex WYSIWYG editing
- Limited to markup-based patterns
- Fewer formatting options compared to full-featured editors

**Use cases:**
- Social media comment systems
- Chat applications with mentions
- Command palettes with slash commands
- Tagging systems with hashtags

### Draft.js

**Strengths:**
- Developed and maintained by Meta (Facebook)
- Mature ecosystem with many plugins
- Good for complex rich text editing
- Handles contentEditable quirks well

**Limitations:**
- Large bundle size (~100KB)
- Steep learning curve
- Complex API with many concepts to learn
- Limited TypeScript support
- Development has slowed down

**Use cases:**
- Rich text editors with formatting toolbars
- Content management systems
- Note-taking applications

### Slate

**Strengths:**
- Highly customizable and extensible
- Active development and community
- Plugin architecture
- Good TypeScript support

**Limitations:**
- Large bundle size (~150KB)
- Steep learning curve
- Breaking changes between versions
- Requires significant setup

**Use cases:**
- Custom rich text editors
- Document editors
- Collaborative editing tools

### ProseMirror

**Strengths:**
- Most powerful and flexible
- Excellent for collaborative editing
- Strong document model
- Used by many major applications

**Limitations:**
- Largest bundle size (~200KB)
- Very steep learning curve
- Complex architecture
- Limited TypeScript support

**Use cases:**
- Professional document editors
- Collaborative editing platforms
- Complex content management systems

## Migration Guide

If you're considering migrating from another editor to Markput, here's what you need to know:

### From Draft.js

1. Convert Draft.js content state to plain text with markup
2. Configure Markput options to match your entity types
3. Replace Draft.js components with Markput

**Example:**
```typescript
// Draft.js entity
{ type: 'mention', data: { id: '123', name: 'Alice' } }

// Becomes Markput markup
'@[Alice](123)'
```

### From Slate

1. Serialize Slate nodes to markup text
2. Create corresponding markup patterns
3. Migrate editor component

### From ProseMirror

ProseMirror's document model is very different from Markput's markup-based approach. Migration is best suited for applications that can simplify their editing needs to pattern-based markup.

## Framework Support

### Markput
- **React**: ✅ Full support (`rc-marked-input`)
- **Vue/Svelte/Angular**: ⚠️ Core library only (`@markput/core`)

### Other Editors
- **Draft.js**: React only
- **Slate**: React only
- **ProseMirror**: Framework-agnostic

## Conclusion

Choose Markput if you need:
- Pattern-based text input (@mentions, #hashtags, /commands)
- Small bundle size
- Simple API
- Quick implementation

Choose other editors if you need:
- Complex WYSIWYG editing
- Rich formatting toolbars
- Document-style editing
- Collaborative editing features

**Still unsure?** Ask in [GitHub Discussions](https://github.com/Nowely/marked-input/discussions)!
