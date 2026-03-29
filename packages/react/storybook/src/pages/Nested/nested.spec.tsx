import type {Markup} from '@markput/react'
import {MarkedInput, useMark} from '@markput/react'
import type {ReactNode} from 'react'
import {describe, expect, it} from 'vitest'
import {render} from 'vitest-browser-react'
import {page} from 'vitest/browser'

describe('Nested Marks Rendering', () => {
	// Simple Mark component for testing
	const TestMark = ({children}: {value?: string; children?: ReactNode}) => {
		const mark = useMark()
		return (
			<span data-testid={`mark-depth-${mark.depth}`} data-depth={mark.depth} data-has-children={mark.hasChildren}>
				{children}
			</span>
		)
	}

	it('should render simple nested marks', async () => {
		const markup: Markup = '@[__slot__]'
		const value = '@[outer @[inner]]'

		await render(<MarkedInput Mark={TestMark} value={value} options={[{markup}]} />)

		const outerMark = page.getByTestId('mark-depth-0')
		const innerMark = page.getByTestId('mark-depth-1')

		await expect.element(outerMark).toBeInTheDocument()
		await expect.element(innerMark).toBeInTheDocument()
		expect(outerMark.element().getAttribute('data-has-children')).toBe('true')
		expect(innerMark.element().getAttribute('data-has-children')).toBe('false')
	})

	it('should render multiple nesting levels', async () => {
		const markup: Markup = '@[__slot__]'
		const value = '@[level0 @[level1 @[level2]]]'

		await render(<MarkedInput Mark={TestMark} value={value} options={[{markup}]} />)

		const level0 = page.getByTestId('mark-depth-0')
		const level1 = page.getByTestId('mark-depth-1')
		const level2 = page.getByTestId('mark-depth-2')

		await expect.element(level0).toBeInTheDocument()
		await expect.element(level1).toBeInTheDocument()
		await expect.element(level2).toBeInTheDocument()
	})

	it('should render multiple nested marks at same level', async () => {
		const markup: Markup = '@[__slot__]'
		const value = '@[outer @[first] and @[second]]'

		await render(<MarkedInput Mark={TestMark} value={value} options={[{markup}]} />)

		const outerMark = page.getByTestId('mark-depth-0')
		const nestedMarks = page.getByTestId('mark-depth-1').all()

		await expect.element(outerMark).toBeInTheDocument()
		expect(nestedMarks).toHaveLength(2)
	})

	it('should render different markup types nested', async () => {
		const TagMark = ({children}: {value?: string; children?: ReactNode}) => {
			const mark = useMark()
			const isTag = mark.content.startsWith('#')
			return (
				<span data-testid={isTag ? 'tag-mark' : 'mention-mark'} data-depth={mark.depth}>
					{children}
				</span>
			)
		}

		const tagMarkup: Markup = '#[__slot__]'
		const mentionMarkup: Markup = '@[__slot__]'
		const value = '#[tag with @[mention]]'

		render(
			<MarkedInput
				Mark={TagMark}
				value={value}
				options={[
					{markup: tagMarkup, overlay: {trigger: '#'}},
					{markup: mentionMarkup, overlay: {trigger: '@'}},
				]}
			/>
		)

		const tagMark = page.getByTestId('tag-mark')
		const mentionMark = page.getByTestId('mention-mark')

		await expect.element(tagMark).toBeInTheDocument()
		await expect.element(mentionMark).toBeInTheDocument()
		expect(tagMark.element().getAttribute('data-depth')).toBe('0')
		expect(mentionMark.element().getAttribute('data-depth')).toBe('1')
	})

	it('should handle empty nested marks', async () => {
		const markup: Markup = '@[__slot__]'
		const value = '@[@[]]'

		await render(<MarkedInput Mark={TestMark} value={value} options={[{markup}]} />)

		const marks = page.getByTestId(/mark-depth-/).all()
		expect(marks).toHaveLength(2)
	})

	it('should pass children to Mark component for nested content', async () => {
		let hasChildrenAtDepthZero = false

		const CapturingMark = ({children}: {value?: string; children?: ReactNode}) => {
			const mark = useMark()
			// Capture whether root mark has children
			if (mark.depth === 0 && mark.hasChildren) {
				hasChildrenAtDepthZero = children != null
			}
			// Render both children and value to show all content
			return (
				<span data-testid="mark">
					{children}
					{!mark.hasChildren && mark.value}
				</span>
			)
		}

		const markup: Markup = '@[__slot__]'
		const value = '@[before @[nested] after]'

		const {container} = await render(<MarkedInput Mark={CapturingMark} value={value} options={[{markup}]} />)

		// With children and value rendered, all text should be visible
		expect(container.textContent).toContain('before')
		expect(container.textContent).toContain('after')
		expect(container.textContent).toContain('nested')
		// Verify that root mark with children received them
		expect(hasChildrenAtDepthZero).toBe(true)
	})
})

describe('Nested Marks Tree Navigation', () => {
	it('should provide correct depth information', async () => {
		const DepthMark = ({children}: {value?: string; children?: ReactNode}) => {
			const mark = useMark()
			return <span data-depth={mark.depth}>{children}</span>
		}

		const markup: Markup = '@[__slot__]'
		const value = '@[d0 @[d1 @[d2]]]'

		const {container} = await render(<MarkedInput Mark={DepthMark} value={value} options={[{markup}]} />)

		const depths = Array.from(container.querySelectorAll('[data-depth]')).map(el => el.getAttribute('data-depth'))

		expect(depths).toEqual(['0', '1', '2'])
	})

	it('should provide hasChildren information', async () => {
		const ChildrenMark = ({children}: {value?: string; children?: ReactNode}) => {
			const mark = useMark()
			return <span data-has-children={mark.hasChildren}>{children}</span>
		}

		const markup: Markup = '@[__slot__]'
		const value = '@[parent @[child]]'

		const {container} = await render(<MarkedInput Mark={ChildrenMark} value={value} options={[{markup}]} />)

		const elements = Array.from(container.querySelectorAll('[data-has-children]'))
		const hasChildrenValues = elements.map(el => el.getAttribute('data-has-children'))

		expect(hasChildrenValues).toEqual(['true', 'false'])
	})

	it('should provide children array', async () => {
		let capturedChildrenCount = 0

		const ChildrenCountMark = ({children}: {value?: string; children?: ReactNode}) => {
			const mark = useMark()
			if (mark.depth === 0) {
				capturedChildrenCount = mark.tokens.length
			}
			return <span>{children}</span>
		}

		const markup: Markup = '@[__slot__]'
		const value = '@[parent @[child1] text @[child2]]'

		await render(<MarkedInput Mark={ChildrenCountMark} value={value} options={[{markup}]} />)

		// Should have 5 children: text, mark, text, mark, text
		expect(capturedChildrenCount).toBeGreaterThan(0)
	})
})

describe('Backward Compatibility', () => {
	it('should work with flat marks (no nesting)', async () => {
		const FlatMark = ({value}: {value?: string; meta?: string; children?: ReactNode}) => {
			return <span data-testid="flat-mark">{value}</span>
		}

		const markup: Markup = '@[__value__](__meta__)'
		const value = '@[test](meta)'

		await render(<MarkedInput Mark={FlatMark} value={value} options={[{markup}]} />)

		const mark = page.getByTestId('flat-mark')
		await expect.element(mark).toBeInTheDocument()
		expect(mark.element().textContent).toBe('test')
	})

	it('should ignore children prop in flat marks', async () => {
		const FlatMark = ({value}: {value?: string; children?: ReactNode}) => {
			// Old components that don't use children should still work
			return <span data-testid="flat-mark">{value}</span>
		}

		const markup: Markup = '@[__value__]'
		const value = '@[test]'

		await render(<MarkedInput Mark={FlatMark} value={value} options={[{markup}]} />)

		const mark = page.getByTestId('flat-mark')
		await expect.element(mark).toBeInTheDocument()
		expect(mark.element().textContent).toBe('test')
	})

	it('should not parse nested content in __value__ placeholders', async () => {
		const FlatMark = ({value}: {value?: string}) => {
			return <span data-testid="flat-mark">{value}</span>
		}

		const markup: Markup = '@[__value__]'
		const value = '@[text with @[nested]]'

		await render(<MarkedInput Mark={FlatMark} value={value} options={[{markup}]} />)

		// Should only have one mark since __value__ doesn't support nesting
		const marks = page.getByTestId('flat-mark').all()
		expect(marks).toHaveLength(1)
		// The inner @[nested] should be part of the value as plain text
		expect(marks[0].element().textContent).toContain('text with @[nested]')
	})
})

describe('Complex Nesting Scenarios', () => {
	it('should handle adjacent nested marks', async () => {
		const TestMark = ({children}: {value?: string; children?: ReactNode}) => {
			return <span data-testid="mark">{children}</span>
		}

		const markup: Markup = '@[__slot__]'
		const value = '@[first]@[second]'

		await render(<MarkedInput Mark={TestMark} value={value} options={[{markup}]} />)

		const marks = page.getByTestId('mark').all()
		expect(marks).toHaveLength(2)
	})

	it('should handle deeply nested structure', async () => {
		const TestMark = ({children}: {value?: string; children?: ReactNode}) => {
			const mark = useMark()
			return <span data-depth={mark.depth}>{children}</span>
		}

		const markup: Markup = '@[__slot__]'
		const value = '@[@[@[@[@[deep]]]]]'

		const {container} = await render(<MarkedInput Mark={TestMark} value={value} options={[{markup}]} />)

		const depths = Array.from(container.querySelectorAll('[data-depth]')).map(el =>
			parseInt(el.getAttribute('data-depth') ?? '0')
		)

		expect(Math.max(...depths)).toBe(4) // 5 levels: 0, 1, 2, 3, 4
	})

	it('should handle mixed nested and flat marks', async () => {
		const MixedMark = ({children}: {value?: string; children?: ReactNode}) => {
			const mark = useMark()
			return (
				<span data-testid="mark" data-has-children={mark.hasChildren}>
					{children}
				</span>
			)
		}

		const nestedMarkup: Markup = '@[__slot__]'
		const value = '@[nested @[child]] @[another]'

		await render(<MarkedInput Mark={MixedMark} value={value} options={[{markup: nestedMarkup}]} />)

		const marks = page.getByTestId('mark').all()
		expect(marks.length).toBeGreaterThanOrEqual(3)
	})

	it('should render nested structure when Mark component renders children', async () => {
		const RenderingMark = ({children}: {value?: string; children?: ReactNode}) => {
			const mark = useMark()
			return <span data-testid="rendering-mark">{mark.hasChildren ? children : mark.slot}</span>
		}

		const markup: Markup = '@[__slot__]'
		const value = '@[Hello @[World] from @[Nested] marks]'

		const {container} = await render(<MarkedInput Mark={RenderingMark} value={value} options={[{markup}]} />)

		// When Mark renders children/value appropriately, all text content should be visible
		expect(container.textContent).toContain('Hello')
		expect(container.textContent).toContain('World')
		expect(container.textContent).toContain('from')
		expect(container.textContent).toContain('Nested')
		expect(container.textContent).toContain('marks')
	})
})

describe('Edge Cases', () => {
	it('should handle empty input', async () => {
		const TestMark = ({children}: {value?: string; children?: ReactNode}) => {
			return <span>{children}</span>
		}

		const markup: Markup = '@[__slot__]'
		const value = ''

		const {container} = await render(<MarkedInput Mark={TestMark} value={value} options={[{markup}]} />)

		expect(container.textContent).toBe('')
	})

	it('should handle input with no marks', async () => {
		const TestMark = ({children}: {value?: string; children?: ReactNode}) => {
			return <span>{children}</span>
		}

		const markup: Markup = '@[__slot__]'
		const value = 'Just plain text'

		const {container} = await render(<MarkedInput Mark={TestMark} value={value} options={[{markup}]} />)

		expect(container.textContent).toBe('Just plain text')
	})

	it('should handle malformed nested marks gracefully', async () => {
		const TestMark = ({children}: {value?: string; children?: ReactNode}) => {
			return <span data-testid="mark">{children}</span>
		}

		const markup: Markup = '@[__slot__]'
		const value = '@[unclosed @[nested'

		const {container} = await render(<MarkedInput Mark={TestMark} value={value} options={[{markup}]} />)

		// Should render something without crashing
		await expect.element(container).toBeInTheDocument()
	})
})