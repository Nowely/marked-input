import {composeStories} from '@storybook/react-vite'
import * as AntStories from '../../storybook/stories/Ant.stories'
import * as BaseStories from '../../storybook/stories/Base.stories'
import * as DynamicStories from '../../storybook/stories/Dynamic.stories'
import * as MaterialStories from '../../storybook/stories/Material.stories'
import * as OverlayStories from '../../storybook/stories/Overlay.stories'
import * as RsuiteStories from '../../storybook/stories/Rsuite.stories'

export const antStories = composeStories(AntStories)
export const baseStories = composeStories(BaseStories)
export const dynamicStories = composeStories(DynamicStories)
export const materialStories = composeStories(MaterialStories)
export const overlayStories = composeStories(OverlayStories)
export const rsuiteStories = composeStories(RsuiteStories)

export const Story = {
	Ant: antStories,
	Base: baseStories,
	Dynamic: dynamicStories,
	Material: materialStories,
	Overlay: overlayStories,
	Rsuite: rsuiteStories,
}