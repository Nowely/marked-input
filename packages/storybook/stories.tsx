import {composeStories} from '@storybook/react-vite'
import * as AntStories from './stories/Ant.stories'
import * as BaseStories from './stories/Base.stories'
import * as DynamicStories from './stories/Dynamic.stories'
import * as MaterialStories from './stories/Material.stories'
import * as OverlayStories from './stories/Overlay.stories'
import * as RsuiteStories from './stories/Rsuite.stories'

export const Story = {
	Ant: composeStories(AntStories),
	Base: composeStories(BaseStories),
	Dynamic: composeStories(DynamicStories),
	Material: composeStories(MaterialStories),
	Overlay: composeStories(OverlayStories),
	Rsuite: composeStories(RsuiteStories),
}
