import {DEFAULT_MARKUP, DEFAULT_OVERLAY_TRIGGER} from '@markput/core'
import {Option} from './types'

/**
 * React-specific default options for MarkedInput.
 * Extends core DEFAULT_OPTIONS with framework-specific configuration:
 * - Includes trigger configuration via slotProps.overlay.trigger
 * - Provides empty data array for overlay suggestions
 *
 * Architecture:
 * - Core maintains framework-agnostic DEFAULT_OPTIONS (markup only)
 * - React layer extends with trigger and overlay configuration
 * - This keeps separation of concerns: core focuses on parsing, React on UI
 */
export const DEFAULT_OPTIONS: Option[] = [
	{
		markup: DEFAULT_MARKUP,
		slotProps: {
			overlay: {
				trigger: DEFAULT_OVERLAY_TRIGGER,
				data: [],
			},
		},
	},
]
