import {describe, expect, it, vi} from 'vitest'
import {page, userEvent} from 'vitest/browser'

import {textSurfaces} from '../../shared/lib/dom'
import {containerRef, eventProps, outerClass} from '../../shared/lib/framework'
import {defineMark, Mark} from '../../shared/lib/marks'
import {mountComponent} from '../../shared/lib/page'
import {CustomContainer} from './Slots.fixtures'

const VALUE = 'Hello world'

/** A `<b>`, not a `<span>`: the tag alone proves the supplied component replaced the default. */
const CustomSpan = defineMark({tag: 'b'})

describe('Slots API', () => {
	describe('Container slot', () => {
		it('use default div component when no slot is provided', async () => {
			const {host} = await mountComponent({value: VALUE})

			expect(host.tagName).toBe('DIV')
			await expect.element(host).toBeInTheDocument()
		})

		it('use custom component from slots.container', async () => {
			const {host} = await mountComponent({value: VALUE, slots: {container: CustomContainer}})

			expect(host.tagName).toBe('SECTION')
		})

		it('pass slotProps.container to the container component', async () => {
			const handleKeyDown = vi.fn()

			const {host} = await mountComponent({
				value: VALUE,
				slotProps: {container: {[eventProps.keyDown]: handleKeyDown, dataCustom: 'test-value'}},
			})

			await expect.element(host).toHaveAttribute('data-custom', 'test-value')
		})

		it('merge className from slotProps with default className', async () => {
			const {host} = await mountComponent({
				...outerClass('default-class'),
				value: VALUE,
				slotProps: {container: {className: 'custom-class'}},
			})

			await expect.element(host).toHaveClass('default-class')
			await expect.element(host).toHaveClass('custom-class')
		})

		it('merge style from slotProps with default style', async () => {
			const {host} = await mountComponent({
				value: VALUE,
				style: {color: 'red'},
				slotProps: {container: {style: {backgroundColor: 'blue'}}},
			})

			await expect.element(host).toHaveStyle({color: 'rgb(255, 0, 0)', backgroundColor: 'rgb(0, 0, 255)'})
		})

		it('compose user slotProps.container ref (object) with host ref — editor still renders', async () => {
			const userRef = containerRef()

			const {host} = await mountComponent({
				value: VALUE,
				slotProps: {container: {ref: userRef.ref}},
			})

			// (a) the user ref must receive the container element
			expect(userRef.current()).toBe(host)

			// (b) the host ref must also have fired — the editor publishes tokens
			// only after the container mounts, so the value should still render.
			await expect.element(textSurfaces(host)[0]).toHaveTextContent(VALUE)
		})

		it('compose user slotProps.container ref (function) with host ref — editor still renders', async () => {
			const userRef = vi.fn()

			const {host} = await mountComponent({
				value: VALUE,
				slotProps: {container: {ref: userRef}},
			})

			expect(userRef).toHaveBeenCalledWith(host)

			await expect.element(textSurfaces(host)[0]).toHaveTextContent(VALUE)
		})
	})

	describe('Span slot', () => {
		it('use default span component when no slot is provided', async () => {
			await mountComponent({value: VALUE})

			const textSpan = page.getByText(VALUE)
			await expect.element(textSpan).toBeInTheDocument()
			await expect.element(textSpan).not.toHaveAttribute('contenteditable')
		})

		it('use custom component from Span prop', async () => {
			const {host} = await mountComponent({value: VALUE, Span: CustomSpan})

			expect(host.querySelector('b')).not.toBeNull()
		})

		it('apply custom className via custom Span component', async () => {
			await mountComponent({value: VALUE, Span: defineMark({tag: 'span', class: 'custom-span-class'})})

			await expect.element(page.getByText(VALUE)).toHaveClass('custom-span-class')
		})

		it('apply custom style via custom Span component', async () => {
			await mountComponent({
				value: VALUE,
				Span: defineMark({tag: 'span', style: {fontWeight: 'bold', fontSize: '16px'}}),
			})

			await expect.element(page.getByText(VALUE)).toHaveStyle({fontWeight: 'bold', fontSize: '16px'})
		})
	})

	describe('Both slots', () => {
		it('allow overriding both container and Span simultaneously', async () => {
			const {host} = await mountComponent({
				value: VALUE,
				Span: defineMark({tag: 'b', attrs: {'data-span-prop': 'span'}}),
				slots: {container: CustomContainer},
				slotProps: {container: {dataContainerProp: 'container'}},
			})

			const span = host.querySelector('b')

			expect(host.tagName).toBe('SECTION')
			await expect.element(host).toHaveAttribute('data-container-prop', 'container')

			expect(span).not.toBeNull()
			expect(span).toHaveAttribute('data-span-prop', 'span')
		})
	})

	describe('TypeScript integration', () => {
		it('work with valid slot types', async () => {
			// Also a compile-time test: it fails both typechecks if the slot types drift.
			const {host} = await mountComponent({
				value: 'Hello',
				slots: {container: CustomContainer},
				slotProps: {container: {[eventProps.keyDown]: () => {}, className: 'test'}},
			})

			await expect.element(host).toBeInTheDocument()
		})

		it('support camelCase data attributes in slotProps', async () => {
			const {host} = await mountComponent({
				value: VALUE,
				slotProps: {container: {dataTestId: 'my-container', dataUserId: 'user-123', dataUserName: 'John'}},
			})

			await expect.element(host).toHaveAttribute('data-test-id', 'my-container')
			await expect.element(host).toHaveAttribute('data-user-id', 'user-123')
			await expect.element(host).toHaveAttribute('data-user-name', 'John')
		})
	})

	describe('contentEditable topology', () => {
		it('put contentEditable="true" on the container, not on the text span', async () => {
			const {host} = await mountComponent({value: VALUE})

			await expect.element(host).toHaveAttribute('contenteditable', 'true')
			await expect.element(page.getByText(VALUE)).not.toHaveAttribute('contenteditable')
		})

		it('have contentEditable="false" on the container when readOnly is true', async () => {
			const {host} = await mountComponent({value: VALUE, readOnly: true})

			await expect.element(host).toHaveAttribute('contenteditable', 'false')
			await expect.element(page.getByText(VALUE)).not.toHaveAttribute('contenteditable')
		})

		it('leave a custom Span bare too', async () => {
			const {host} = await mountComponent({value: VALUE, Span: CustomSpan})
			const span = host.querySelector('b')

			expect(span).not.toBeNull()
			expect(span).not.toHaveAttribute('contenteditable')
			expect(span).toHaveTextContent(VALUE)
		})

		it('freeze a value-only mark root as an atomic', async () => {
			await mountComponent({Mark, value: 'Hello @[world](1)'})

			const mark = page.getByRole('mark')
			await expect.element(mark).toHaveAttribute('contenteditable', 'false')
			await expect.element(mark).not.toHaveAttribute('tabindex')
		})
	})

	describe('Event handlers in slotProps', () => {
		it('call the keydown handler from slotProps.container', async () => {
			const handleKeyDown = vi.fn()

			const {host} = await mountComponent({
				value: VALUE,
				slotProps: {container: {[eventProps.keyDown]: handleKeyDown}},
			})

			await userEvent.click(host)
			await userEvent.keyboard('{Enter}')

			expect(handleKeyDown).toHaveBeenCalled()
		})

		it('call onClick handler from slotProps.container', async () => {
			const handleClick = vi.fn()

			const {host} = await mountComponent({
				value: VALUE,
				slotProps: {container: {onClick: handleClick}},
			})

			await userEvent.click(host)

			expect(handleClick).toHaveBeenCalled()
		})

		it('call the focus and blur handlers from slotProps.container', async () => {
			const handleFocus = vi.fn()
			const handleBlur = vi.fn()

			const {host} = await mountComponent({
				value: VALUE,
				slotProps: {container: {[eventProps.focus]: handleFocus, [eventProps.blur]: handleBlur}},
			})

			await userEvent.click(host)
			expect(handleFocus).toHaveBeenCalled()

			await userEvent.click(page.getByRole('document'))
			expect(handleBlur).toHaveBeenCalled()
		})
	})

	describe('Custom slot components', () => {
		it('pass all required props to custom container slot', async () => {
			const {host} = await mountComponent({
				...outerClass('outer-class'),
				value: VALUE,
				style: {color: 'red'},
				slots: {container: CustomContainer},
				slotProps: {container: {className: 'inner-class', style: {backgroundColor: 'blue'}}},
			})

			expect(host.tagName).toBe('SECTION')
			await expect.element(host).toHaveClass('outer-class')
			await expect.element(host).toHaveClass('inner-class')
			await expect.element(host).toHaveStyle({color: 'rgb(255, 0, 0)', backgroundColor: 'rgb(0, 0, 255)'})
		})

		it('allow native HTML elements as container slot', async () => {
			const {host} = await mountComponent({value: VALUE, slots: {container: 'article'}})

			expect(host.tagName).toBe('ARTICLE')
			await expect.element(host).toHaveAttribute('contenteditable', 'true')

			const textSpan = page.getByText(VALUE)
			await expect.element(textSpan).toBeInTheDocument()
			await expect.element(textSpan).not.toHaveAttribute('contenteditable')
		})
	})

	describe('Edge cases', () => {
		it('handle empty value', async () => {
			const {host} = await mountComponent({value: ''})

			// One empty text surface, not zero: the empty document still parses to a text token.
			expect(host.textContent).toBe('')
			expect(textSurfaces(host)).toHaveLength(1)
		})

		it('handle undefined slotProps gracefully', async () => {
			const {host} = await mountComponent({value: VALUE, slotProps: undefined})

			expect(host.textContent).toBe(VALUE)
		})

		it('handle empty className in slotProps', async () => {
			const {host} = await mountComponent({
				value: VALUE,
				slotProps: {container: {className: ''}},
			})

			// The empty string is dropped rather than joined in, so the core class stands alone.
			expect(Array.from(host.classList)).toHaveLength(1)
			expect(host.textContent).toBe(VALUE)
		})

		it('handle multiple marked values with custom Span', async () => {
			const {host} = await mountComponent({
				Mark,
				value: '@[hello] world @[test]',
				Span: CustomSpan,
			})

			expect(host.querySelectorAll('b').length).toBeGreaterThan(0)
		})

		it('preserve slot functionality when no slotProps provided', async () => {
			const {host} = await mountComponent({value: VALUE, slots: {container: CustomContainer}})

			expect(host.tagName).toBe('SECTION')
		})

		it('render the value inside a component container', async () => {
			const {host} = await mountComponent({
				value: VALUE,
				slots: {container: CustomContainer},
			})

			expect(host.textContent).toBe(VALUE)
		})
	})
})