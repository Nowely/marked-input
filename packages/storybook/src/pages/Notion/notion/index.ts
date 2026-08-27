/**
 * THE NOTION VOCABULARY — a Notion-shaped editor written as markput OPTIONS and COMPONENTS.
 *
 * The whole of it is `{markup, row}` for a block kind, `{markup, Mark}` for an inline one, and the
 * components those two name. IT RESOLVES TO ONE PAINT PER PROJECT — `options.tsx` under react,
 * `options.vue.ts` under vue — and each imports one published adapter, that adapter's framework and
 * nothing else: no core internal, no `store.edit`, no `store.tokens`. The vocabulary both of them
 * read imports nothing at all. `boundary.spec.ts` one directory up is what makes that a check rather
 * than a claim.
 *
 * It lived as the private workspace package `@markput/notion` until 2026-08-26. A real published
 * package is a phase of its own; until then this is a consumer of the published API that happens
 * to sit inside the repo that drives it.
 */

// Every kind by name beside the array: a consumer that adds a trigger to one — the `@` picker
// rides on `mention` — needs to name it, and a curated subset would be a second list to keep.
export * from './options'
export {NOTION_THEME, theme} from './theme'

// The presentational leaves. `ui/index.ts` is the list; spelling it twice here would be a
// second copy to keep in sync, and every name on it has a caller — a row kind, or the UI-kit page.
export * from './ui'