import {composeStories} from '@storybook/react'
import {render} from '@testing-library/react'
import * as BaseStories from 'storybook/stories/Base.stories'
import * as DynamicStories from 'storybook/stories/Dynamic.stories'
import * as MaterialStories from 'storybook/stories/Material.stories'
import * as OverlayStories from 'storybook/stories/Overlay.stories'
import {bench, describe} from 'vitest'

const stories = [
	...Object.entries(composeStories(BaseStories)),
	...Object.entries(composeStories(DynamicStories)),
	...Object.entries(composeStories(OverlayStories)),
	...Object.entries(composeStories(MaterialStories))
]

describe('render stories', () =>
	stories.forEach(([name, Story]) => {
		bench(name, (() => {
			render(<Story/>)
		}), {time: 1000})
	}))
