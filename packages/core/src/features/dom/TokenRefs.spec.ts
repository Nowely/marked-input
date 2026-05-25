import {describe, it, expect} from 'vitest'

import {TokenRefs} from './TokenRefs'

describe('TokenRefs', () => {
	it('registers a control element via the ref callback and reports it via controlElements()', () => {
		const refs = new TokenRefs()
		const button = document.createElement('button')

		const ref = refs.control()
		ref(button)

		expect(refs.controlElements().has(button)).toBe(true)
	})

	it('un-registers a control when the ref is called with null', () => {
		const refs = new TokenRefs()
		const button = document.createElement('button')

		const ref = refs.control()
		ref(button)
		ref(null)

		expect(refs.controlElements().has(button)).toBe(false)
	})

	it('registers child-sequence hosts by owner path', () => {
		const refs = new TokenRefs()
		const host = document.createElement('span')

		refs.children([0, 1])(host)

		expect(refs.childSequenceHostsFor([0, 1])).toContain(host)
	})

	it('handles duplicate registrations for the same owner path', () => {
		const refs = new TokenRefs()
		const hostA = document.createElement('span')
		const hostB = document.createElement('span')

		refs.children([0])(hostA)
		refs.children([0])(hostB)

		const hosts = refs.childSequenceHostsFor([0])
		expect(hosts).toHaveLength(2)
		expect(hosts).toContain(hostA)
		expect(hosts).toContain(hostB)
	})

	it('returns empty arrays/sets when nothing is registered', () => {
		const refs = new TokenRefs()
		expect(Array.from(refs.controlElements())).toEqual([])
		expect(refs.childSequenceHostsFor([0])).toEqual([])
	})
})