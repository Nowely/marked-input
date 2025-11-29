import type {ComponentType} from 'react'
import {composeStories} from '@storybook/react-vite'
import * as AntStories from '../../src/pages/Ant/Ant.stories'
import * as BaseStories from '../../src/pages/Base/Base.stories'
import * as DynamicStories from '../../src/pages/Dynamic/Dynamic.stories'
import * as MaterialStories from '../../src/pages/Material/Material.stories'
import * as OverlayStories from '../../src/pages/Overlay/Overlay.stories'
import * as RsuiteStories from '../../src/pages/Rsuite/Rsuite.stories'

type ComposedStories = Record<string, ComponentType<any>>

export const Story: Record<string, ComposedStories> = {
	Ant: composeStories(AntStories),
	Base: composeStories(BaseStories),
	Dynamic: composeStories(DynamicStories),
	Material: composeStories(MaterialStories),
	Overlay: composeStories(OverlayStories),
	Rsuite: composeStories(RsuiteStories),
}
