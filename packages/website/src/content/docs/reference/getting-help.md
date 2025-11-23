---
title: Getting Help
description: How to get help and support for Markput
version: 1.0.0
---

Need help with Markput? This guide shows you where and how to get assistance.

## Before Asking for Help

Before reaching out, try these steps first:

### 1. Check the Documentation

- **[Getting Started](../introduction/getting-started)** - Setup and dependencies
- **[Quick Start](../introduction/quick-start)** - Basic usage guide
- **[Core Concepts](../introduction/core-concepts)** - Understanding how Markput works

### 2. Search Existing Issues

Someone may have already reported your issue:

1. Visit [GitHub Issues](https://github.com/Nowely/marked-input/issues)
2. Use the search bar to look for similar problems
3. Check both **open** and **closed** issues
4. Filter by labels (bug, question, documentation, etc.)

### 3. Review Examples

Check if your use case is covered in the examples:

- **[Mention System](../examples/mention-system)**
- **[Slash Commands](../examples/slash-commands)**
- **[Hashtags](../examples/hashtags)**
- **[Markdown Editor](../examples/markdown-editor)**
- **[Autocomplete](../examples/autocomplete)**

### 4. Try the CodeSandbox

Test your code in a minimal environment:

- **[CodeSandbox Template](https://codesandbox.io/s/marked-input-x5wx6k)**
- Create a reproduction of your issue
- Check if the problem persists in isolation

## Getting Help

### GitHub Discussions

**Best for:** Questions, feature requests, general discussions

**Link:** [github.com/Nowely/marked-input/discussions](https://github.com/Nowely/marked-input/discussions)

**When to use:**
- Asking "how do I...?" questions
- Discussing best practices
- Sharing ideas for new features
- Getting community feedback

**Example topics:**
- "How to implement multi-level nested marks?"
- "Best practices for large documents?"
- "Feature request: Add support for X"
- "Sharing my custom mark implementation"

**Response time:** Usually within 24-48 hours

### GitHub Issues

**Best for:** Bug reports, feature requests (after discussion)

**Link:** [github.com/Nowely/marked-input/issues](https://github.com/Nowely/marked-input/issues)

**When to use:**
- Reporting bugs
- Requesting well-defined features
- Reporting documentation errors
- Performance issues

**When NOT to use:**
- Questions (use Discussions instead)
- Support requests (use Discussions first)
- Vague feature ideas (discuss first)

**Response time:** Usually within 48-72 hours

### Creating a Bug Report

When reporting a bug, include:

#### 1. Environment Information

```bash
# Package version
npm list rc-marked-input

# React version
npm list react

# Node version
node --version

# Browser and OS
# Example: Chrome 120 on macOS 14.1
```

#### 2. Expected vs Actual Behavior

**Expected:**
> I expected marks to render with my custom component

**Actual:**
> Marks render as plain text instead

#### 3. Minimal Reproduction

Provide the **smallest** code example that reproduces the issue:

```tsx
import { MarkedInput } from 'rc-marked-input'
import { useState } from 'react'

function MinimalExample() {
  const [value, setValue] = useState('@[Alice]')

  return (
    <MarkedInput
      value={value}
      onChange={setValue}
      Mark={({ value }) => <span>{value}</span>}
      options={[{ markup: '@[__value__]' }]}
    />
  )
}
```

**Even better:** Create a CodeSandbox:

1. Fork the [official template](https://codesandbox.io/s/marked-input-x5wx6k)
2. Reproduce the issue
3. Share the link in your bug report

#### 4. Steps to Reproduce

Clear, numbered steps:

1. Install `rc-marked-input@1.2.3`
2. Create component with code above
3. Type "@Alice" in the editor
4. Observe that marks don't render

#### 5. Error Messages

Include complete error messages and stack traces:

```
Error: Cannot read property 'parse' of undefined
    at MarkedInput.tsx:45:12
    at commitWork (react-dom.js:234)
    ...
```

#### 6. Screenshots/Videos (if applicable)

Visual issues are easier to understand with screenshots.

### Issue Template

Use this template for bug reports:

```markdown
## Description

Brief description of the issue.

## Environment

- Package version: 1.2.3
- React version: 18.2.0
- Browser: Chrome 120
- OS: macOS 14.1

## Expected Behavior

What you expected to happen.

## Actual Behavior

What actually happened.

## Reproduction

Steps to reproduce:

1. Step one
2. Step two
3. Step three

### Code Example

\`\`\`tsx
// Minimal code that reproduces the issue
\`\`\`

### CodeSandbox (if applicable)

[Link to reproduction]

## Error Messages

\`\`\`
Error messages and stack traces
\`\`\`

## Additional Context

Any other relevant information.
```

## Community Support

### Stack Overflow

**Tag:** `markput` or `rc-marked-input`

**Best for:**
- General React questions
- Implementation questions
- Getting multiple perspectives

**Tips:**
- Include relevant code
- Show what you've tried
- Be specific in your question

### Discord/Slack (if available)

Check the [GitHub repository](https://github.com/Nowely/marked-input) README for links to community chat channels.

## Commercial Support

For commercial support, consulting, or custom development:

- Check the [GitHub repository](https://github.com/Nowely/marked-input) for contact information
- Reach out via GitHub Discussions with tag [commercial-support]

## Contributing

Found a bug and know how to fix it? Contributions are welcome!

### How to Contribute

1. **Fork the repository**
2. **Create a branch:** `git checkout -b fix/my-bug-fix`
3. **Make your changes**
4. **Add tests** (if applicable)
5. **Submit a pull request**

See [CONTRIBUTING.md](https://github.com/Nowely/marked-input/blob/main/CONTRIBUTING.md) for detailed guidelines.

### Good First Issues

New to open source? Look for issues labeled:
- `good first issue`
- `help wanted`
- `documentation`

## Response Time Expectations

| Channel | Typical Response Time | Best For |
|---------|----------------------|----------|
| GitHub Discussions | 24-48 hours | Questions, discussions |
| GitHub Issues | 48-72 hours | Bug reports, features |
| Pull Requests | 3-7 days | Code contributions |
| Stack Overflow | Varies | Community help |

**Note:** Response times are estimates. Complex issues may take longer.

## What Makes a Good Question?

### ✅ Good Questions

- **Specific:** "How do I add validation to mark components?"
- **Includes code:** Shows what you've tried
- **Clear context:** Explains what you're building
- **Research done:** Shows you've checked docs

**Example:**

> **Title:** How to validate mark values before insertion?
>
> I'm building a mention system and want to validate usernames before creating marks. I've tried using the `onChange` handler but that runs after the mark is created. Is there a way to intercept mark creation?
>
> ```tsx
> // What I've tried
> <MarkedInput
>   onChange={(value) => {
>     // Too late - mark already exists
>     if (hasInvalidMark(value)) {
>       // How to prevent?
>     }
>   }}
> />
> ```

### ❌ Poor Questions

- **Vague:** "It doesn't work"
- **No code:** No way to understand the problem
- **Too broad:** "How do I build a text editor?"
- **Already answered:** Didn't check docs/issues

## Response Guidelines

When you receive help:

### Do:
- ✅ Mark the question as answered/resolved
- ✅ Update with solution if you figure it out
- ✅ Thank helpers
- ✅ Share working code if it helps others

### Don't:
- ❌ Delete your question after getting help
- ❌ Open duplicate issues
- ❌ Demand immediate responses
- ❌ Get frustrated with volunteers

## Resources

### Official Resources

- **Documentation:** [markput.dev](https://markput.dev) (or your docs site)
- **GitHub:** [github.com/Nowely/marked-input](https://github.com/Nowely/marked-input)
- **NPM:** [npmjs.com/package/rc-marked-input](https://www.npmjs.com/package/rc-marked-input)
- **Examples:** [github.com/Nowely/marked-input/tree/main/examples](https://github.com/Nowely/marked-input/tree/main/examples)

### Learning Resources

- **[Core Concepts](../introduction/core-concepts)** - Deep dive into architecture
- **[API Reference](../api/components)** - Complete API documentation

### External Resources

- [React Documentation](https://react.dev)
- [TypeScript Handbook](https://www.typescriptlang.org/docs)
- [MDN Web Docs](https://developer.mozilla.org) - Web APIs reference

## Providing Feedback

Help improve Markput:

### Documentation Feedback

Found unclear documentation?

1. Open an issue with label `documentation`
2. Suggest specific improvements
3. Or submit a PR with fixes

### Feature Requests

Have an idea for a new feature?

1. Check if it's already requested in [Discussions](https://github.com/Nowely/marked-input/discussions)
2. If not, create a new discussion
3. Explain the use case and benefits
4. After community discussion, create an issue

### Bug Reports

See the "Creating a Bug Report" section above.

## Code of Conduct

All interactions should follow the [Code of Conduct](https://github.com/Nowely/marked-input/blob/main/CODE_OF_CONDUCT.md).

**Key principles:**
- Be respectful and inclusive
- Assume good intentions
- Give constructive feedback
- Focus on the issue, not the person

## Quick Links

- 🐛 [Report a Bug](https://github.com/Nowely/marked-input/issues/new?template=bug_report.md)
- 💡 [Request a Feature](https://github.com/Nowely/marked-input/discussions/new?category=ideas)
- ❓ [Ask a Question](https://github.com/Nowely/marked-input/discussions/new?category=q-a)
- 📖 [View Documentation](../introduction/why-markput)

---

**Still can't find what you need?** [Start a discussion](https://github.com/Nowely/marked-input/discussions/new) and the community will help!
