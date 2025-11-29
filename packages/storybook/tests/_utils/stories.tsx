import type {ComponentType} from 'react'
import {composeStories} from '@storybook/react-vite'
import * as AntStories from '../../src/stories/Ant.stories'
import * as BaseStories from '../../src/stories/Base.stories'
import * as DynamicStories from '../../src/stories/Dynamic.stories'
import * as MaterialStories from '../../src/stories/Material.stories'
import * as OverlayStories from '../../src/stories/Overlay.stories'
import * as RsuiteStories from '../../src/stories/Rsuite.stories'

type ComposedStories = Record<string, ComponentType<any>>

export const Story: Record<string, ComposedStories> = {
	Ant: composeStories(AntStories),
	Base: composeStories(BaseStories),
	Dynamic: composeStories(DynamicStories),
	Material: composeStories(MaterialStories),
	Overlay: composeStories(OverlayStories),
	Rsuite: composeStories(RsuiteStories),
}

