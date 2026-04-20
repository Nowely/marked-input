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

// Pin font stack + fixed layout metrics on EVERY element during VRT only.
//
// Selector `:root *` has specificity (0,1,1) — this is deliberately higher
// than bare `*` (0,0,0) so we beat any `.MuiTypography-root !important` or
// similar high-importance rules that UI libraries ship in their component
// CSS. Among !important rules the cascade is resolved by specificity first;
// if we used `*` we'd lose to `.someClass !important` (0,1,0). With `:root *`
// we stay one notch higher (the `:root` pseudo-class adds a class-level bump).
//
// Why universal `*` inside (and not a hand-picked whitelist `html, body,
// .ant-tag, .rs-tag, …`): a whitelist silently misses any new component
// introduced later (new AntD/MUI/Rsuite chip, custom wrapper). The VRT runner
// is isolated, so it's safe to blast everything and guarantee full coverage.
//
// Font stack `'Inter Variable', 'Noto Sans Variable'` — no generic fallback:
// if both packages somehow fail to load, tests should mismatch visibly
// instead of silently falling back to `-apple-system` / `DejaVu Sans`.
// `await document.fonts.ready` in the specs is the hard sync point that
// guarantees both are loaded before any screenshot is captured.
//
// `line-height: 1.5` (not `normal`): `normal` is resolved by Chromium from
// the font's OS/2 metrics, and Linux vs macOS Chromium disagree on whether
// to use `sTypoAscender/Descender` or `sWinAscent/Descent`. The choice flips
// line-box height by 1–2 px and accumulates in nested inline-block buttons
// (`Nested/InteractiveNested` is the canonical offender). Explicit `1.5`
// produces identical line boxes on both platforms.
//
// `vertical-align: top` on replaced inline elements: eliminates the font-
// descender whitespace below inline-block baselines (classic "extra 4 px
// below img" quirk) that would otherwise reintroduce drift on nested
// inline buttons.
//
// `text-rendering: geometricPrecision`: asks Skia for the ideal
// glyph-metrics path (no hint-driven pixel snapping) so glyph advance
// widths match across platforms — keeps text wrap points identical.
if (typeof document !== 'undefined') {
	const style = document.createElement('style')
	style.textContent = `
		:root, :root * {
			font-family: 'Inter Variable', 'Noto Sans Variable' !important;
			line-height: 1.5 !important;
			text-rendering: geometricPrecision !important;
		}
		:root button, :root img, :root input, :root select, :root textarea, :root svg {
			vertical-align: top !important;
		}
		/* Kill focus-ring decorations during VRT. Chromium's \`:focus-visible\`
		   heuristic differs between macOS (no ring after programmatic focus)
		   and Linux (ring shown), which was producing +2 px cyan outlines in
		   \`Nested/InteractiveNested\` that no pixel tolerance could mask.
		   The specs also explicitly \`.blur()\` the active element before
		   screenshot; this rule is belt-and-suspenders for any element that
		   re-focuses itself (inputs that auto-focus during animation, etc.). */
		:root *:focus, :root *:focus-visible, :root *:focus-within {
			outline: 0 none transparent !important;
			box-shadow: none !important;
		}
	`
	document.head.appendChild(style)
}