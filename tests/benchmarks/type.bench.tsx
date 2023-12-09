import {render, RenderResult} from '@testing-library/react'
import user from '@testing-library/user-event'
import {createMarkedInput} from 'rc-marked-input'
import {useState} from 'react'
import {bench, describe, expect} from 'vitest'
import {Markups_16} from './consts'
import {TestTexts} from './TestTexts'
import {Button} from '../../storybook/assets/Button'
import '@testing-library/jest-dom/vitest'

const TestableA1 = createTestable(1)
const TestableA8 = createTestable(8)
const TestableA16 = createTestable(16)

describe('text render bench', async () => {
	bench('5a1', ((): any => render(<TestableA1/>)), {time: 1000})
	bench('50a8', ((): any => render(<TestableA8/>)), {time: 1000})
	bench('500a16', ((): any => render(<TestableA16/>)), {time: 1000})
})

describe.skip('type bench', async () => {
	let testable: RenderResult
	let span: Element

	bench('type text a1', async () => {
		await user.type(span, '1211111')
	}, {
		time: 1000,
		async setup(task, mode) {
			testable = render(<TestableA1/>)
			span = testable.container.querySelectorAll('span')[0]
		}
	})

	bench('type text a8', async () => {
		await user.type(span, '1211111')
	}, {
		time: 1000,
		async setup(task, mode) {
			testable = render(<TestableA8/>)
			span = testable.container.querySelectorAll('span')[0]
		}
	})

	bench('type text a16', async () => {
		await user.type(span, '1211111')
	}, {
		time: 1000,
		async setup(task, mode) {
			testable = render(<TestableA16/>)
			span = testable.container.querySelectorAll('span')[0]
		}
	})

	bench('type mark a1', async () => {
		await user.type(span, '<h1>Vulgus</h1>')
	}, {
		time: 1000,
		async setup(task, mode) {
			testable = render(<TestableA1/>)
			span = testable.container.querySelectorAll('span')[0]
		}
	})

	bench('type mark a8', async () => {
		await user.type(span, '<h1>Vulgus</h1>')
	}, {
		time: 1000,
		async setup(task, mode) {
			testable = render(<TestableA8/>)
			span = testable.container.querySelectorAll('span')[0]
		}
	})

	bench('type mark a16', async () => {
		await user.type(span, '<h1>Vulgus</h1>')
	}, {
		time: 1000,
		async setup(task, mode) {
			testable = render(<TestableA16/>)
			span = testable.container.querySelectorAll('span')[0]
		}
	})
})


function createTestable(annotationCount: 1 | 8 | 16) {
	const MarkedInput = createMarkedInput({
		Mark: props => <span>{props.label}</span>,
		options: [{
			markup: Markups_16[annotationCount - 1],
		}],
	})

	let initialText: string
	switch (annotationCount) {
		case 1:
			initialText = TestTexts['5a1']
			break
		case 8:
			initialText = TestTexts['50a8']
			break
		case 16:
			initialText = TestTexts['500a16']
			break

	}

	return () => {
		const [value, setValue] = useState(initialText)
		return <MarkedInput value={value} onChange={setValue}/>
	}
}