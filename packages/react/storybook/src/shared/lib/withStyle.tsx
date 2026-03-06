import {useInsertionEffect} from 'react'

const ensureStyleLink = (id: string) => {
	let link = document.getElementById(id) as HTMLLinkElement | null

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

export const withStyle = (id: string) => (Story: any) => {
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