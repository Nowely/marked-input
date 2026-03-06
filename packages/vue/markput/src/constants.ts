import {DEFAULT_MARKUP, DEFAULT_OVERLAY_TRIGGER} from '@markput/core'

import type {Option} from './types'

export const DEFAULT_OPTIONS: Option[] = [
	{
		markup: DEFAULT_MARKUP,
		overlay: {
			trigger: DEFAULT_OVERLAY_TRIGGER,
			data: [],
		},
	},
]