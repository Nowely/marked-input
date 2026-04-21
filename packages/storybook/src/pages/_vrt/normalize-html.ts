// Serialized-innerHTML normalization for cross-OS/cross-run structural snapshots.
// Each rule targets a specific source of non-determinism that appears in VRT
// baselines; see `normalize-html.spec.ts` for the full contract.
export function normalizeHtml(html: string): string {
	return (
		html
			// React `useId()` outputs: `:r0:`, `:rab:`, legacy `«ra»`.
			// These are regenerated per render in document-creation order, so they
			// flip whenever any component upstream mounts a new hook.
			.replace(/:r[a-z0-9]+:/g, '__ID__')
			.replace(/«r[a-z0-9]+»/g, '__ID__')
			// Vue scoped-style hashes: `data-v-<8 hex>`. Recomputed on SFC recompile.
			.replace(/\bdata-v-[a-f0-9]{8}\b/g, 'data-v-__HASH__')
			// Collapse inline style whitespace. React/Vue emit inconsistent spacing
			// (`"color:red"` vs `"color: red"`) depending on prop shape.
			.replace(/style="([^"]*)"/g, (_, s: string) => `style="${s.replace(/\s+/g, ' ').trim()}"`)
			// Inter-tag whitespace is JSX-formatting leakage, semantically irrelevant.
			.replace(/>\s+</g, '><')
			.trim()
	)
}