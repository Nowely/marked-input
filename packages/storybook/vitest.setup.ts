// Two bundled variable fonts for cross-OS determinism:
//
// 1. `@fontsource-variable/inter` — one variable woff2 covering weight axis
//    100-900. A single-weight import would let Chromium synthesise "faux
//    bold" for weights it doesn't have (Ant uses 600, Rsuite 500), and
//    faux-bold is rasterised differently per platform → drift. Variable
//    font = zero synthesis = deterministic glyphs.
// 2. `@fontsource-variable/noto-sans` — fallback for glyphs Inter doesn't
//    cover. Inter ships Latin / Latin-ext / Cyrillic / Greek / Vietnamese
//    only, so anything outside that range (arrows → ← ⇒, check-marks ✓ ☐,
//    box-drawing, symbols used in `TodoList` / `ComplexMarkdown` / `Nested`
//    stories) falls back. Without a bundled fallback, macOS Chromium picks
//    `Apple Symbols` and Linux Chromium picks `DejaVu Sans` / `Symbola`,
//    which have different metrics → ±1-5 px dimension drift per story.
//    Bundling the fallback eliminates that divergence.
//
// Both packages are imported ONLY inside Vitest (not in `storybook dev` /
// `storybook build`), so live Storybook keeps the real system-font
// rendering a user would see.
import '@fontsource-variable/inter/index.css'
import '@fontsource-variable/noto-sans/index.css'
import {setProjectAnnotations as setReactAnnotations} from '@storybook/react-vite'
import {setProjectAnnotations as setVueAnnotations} from '@storybook/vue3-vite'

import preview from './.storybook/preview'

if (process.env.FRAMEWORK === 'react') {
	setReactAnnotations(preview)
} else {
	setVueAnnotations(preview)
}

// Pin font stack + fixed layout metrics + kill interaction states during VRT.
//
// CRITICAL: all rules are scoped under `html[data-vrt]` so they activate ONLY
// when the VRT specs opt in via `document.documentElement.setAttribute('data-vrt', '')`.
// Without this scoping, functional specs (Drag.react.spec.tsx, Selection.react.spec.tsx,
// …) would inherit `pointer-events: none` and break — clicks/drags would not
// dispatch to their targets.
//
// Specificity `html[data-vrt] *` = (0,1,1) — beats any `.MuiTypography-root !important`
// (0,1,0) that UI libraries ship. Bare `*` would lose the cascade to them.
//
// Font stack `'Inter Variable', 'Noto Sans Variable'` — no generic fallback so
// a font-load failure surfaces as an obvious baseline mismatch instead of
// silently falling back to `-apple-system` (macOS) / `DejaVu Sans` (Linux)
// and reintroducing the drift we're trying to eliminate. `await document.fonts.ready`
// in the specs is the hard sync point that guarantees both are loaded.
//
// `line-height: 1.5` (not `normal`): `normal` is resolved by Chromium from
// the font's OS/2 metrics, and Linux vs macOS Chromium disagree on whether
// to use `sTypoAscender/Descender` or `sWinAscent/Descent`. Explicit `1.5`
// forces identical line boxes.
//
// `vertical-align: top` on replaced elements: eliminates the font-descender
// whitespace below inline-block baselines (classic "extra 4 px below img" quirk).
//
// `text-rendering: geometricPrecision`: asks Skia for the ideal glyph-metrics
// path so glyph advance widths match across platforms.
//
// `pointer-events: none`: prevents virtual cursors (Playwright places the
// cursor at a default position per OS, often differing) from triggering
// `:hover` / `onMouseEnter` handlers. Without this, `Nested/InteractiveNested`
// toggled `isHighlighted=true` on Linux because the cursor landed inside the
// outer button, bumping its border from 1 px to 2 px (+2 px on the screenshot).
// macOS didn't trigger it because its cursor landed outside. This pair of
// rules is THE fix for that dimension drift.
//
// `transition: none` + `animation: none`: prevents Vitest's "stable-screenshot"
// retry loop from timing out on in-flight 0.2s transitions (the `Matcher did
// not succeed in time` errors were mostly this).
//
// `:focus*` rules: belt-and-suspenders against `:focus-visible` decorations
// for any element that re-focuses itself after the specs' `.blur()` call.
if (typeof document !== 'undefined') {
	const style = document.createElement('style')
	style.textContent = `
		html[data-vrt], html[data-vrt] * {
			font-family: 'Inter Variable', 'Noto Sans Variable' !important;
			line-height: 1.5 !important;
			text-rendering: geometricPrecision !important;
			pointer-events: none !important;
			transition: none !important;
			animation: none !important;
		}
		html[data-vrt] button, html[data-vrt] img, html[data-vrt] input,
		html[data-vrt] select, html[data-vrt] textarea, html[data-vrt] svg {
			vertical-align: top !important;
		}
		html[data-vrt] *:focus, html[data-vrt] *:focus-visible, html[data-vrt] *:focus-within {
			outline: 0 none transparent !important;
			box-shadow: none !important;
		}
	`
	document.head.appendChild(style)
}