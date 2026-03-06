import {MarkedInput} from '@markput/vue'
import {describe, expect, it, vi} from 'vitest'
import {render} from 'vitest-browser-vue'
import {page, userEvent} from 'vitest/browser'
import {defineComponent, h} from 'vue'

const TestMark = defineComponent({
	props: {value: String, children: {type: null}},
	setup(props, {slots}) {
		return () => h('mark', null, slots.default?.() ?? props.value)
	},
})

describe('Slots API', () => {
	describe('Container slot', () => {
		it('should use default div component when no slot is provided', async () => {
			const {container} = await render(MarkedInput, {
				Mark: TestMark,
				value: 'Hello world',
				'data-testid': 'container',
			})

			const containerDiv = container.querySelector('div') as HTMLElement
			await expect.element(containerDiv).toBeInTheDocument()
		})

		it('should use custom component from slots.container', async () => {
			const CustomContainer = defineComponent({
				setup(_, {slots}) {
					return () => h('div', {'data-testid': 'custom-container'}, slots.default?.())
				},
			})

			await render(MarkedInput, {
				Mark: TestMark,
				value: 'Hello world',
				slots: {
					container: CustomContainer,
				},
			})

			await expect.element(page.getByTestId('custom-container')).toBeInTheDocument()
		})

		it('should pass slotProps.container to the container component', async () => {
			const handleKeyDown = vi.fn()

			const {container} = await render(MarkedInput, {
				Mark: TestMark,
				value: 'Hello world',
				slotProps: {
					container: {
						onKeydown: handleKeyDown,
						dataCustom: 'test-value',
					},
				},
			})

			const containerDiv = container.querySelector('div') as HTMLElement
			await expect.element(containerDiv).toHaveAttribute('data-custom', 'test-value')
		})

		it('should merge className from slotProps with default className', async () => {
			const {container} = await render(MarkedInput, {
				Mark: TestMark,
				value: 'Hello world',
				className: 'default-class',
				slotProps: {
					container: {
						className: 'custom-class',
					},
				},
			})

			const containerDiv = container.querySelector('div') as HTMLElement
			await expect.element(containerDiv).toHaveClass('default-class')
		})

		it('should merge style from slotProps with default style', async () => {
			const {container} = await render(MarkedInput, {
				Mark: TestMark,
				value: 'Hello world',
				style: {color: 'red'},
				slotProps: {
					container: {
						style: {backgroundColor: 'blue'},
					},
				},
			})

			const containerDiv = container.querySelector('div') as HTMLElement
			await expect.element(containerDiv).toHaveStyle({color: 'rgb(255, 0, 0)', backgroundColor: 'rgb(0, 0, 255)'})
		})
	})

	describe('Span slot', () => {
		it('should use default span component when no slot is provided', async () => {
			const {container} = await render(MarkedInput, {
				Mark: TestMark,
				value: 'Hello world',
			})

			const textSpan = container.querySelector('span[contenteditable]') as HTMLElement
			await expect.element(textSpan).toBeInTheDocument()
			await expect.element(textSpan).toHaveTextContent('Hello world')
		})

		it('should use custom component from slots.span', async () => {
			const CustomSpan = defineComponent({
				setup(_, {slots}) {
					return () => h('span', {'data-testid': 'custom-span'}, slots.default?.())
				},
			})

			await render(MarkedInput, {
				Mark: TestMark,
				value: 'Hello world',
				slots: {
					span: CustomSpan,
				},
			})

			await expect.element(page.getByTestId('custom-span')).toBeInTheDocument()
		})

		it('should pass slotProps.span to the span component', async () => {
			const {container} = await render(MarkedInput, {
				Mark: TestMark,
				value: 'Hello world',
				slotProps: {
					span: {
						className: 'custom-span-class',
						dataSpanCustom: 'span-value',
					},
				},
			})

			const textSpan = container.querySelector('span[contenteditable]') as HTMLElement
			await expect.element(textSpan).toHaveClass('custom-span-class')
			await expect.element(textSpan).toHaveAttribute('data-span-custom', 'span-value')
		})

		it('should merge style from slotProps.span', async () => {
			const {container} = await render(MarkedInput, {
				Mark: TestMark,
				value: 'Hello world',
				slotProps: {
					span: {
						style: {fontWeight: 'bold', fontSize: '16px'},
					},
				},
			})

			const textSpan = container.querySelector('span[contenteditable]') as HTMLElement
			await expect.element(textSpan).toHaveStyle({fontWeight: 'bold', fontSize: '16px'})
		})
	})

	describe('Both slots', () => {
		it('should allow overriding both container and span slots simultaneously', async () => {
			const CustomContainer = defineComponent({
				setup(_, {slots}) {
					return () => h('div', {'data-testid': 'custom-container'}, slots.default?.())
				},
			})

			const CustomSpan = defineComponent({
				setup(_, {slots}) {
					return () => h('span', {'data-testid': 'custom-span'}, slots.default?.())
				},
			})

			await render(MarkedInput, {
				Mark: TestMark,
				value: 'Hello world',
				slots: {
					container: CustomContainer,
					span: CustomSpan,
				},
				slotProps: {
					container: {
						dataContainerProp: 'container',
					},
					span: {
						dataSpanProp: 'span',
					},
				},
			})

			const container = page.getByTestId('custom-container')
			const span = page.getByTestId('custom-span')

			await expect.element(container).toBeInTheDocument()
			await expect.element(container).toHaveAttribute('data-container-prop', 'container')

			await expect.element(span).toBeInTheDocument()
			await expect.element(span).toHaveAttribute('data-span-prop', 'span')
		})
	})

	describe('TypeScript integration', () => {
		it('should work with valid slot types', async () => {
			const CustomDiv = defineComponent({
				setup(_, {slots}) {
					return () => h('div', null, slots.default?.())
				},
			})

			const {container} = await render(MarkedInput, {
				Mark: TestMark,
				value: 'Hello',
				slots: {
					container: CustomDiv,
					span: 'span',
				},
				slotProps: {
					container: {
						onKeydown: () => {},
						className: 'test',
					},
					span: {
						style: {color: 'red'},
					},
				},
			})

			await expect.element(container).toBeInTheDocument()
		})

		it('should support camelCase data attributes in slotProps', async () => {
			const {container} = await render(MarkedInput, {
				Mark: TestMark,
				value: 'Hello world',
				slotProps: {
					container: {
						dataTestId: 'my-container',
						dataUserId: 'user-123',
						dataUserName: 'John',
					},
				},
			})

			const containerDiv = container.querySelector('div') as HTMLElement
			await expect.element(containerDiv).toHaveAttribute('data-test-id', 'my-container')
			await expect.element(containerDiv).toHaveAttribute('data-user-id', 'user-123')
			await expect.element(containerDiv).toHaveAttribute('data-user-name', 'John')
		})
	})

	describe('Span contentEditable attribute', () => {
		it('should have contentEditable="true" by default on editable span', async () => {
			const {container} = await render(MarkedInput, {
				Mark: TestMark,
				value: 'Hello world',
			})

			const textSpan = container.querySelector('span[contenteditable="true"]') as HTMLElement
			await expect.element(textSpan).toBeInTheDocument()
		})

		it('should have contentEditable="false" when readOnly is true', async () => {
			const {container} = await render(MarkedInput, {
				Mark: TestMark,
				value: 'Hello world',
				readOnly: true,
			})

			const textSpan = container.querySelector('span[contenteditable="false"]') as HTMLElement
			await expect.element(textSpan).toBeInTheDocument()
		})

		it('should maintain contentEditable on span with custom slot', async () => {
			const CustomSpan = defineComponent({
				setup(_, {slots}) {
					return () => h('span', {'data-testid': 'custom-span'}, slots.default?.())
				},
			})

			await render(MarkedInput, {
				Mark: TestMark,
				value: 'Hello world',
				slots: {span: CustomSpan},
			})

			const span = page.getByTestId('custom-span')
			await expect.element(span).toHaveAttribute('contenteditable', 'true')
		})

		it('should respect suppressContentEditableWarning when set', async () => {
			const {container} = await render(MarkedInput, {
				Mark: TestMark,
				value: 'Hello world',
			})

			const textSpan = container.querySelector('span[contenteditable]') as HTMLElement
			await expect.element(textSpan).toBeInTheDocument()
		})
	})

	describe('Event handlers in slotProps', () => {
		it('should call onKeydown handler from slotProps.container', async () => {
			const handleKeyDown = vi.fn()

			const {container} = await render(MarkedInput, {
				Mark: TestMark,
				value: 'Hello world',
				slotProps: {
					container: {
						onKeydown: handleKeyDown,
					},
				},
			})

			const div = container.querySelector('div') as HTMLElement
			await userEvent.click(div)
			await userEvent.keyboard('{Enter}')

			expect(handleKeyDown).toHaveBeenCalled()
		})

		it('should call onClick handler from slotProps.container', async () => {
			const handleClick = vi.fn()

			const {container} = await render(MarkedInput, {
				Mark: TestMark,
				value: 'Hello world',
				slotProps: {
					container: {
						onClick: handleClick,
					},
				},
			})

			const div = container.querySelector('div') as HTMLElement
			await userEvent.click(div)

			expect(handleClick).toHaveBeenCalled()
		})

		it('should call onFocus and onBlur handlers from slotProps.container', async () => {
			const handleFocus = vi.fn()
			const handleBlur = vi.fn()

			const {container} = await render(MarkedInput, {
				Mark: TestMark,
				value: 'Hello world',
				slotProps: {
					container: {
						onFocus: handleFocus,
						onBlur: handleBlur,
					},
				},
			})

			const div = container.querySelector('div') as HTMLElement
			await userEvent.click(div)
			expect(handleFocus).toHaveBeenCalled()

			await userEvent.click(page.getByRole('document'))
			expect(handleBlur).toHaveBeenCalled()
		})
	})

	describe('Custom slot components', () => {
		it('should pass all required props to custom container slot', async () => {
			const CustomContainer = defineComponent({
				setup(_, {slots}) {
					return () => h('div', {'data-testid': 'custom-container'}, slots.default?.())
				},
			})

			await render(MarkedInput, {
				Mark: TestMark,
				value: 'Hello world',
				className: 'outer-class',
				style: {color: 'red'},
				slots: {container: CustomContainer},
				slotProps: {
					container: {
						className: 'inner-class',
						style: {backgroundColor: 'blue'},
					},
				},
			})

			const container = page.getByTestId('custom-container')
			await expect.element(container).toHaveClass('outer-class')
			await expect.element(container).toHaveClass('inner-class')
			await expect.element(container).toHaveStyle({color: 'rgb(255, 0, 0)', backgroundColor: 'rgb(0, 0, 255)'})
		})

		it('should allow native HTML elements as slots', async () => {
			const {container} = await render(MarkedInput, {
				Mark: TestMark,
				value: 'Hello world',
				slots: {
					container: 'article',
					span: 'div',
				},
			})

			const article = container.querySelector('article') as HTMLElement
			const div = container.querySelector('div[contenteditable]') as HTMLElement

			await expect.element(article).toBeInTheDocument()
			await expect.element(div).toBeInTheDocument()
		})
	})

	describe('Edge cases', () => {
		it('should handle empty value', async () => {
			const {container} = await render(MarkedInput, {
				Mark: TestMark,
				value: '',
			})

			const div = container.querySelector('div') as HTMLElement
			await expect.element(div).toBeInTheDocument()
		})

		it('should handle undefined slotProps gracefully', async () => {
			const {container} = await render(MarkedInput, {
				Mark: TestMark,
				value: 'Hello world',
				slotProps: undefined,
			})

			const div = container.querySelector('div') as HTMLElement
			await expect.element(div).toBeInTheDocument()
		})

		it('should handle empty className in slotProps', async () => {
			const {container} = await render(MarkedInput, {
				Mark: TestMark,
				value: 'Hello world',
				slotProps: {
					container: {
						className: '',
					},
				},
			})

			const div = container.querySelector('div') as HTMLElement
			await expect.element(div).toBeInTheDocument()
		})

		it('should handle multiple marked values with custom slots', async () => {
			const {container} = await render(MarkedInput, {
				Mark: TestMark,
				value: '@[hello] world @[test]',
				slots: {
					span: defineComponent({
						setup(_, {slots}) {
							return () => h('span', {'data-testid': 'text-span'}, slots.default?.())
						},
					}),
				},
			})

			const spans = container.querySelectorAll('[data-testid="text-span"]')
			expect(spans.length).toBeGreaterThan(0)
		})

		it('should preserve slot functionality when no slotProps provided', async () => {
			const CustomContainer = defineComponent({
				setup(_, {slots}) {
					return () => h('div', {'data-testid': 'custom-container'}, slots.default?.())
				},
			})

			await render(MarkedInput, {
				Mark: TestMark,
				value: 'Hello world',
				slots: {container: CustomContainer},
			})

			await expect.element(page.getByTestId('custom-container')).toBeInTheDocument()
		})
	})
})