/**
 * `@markput/notion` — a Notion-shaped editor written as markput OPTIONS and COMPONENTS.
 *
 * The whole package is `{markup, row}` for a block kind, `{markup, Mark}` for an inline one, and
 * the components those two name. It imports the published packages and nothing else: no core
 * internal, no `store.edit`, no `store.tokens`.
 */

export {NOTION_THEME, theme} from './src/theme'

// The presentational leaves. `src/ui/index.ts` is the list; spelling it twice here would be a
// second copy to keep in sync, and every name on it has a caller — a row kind, or the UI-kit page.
export * from './src/ui'