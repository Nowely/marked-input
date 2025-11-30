import {render} from '@testing-library/react'
import {composeStories} from '@storybook/react-vite'
import {describe, expect, it} from 'vitest'
import * as AntStories from './Ant/Ant.stories'
import * as BaseStories from './Base/Base.stories'
import * as DynamicStories from './Dynamic/Dynamic.stories'
import * as MaterialStories from './Material/Material.stories'
import * as OverlayStories from './Overlay/Overlay.stories'
import * as RsuiteStories from './Rsuite/Rsuite.stories'

const Story = {
	Ant: composeStories(AntStories),
	Base: composeStories(BaseStories),
	Dynamic: composeStories(DynamicStories),
	Material: composeStories(MaterialStories),
	Overlay: composeStories(OverlayStories),
	Rsuite: composeStories(RsuiteStories),
}

//TODO correct type
const getTests = ([name, Story]: [string, any]) =>
	it(`Story ${name}`, async () => {
		const {container} = render(<Story />)
		expect(container.textContent?.length).toBeTruthy()
	})

describe('Component: stories', () => {
	describe.todo('Ant stories', () => {
		Object.entries(Story.Ant).map(getTests)
	})

	describe('Base stories', () => {
		Object.entries(Story.Base).map(getTests)
	})

	describe('Dynamic stories', () => {
		Object.entries(Story.Dynamic).map(getTests)
	})

	//TODO invoke 'The operation was aborted' error
	describe.todo('Material stories', () => {
		Object.entries(Story.Material).map(getTests)
	})

	describe('Overlay stories', () => {
		Object.entries(Story.Overlay).map(getTests)
	})

	describe.todo('Rsuite stories', () => {
		Object.entries(Story.Rsuite).map(getTests)
	})
})

