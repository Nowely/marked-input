import '@testing-library/jest-dom'
import {render} from '@testing-library/react'
import {describe, expect, it} from 'vitest'
import {Story} from '../../stories'

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

