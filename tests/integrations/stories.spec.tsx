import '@testing-library/jest-dom'
import {render} from '@testing-library/react'
import {describe, expect} from 'vitest'
import {
	antStories,
	baseStories,
	dynamicStories,
	materialStories,
	overlayStories,
	rsuiteStories
} from '../_utils/stories'


const getTests = ([name, Story]: [any, any]) =>
	it(`Story ${name}`, async () => {
		const {container} = render(<Story/>)
		expect(container.textContent?.length).toBeTruthy()
	})

describe('Component: stories', () => {
	describe.todo('Ant stories', () => {
		Object.entries(antStories).map(getTests)
	})

	describe('Base stories', () => {
		Object.entries(baseStories).map(getTests)
	})

	describe('Dynamic stories', () => {
		Object.entries(dynamicStories).map(getTests)
	})

	describe('Material stories', () => {
		Object.entries(materialStories).map(getTests)
	})

	describe('Overlay stories', () => {
		Object.entries(overlayStories).map(getTests)
	})

	describe.todo('Rsuite stories', () => {
		Object.entries(rsuiteStories).map(getTests)
	})
})
