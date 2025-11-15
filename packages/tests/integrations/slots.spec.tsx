import '@testing-library/jest-dom'
import {render, screen} from '@testing-library/react'
import {MarkedInput} from 'rc-marked-input'
import {describe, it, expect, vi} from 'vitest'
import {forwardRef} from 'react'

describe('Slots API', () => {
	const TestMark = ({children}: {children?: React.ReactNode}) => <mark>{children}</mark>

	describe('Container slot', () => {
		it('should use default div component when no slot is provided', () => {
			const {container} = render(
				<MarkedInput Mark={TestMark} value="Hello world" data-testid="container" />
			)

			const containerDiv = container.querySelector('div')
			expect(containerDiv).toBeInTheDocument()
		})

		it('should use custom component from slots.container', () => {
			const CustomContainer = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>((props, ref) => (
				<div {...props} ref={ref} data-testid="custom-container" />
			))
			CustomContainer.displayName = 'CustomContainer'

			render(
				<MarkedInput
					Mark={TestMark}
					value="Hello world"
					slots={{
						container: CustomContainer,
					}}
				/>
			)

			expect(screen.getByTestId('custom-container')).toBeInTheDocument()
		})

		it('should pass slotProps.container to the container component', () => {
			const handleKeyDown = vi.fn()

			const {container} = render(
				<MarkedInput
					Mark={TestMark}
					value="Hello world"
					slotProps={{
						container: {
							onKeyDown: handleKeyDown,
							dataCustom: 'test-value',
						},
					}}
				/>
			)

			const containerDiv = container.querySelector('div')
			expect(containerDiv).toHaveAttribute('data-custom', 'test-value')
		})

		it('should merge className from slotProps with default className', () => {
			const {container} = render(
				<MarkedInput
					Mark={TestMark}
					value="Hello world"
					className="default-class"
					slotProps={{
						container: {
							className: 'custom-class',
						},
					}}
				/>
			)

			const containerDiv = container.querySelector('div')
			expect(containerDiv).toHaveClass('default-class')
		})

		it('should merge style from slotProps with default style', () => {
			const {container} = render(
				<MarkedInput
					Mark={TestMark}
					value="Hello world"
					style={{color: 'red'}}
					slotProps={{
						container: {
							style: {backgroundColor: 'blue'},
						},
					}}
				/>
			)

			const containerDiv = container.querySelector('div')
			expect(containerDiv).toHaveStyle({color: 'rgb(255, 0, 0)', backgroundColor: 'rgb(0, 0, 255)'})
		})
	})

	describe('Span slot', () => {
		it('should use default span component when no slot is provided', () => {
			const {container} = render(<MarkedInput Mark={TestMark} value="Hello world" />)

			const textSpan = container.querySelector('span[contenteditable]')
			expect(textSpan).toBeInTheDocument()
			expect(textSpan).toHaveTextContent('Hello world')
		})

		it('should use custom component from slots.span', () => {
			const CustomSpan = forwardRef<HTMLSpanElement, React.HTMLAttributes<HTMLSpanElement>>((props, ref) => (
				<span {...props} ref={ref} data-testid="custom-span" />
			))
			CustomSpan.displayName = 'CustomSpan'

			render(
				<MarkedInput
					Mark={TestMark}
					value="Hello world"
					slots={{
						span: CustomSpan,
					}}
				/>
			)

			expect(screen.getByTestId('custom-span')).toBeInTheDocument()
		})

		it('should pass slotProps.span to the span component', () => {
			const {container} = render(
				<MarkedInput
					Mark={TestMark}
					value="Hello world"
					slotProps={{
						span: {
							className: 'custom-span-class',
							dataSpanCustom: 'span-value',
						},
					}}
				/>
			)

			const textSpan = container.querySelector('span[contenteditable]')
			expect(textSpan).toHaveClass('custom-span-class')
			expect(textSpan).toHaveAttribute('data-span-custom', 'span-value')
		})

		it('should merge style from slotProps.span', () => {
			const {container} = render(
				<MarkedInput
					Mark={TestMark}
					value="Hello world"
					slotProps={{
						span: {
							style: {fontWeight: 'bold', fontSize: '16px'},
						},
					}}
				/>
			)

			const textSpan = container.querySelector('span[contenteditable]')
			expect(textSpan).toHaveStyle({fontWeight: 'bold', fontSize: '16px'})
		})
	})

	describe('Both slots', () => {
		it('should allow overriding both container and span slots simultaneously', () => {
			const CustomContainer = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>((props, ref) => (
				<div {...props} ref={ref} data-testid="custom-container" />
			))
			CustomContainer.displayName = 'CustomContainer'

			const CustomSpan = forwardRef<HTMLSpanElement, React.HTMLAttributes<HTMLSpanElement>>((props, ref) => (
				<span {...props} ref={ref} data-testid="custom-span" />
			))
			CustomSpan.displayName = 'CustomSpan'

			render(
				<MarkedInput
					Mark={TestMark}
					value="Hello world"
					slots={{
						container: CustomContainer,
						span: CustomSpan,
					}}
					slotProps={{
						container: {
							dataContainerProp: 'container',
						},
						span: {
							dataSpanProp: 'span',
						},
					}}
				/>
			)

			const container = screen.getByTestId('custom-container')
			const span = screen.getByTestId('custom-span')

			expect(container).toBeInTheDocument()
			expect(container).toHaveAttribute('data-container-prop', 'container')

			expect(span).toBeInTheDocument()
			expect(span).toHaveAttribute('data-span-prop', 'span')
		})
	})

	describe('TypeScript integration', () => {
		it('should work with valid slot types', () => {
			// This is a compile-time test - if it compiles, the types are correct
			const CustomDiv = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>((props, ref) => (
				<div {...props} ref={ref} />
			))
			CustomDiv.displayName = 'CustomDiv'

			const {container} = render(
				<MarkedInput
					Mark={TestMark}
					value="Hello"
					slots={{
						container: CustomDiv,
						span: 'span', // Native elements should also work
					}}
					slotProps={{
						container: {
							onKeyDown: () => {},
							className: 'test',
						},
						span: {
							style: {color: 'red'},
						},
					}}
				/>
			)

			expect(container).toBeInTheDocument()
		})

		it('should support camelCase data attributes in slotProps', () => {
			const {container} = render(
				<MarkedInput
					Mark={TestMark}
					value="Hello world"
					slotProps={{
						container: {
							dataTestId: 'my-container',
							dataUserId: 'user-123',
							dataUserName: 'John',
						},
					}}
				/>
			)

			const containerDiv = container.querySelector('div')
			expect(containerDiv).toHaveAttribute('data-test-id', 'my-container')
			expect(containerDiv).toHaveAttribute('data-user-id', 'user-123')
			expect(containerDiv).toHaveAttribute('data-user-name', 'John')
		})
	})
})

