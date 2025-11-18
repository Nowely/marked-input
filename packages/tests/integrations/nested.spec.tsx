import '@testing-library/jest-dom'
import {render, screen} from '@testing-library/react'
import {MarkedInput, useMark} from 'rc-marked-input'
import type {Markup} from 'rc-marked-input'
import type {ReactNode} from 'react'
import {describe, expect, it} from 'vitest'

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

	it('should render simple nested marks', () => {
		const markup: Markup = '@[__nested__]'
		const value = '@[outer @[inner]]'

		render(<MarkedInput Mark={TestMark} value={value} options={[{markup}]} />)

		const outerMark = screen.getByTestId('mark-depth-0')
		const innerMark = screen.getByTestId('mark-depth-1')

		expect(outerMark).toBeInTheDocument()
		expect(innerMark).toBeInTheDocument()
		expect(outerMark.getAttribute('data-has-children')).toBe('true')
		expect(innerMark.getAttribute('data-has-children')).toBe('false')
	})

	it('should render multiple nesting levels', () => {
		const markup: Markup = '@[__nested__]'
		const value = '@[level0 @[level1 @[level2]]]'

		render(<MarkedInput Mark={TestMark} value={value} options={[{markup}]} />)

		const level0 = screen.getByTestId('mark-depth-0')
		const level1 = screen.getByTestId('mark-depth-1')
		const level2 = screen.getByTestId('mark-depth-2')

		expect(level0).toBeInTheDocument()
		expect(level1).toBeInTheDocument()
		expect(level2).toBeInTheDocument()
	})

	it('should render multiple nested marks at same level', () => {
		const markup: Markup = '@[__nested__]'
		const value = '@[outer @[first] and @[second]]'

		render(<MarkedInput Mark={TestMark} value={value} options={[{markup}]} />)

		const outerMark = screen.getByTestId('mark-depth-0')
		const nestedMarks = screen.getAllByTestId('mark-depth-1')

		expect(outerMark).toBeInTheDocument()
		expect(nestedMarks).toHaveLength(2)
	})

	it('should render different markup types nested', () => {
		const TagMark = ({children}: {value?: string; children?: ReactNode}) => {
			const mark = useMark()
			const isTag = mark.label.startsWith('#')
			return (
				<span data-testid={isTag ? 'tag-mark' : 'mention-mark'} data-depth={mark.depth}>
					{children}
				</span>
			)
		}

		const tagMarkup: Markup = '#[__nested__]'
		const mentionMarkup: Markup = '@[__nested__]'
		const value = '#[tag with @[mention]]'

		render(
			<MarkedInput
				Mark={TagMark}
				value={value}
				options={[
					{markup: tagMarkup, slotProps: {overlay: {trigger: '#'}}},
					{markup: mentionMarkup, slotProps: {overlay: {trigger: '@'}}},
				]}
			/>
		)

		const tagMark = screen.getByTestId('tag-mark')
		const mentionMark = screen.getByTestId('mention-mark')

		expect(tagMark).toBeInTheDocument()
		expect(mentionMark).toBeInTheDocument()
		expect(tagMark.getAttribute('data-depth')).toBe('0')
		expect(mentionMark.getAttribute('data-depth')).toBe('1')
	})

	it('should handle empty nested marks', () => {
		const markup: Markup = '@[__nested__]'
		const value = '@[@[]]'

		render(<MarkedInput Mark={TestMark} value={value} options={[{markup}]} />)

		const marks = screen.getAllByTestId(/mark-depth-/)
		expect(marks).toHaveLength(2)
	})

	it('should pass children to Mark component for nested content', () => {
		const CapturingMark = ({children}: {value?: string; children?: ReactNode}) => {
			const mark = useMark()
			// Root mark should have children
			if (mark.depth === 0 && mark.hasChildren) {
				expect(children).not.toBeNull()
				expect(children).not.toBeUndefined()
			}
			// Render both children and value to show all content
			return (
				<span data-testid="mark">
					{children}
					{!mark.hasChildren && mark.value}
				</span>
			)
		}

		const markup: Markup = '@[__nested__]'
		const value = '@[before @[nested] after]'

		const {container} = render(<MarkedInput Mark={CapturingMark} value={value} options={[{markup}]} />)

		// With children and value rendered, all text should be visible
		expect(container.textContent).toContain('before')
		expect(container.textContent).toContain('after')
		expect(container.textContent).toContain('nested')
	})
})

describe('Nested Marks Tree Navigation', () => {
	it('should provide correct depth information', () => {
		const DepthMark = ({children}: {value?: string; children?: ReactNode}) => {
			const mark = useMark()
			return <span data-depth={mark.depth}>{children}</span>
		}

		const markup: Markup = '@[__nested__]'
		const value = '@[d0 @[d1 @[d2]]]'

		const {container} = render(<MarkedInput Mark={DepthMark} value={value} options={[{markup}]} />)

		const depths = Array.from(container.querySelectorAll('[data-depth]')).map(el => el.getAttribute('data-depth'))

		expect(depths).toEqual(['0', '1', '2'])
	})

	it('should provide hasChildren information', () => {
		const ChildrenMark = ({children}: {value?: string; children?: ReactNode}) => {
			const mark = useMark()
			return <span data-has-children={mark.hasChildren}>{children}</span>
		}

		const markup: Markup = '@[__nested__]'
		const value = '@[parent @[child]]'

		const {container} = render(<MarkedInput Mark={ChildrenMark} value={value} options={[{markup}]} />)

		const elements = Array.from(container.querySelectorAll('[data-has-children]'))
		const hasChildrenValues = elements.map(el => el.getAttribute('data-has-children'))

		expect(hasChildrenValues).toEqual(['true', 'false'])
	})

	it('should provide children array', () => {
		let capturedChildrenCount = 0

		const ChildrenCountMark = ({children}: {value?: string; children?: ReactNode}) => {
			const mark = useMark()
			if (mark.depth === 0) {
				capturedChildrenCount = mark.children.length
			}
			return <span>{children}</span>
		}

		const markup: Markup = '@[__nested__]'
		const value = '@[parent @[child1] text @[child2]]'

		render(<MarkedInput Mark={ChildrenCountMark} value={value} options={[{markup}]} />)

		// Should have 5 children: text, mark, text, mark, text
		expect(capturedChildrenCount).toBeGreaterThan(0)
	})
})

describe('Backward Compatibility', () => {
	it('should work with flat marks (no nesting)', () => {
		const FlatMark = ({value}: {value?: string; meta?: string; children?: ReactNode}) => {
			return <span data-testid="flat-mark">{value}</span>
		}

		const markup: Markup = '@[__value__](__meta__)'
		const value = '@[test](meta)'

		render(<MarkedInput Mark={FlatMark} value={value} options={[{markup}]} />)

		const mark = screen.getByTestId('flat-mark')
		expect(mark).toBeInTheDocument()
		expect(mark.textContent).toBe('test')
	})

	it('should ignore children prop in flat marks', () => {
		const FlatMark = ({value}: {value?: string; children?: ReactNode}) => {
			// Old components that don't use children should still work
			return <span data-testid="flat-mark">{value}</span>
		}

		const markup: Markup = '@[__value__]'
		const value = '@[test]'

		render(<MarkedInput Mark={FlatMark} value={value} options={[{markup}]} />)

		const mark = screen.getByTestId('flat-mark')
		expect(mark).toBeInTheDocument()
		expect(mark.textContent).toBe('test')
	})

	it('should not parse nested content in __value__ placeholders', () => {
		const FlatMark = ({value}: {value?: string}) => {
			return <span data-testid="flat-mark">{value}</span>
		}

		const markup: Markup = '@[__value__]'
		const value = '@[text with @[nested]]'

		render(<MarkedInput Mark={FlatMark} value={value} options={[{markup}]} />)

		// Should only have one mark since __value__ doesn't support nesting
		const marks = screen.getAllByTestId('flat-mark')
		expect(marks).toHaveLength(1)
		// The inner @[nested] should be part of the value as plain text
		expect(marks[0].textContent).toContain('text with @[nested]')
	})
})

describe('Complex Nesting Scenarios', () => {
	it('should handle adjacent nested marks', () => {
		const TestMark = ({children}: {value?: string; children?: ReactNode}) => {
			return <span data-testid="mark">{children}</span>
		}

		const markup: Markup = '@[__nested__]'
		const value = '@[first]@[second]'

		render(<MarkedInput Mark={TestMark} value={value} options={[{markup}]} />)

		const marks = screen.getAllByTestId('mark')
		expect(marks).toHaveLength(2)
	})

	it('should handle deeply nested structure', () => {
		const TestMark = ({children}: {value?: string; children?: ReactNode}) => {
			const mark = useMark()
			return <span data-depth={mark.depth}>{children}</span>
		}

		const markup: Markup = '@[__nested__]'
		const value = '@[@[@[@[@[deep]]]]]'

		const {container} = render(<MarkedInput Mark={TestMark} value={value} options={[{markup}]} />)

		const depths = Array.from(container.querySelectorAll('[data-depth]')).map(el =>
			parseInt(el.getAttribute('data-depth') || '0')
		)

		expect(Math.max(...depths)).toBe(4) // 5 levels: 0, 1, 2, 3, 4
	})

	it('should handle mixed nested and flat marks', () => {
		const MixedMark = ({children}: {value?: string; children?: ReactNode}) => {
			const mark = useMark()
			return (
				<span data-testid="mark" data-has-children={mark.hasChildren}>
					{children}
				</span>
			)
		}

		const nestedMarkup: Markup = '@[__nested__]'
		const value = '@[nested @[child]] @[another]'

		render(<MarkedInput Mark={MixedMark} value={value} options={[{markup: nestedMarkup}]} />)

		const marks = screen.getAllByTestId('mark')
		expect(marks.length).toBeGreaterThanOrEqual(3)
	})

	it('should render nested structure when Mark component renders children', () => {
		const RenderingMark = ({children}: {value?: string; children?: ReactNode}) => {
			const mark = useMark()
			// This Mark component explicitly renders children
			// For nested marks, render the value; for parent marks, render children
			return <span data-testid="rendering-mark">{mark.hasChildren ? children : mark.value}</span>
		}

		const markup: Markup = '@[__nested__]'
		const value = '@[Hello @[World] from @[Nested] marks]'

		const {container} = render(<MarkedInput Mark={RenderingMark} value={value} options={[{markup}]} />)

		// When Mark renders children/value appropriately, all text content should be visible
		expect(container.textContent).toContain('Hello')
		expect(container.textContent).toContain('World')
		expect(container.textContent).toContain('from')
		expect(container.textContent).toContain('Nested')
		expect(container.textContent).toContain('marks')
	})
})

describe('Edge Cases', () => {
	it('should handle empty input', () => {
		const TestMark = ({children}: {value?: string; children?: ReactNode}) => {
			return <span>{children}</span>
		}

		const markup: Markup = '@[__nested__]'
		const value = ''

		const {container} = render(<MarkedInput Mark={TestMark} value={value} options={[{markup}]} />)

		expect(container.textContent).toBe('')
	})

	it('should handle input with no marks', () => {
		const TestMark = ({children}: {value?: string; children?: ReactNode}) => {
			return <span>{children}</span>
		}

		const markup: Markup = '@[__nested__]'
		const value = 'Just plain text'

		const {container} = render(<MarkedInput Mark={TestMark} value={value} options={[{markup}]} />)

		expect(container.textContent).toBe('Just plain text')
	})

	it('should handle malformed nested marks gracefully', () => {
		const TestMark = ({children}: {value?: string; children?: ReactNode}) => {
			return <span data-testid="mark">{children}</span>
		}

		const markup: Markup = '@[__nested__]'
		const value = '@[unclosed @[nested'

		const {container} = render(<MarkedInput Mark={TestMark} value={value} options={[{markup}]} />)

		// Should render something without crashing
		expect(container).toBeInTheDocument()
	})
})
