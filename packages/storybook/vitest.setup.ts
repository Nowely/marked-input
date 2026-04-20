// `@fontsource-variable/inter` — one variable woff2 covering every weight 100-900.
// A single-weight import would let Chromium synthesise "faux bold" for weights it
// doesn't have (Ant uses 600, Rsuite 500), and faux-bold differs per platform →
// drift. Variable font = zero synthesis = deterministic glyphs.
//
// This file runs ONLY inside Vitest (not in `storybook dev` / `storybook build`),
// so live Storybook keeps the real system-font rendering a user would see.
import '@fontsource-variable/inter'
import {setProjectAnnotations as setReactAnnotations} from '@storybook/react-vite'
import {setProjectAnnotations as setVueAnnotations} from '@storybook/vue3-vite'

import preview from './.storybook/preview'

if (process.env.FRAMEWORK === 'react') {
	setReactAnnotations(preview)
} else {
	setVueAnnotations(preview)
}

// Pin Inter Variable + fixed layout metrics on EVERY element.
//
// Why `*` (not a hand-picked whitelist): any new UI library (AntD chip, MUI
// Chip, future Rsuite component, …) introduces its own `font-family` /
// `line-height` via component CSS, and a whitelist would silently miss them
// → drift creeps back on every new story. Universal `!important` covers them
// all — this is acceptable because this file only runs in the VRT runner,
// not in live Storybook.
//
// Why no fallback (`, sans-serif`): if Inter fails to load, the test SHOULD
// fail visibly rather than quietly fall back to `-apple-system` on macOS /
// `DejaVu Sans` on Linux (the exact drift we're trying to eliminate). The
// `await document.fonts.ready` in the VRT specs makes this a hard sync point.
//
// Why `line-height: 1.5` (and not `normal`): `normal` is resolved by Chromium
// from the font's OS/2 metrics, and Linux + macOS Chromium disagree on whether
// to use `sTypoAscender/Descender` or `sWinAscent/Descent`. The choice flips
// line-box height by 1–2 px, and nested inline-block buttons (see
// `Nested/InteractiveNested`) accumulate that into a hard dimension mismatch
// that pixel tolerance cannot mask. Explicit `1.5` forces identical line boxes.
//
// Why `vertical-align: top` on inline-block: eliminates the font-descender
// whitespace below inline-block baselines (classic "extra 4 px below img"
// quirk), which would otherwise reintroduce drift on nested inline buttons.
//
// `text-rendering: geometricPrecision` asks Skia for the ideal glyph-metrics
// path (no hint-driven pixel snapping) so glyph advance widths match across
// platforms — this is what keeps text-wrap points identical.
if (typeof document !== 'undefined') {
	const style = document.createElement('style')
	style.textContent = `
		* {
			font-family: 'Inter Variable' !important;
			line-height: 1.5 !important;
			text-rendering: geometricPrecision !important;
		}
		button, img, input, select, textarea, svg {
			vertical-align: top !important;
		}
	`
	document.head.appendChild(style)
}