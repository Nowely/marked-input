<!--
	Absolute raw URLs: this README is copied into the npm packages by prepack.js,
	where repo-relative paths resolve to nothing. npm also strips <picture>, so the
	<img> fallback is the tile variant, readable on both npm themes.
-->
<p align="center">
	<picture>
		<source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/Nowely/marked-input/next/docs/brand/mark-dark.svg">
		<source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/Nowely/marked-input/next/docs/brand/mark.svg">
		<img src="https://raw.githubusercontent.com/Nowely/marked-input/next/docs/brand/mark-tile.svg" alt="Markput logo" width="96" height="96">
	</picture>
</p>

# [Markput](https://markput.vercel.app)

[![npm version](https://img.shields.io/npm/v/@markput/react.svg?style=flat&label=react)](https://www.npmjs.com/package/@markput/react) [![min zipped size](https://img.shields.io/bundlephobia/minzip/@markput/react?label=react+gzip)](https://bundlephobia.com/package/@markput/react) [![React Storybook](https://gw.alipayobjects.com/mdn/ob_info/afts/img/A*CQXNTZfK1vwAAAAAAAAAAABjAQAAAQ/original)](https://markput-react.vercel.app)

[![npm version](https://img.shields.io/npm/v/@markput/vue.svg?style=flat&label=vue)](https://www.npmjs.com/package/@markput/vue) [![min zipped size](https://img.shields.io/bundlephobia/minzip/@markput/vue?label=vue+gzip)](https://bundlephobia.com/package/@markput/vue) [![Vue Storybook](https://gw.alipayobjects.com/mdn/ob_info/afts/img/A*CQXNTZfK1vwAAAAAAAAAAABjAQAAAQ/original)](https://markput-vue.vercel.app)

<img width="640" height="270" alt="Markput editor: text with inline mention and hashtag chips, an autocomplete overlay, and the plain-text string underneath" src="https://raw.githubusercontent.com/Nowely/marked-input/next/docs/brand/editor-demo.png">

A set of framework adapters that let you combine editable text with custom components using annotated text.

Currently supported packages:

- `@markput/react`
- `@markput/vue`

**[Documentation](https://markput.vercel.app)**
**[React Storybook](https://markput-react.vercel.app)** | **[Vue Storybook](https://markput-vue.vercel.app)**

## Feature

- Powerful annotations tool: add, edit, remove, visualize
- Nested marks support
- Support for custom syntax patterns (e.g., HTML, markdown)
- TypeScript
- Support for any components
- Flexible and customizable
- Two ways to configure
- Helpers for processing text
- Hooks for advanced components
- Button handling (Left, Right, Delete, Backspace, Esc)
- Overlay with the suggestions component by default
- Zero dependencies
- Cross selection

## Installation

Install the package for your framework:

```
pnpm add @markput/react
# or
pnpm add @markput/vue
```

## Contributing

If you want to contribute, you are welcome! Create an issue or start a discussion.
