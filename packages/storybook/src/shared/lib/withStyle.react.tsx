import {useInsertionEffect} from 'react'
import type {ComponentType} from 'react'

const ensureStyleLink = (id: string) => {
	let el = document.getElementById(id)
	let link = el instanceof HTMLLinkElement ? el : null

	if (!link) {
		link = document.createElement('link')
		link.id = id
		link.rel = 'stylesheet'
		// Load from Vite public root so it works in Storybook and Vitest browser runs.
		link.href = new URL(`/${id}`, window.location.origin).href
		link.disabled = true
		document.head.append(link)
	}

	return link
}

export const withStyle = (id: string) => (Story: ComponentType) => {
	useStyleInsertion(id)
	return <Story />
}

const useStyleInsertion = (id: string) =>
	useInsertionEffect((): (() => void) => {
		const link = ensureStyleLink(id)

		link.disabled = false
		return () => {
			link.disabled = true
		}
	}, [id])