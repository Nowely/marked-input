import {composeStories} from '@storybook/react-vite'
import * as AntStories from '../../storybook/stories/Ant.stories'
import * as BaseStories from '../../storybook/stories/Base.stories'
import * as DynamicStories from '../../storybook/stories/Dynamic.stories'
import * as MaterialStories from '../../storybook/stories/Material.stories'
import * as OverlayStories from '../../storybook/stories/Overlay.stories'
import * as RsuiteStories from '../../storybook/stories/Rsuite.stories'

export const Story = {
	Ant: composeStories(AntStories),
	Base: composeStories(BaseStories),
	Dynamic: composeStories(DynamicStories),
	Material: composeStories(MaterialStories),
	Overlay: composeStories(OverlayStories),
	Rsuite: composeStories(RsuiteStories),
}