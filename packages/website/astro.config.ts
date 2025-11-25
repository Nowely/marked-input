import {defineConfig} from 'astro/config'
import starlight from '@astrojs/starlight'
import starlightTypeDoc, {typeDocSidebarGroup} from 'starlight-typedoc'
import tailwindcss from '@tailwindcss/vite'

import react from '@astrojs/react'

const isDev = import.meta.env.DEV
const wipBadge = {text: '🚧', class: 'border-none bg-transparent'}

const sidebarConfig = [
	{
		label: 'Introduction',
		items: [
			{label: 'Why Markput?', slug: 'introduction/why-markput'},
			{label: 'Getting Started', slug: 'introduction/getting-started', badge: wipBadge},
		],
	},
	{
		label: 'Guides',
		items: [
			{label: 'Configuration', slug: 'guides/configuration', badge: wipBadge},
			{label: 'Dynamic Marks', slug: 'guides/dynamic-marks', badge: wipBadge},
			{label: 'Nested Marks', slug: 'guides/nested-marks', badge: wipBadge},
			{label: 'Overlay Customization', slug: 'guides/overlay-customization', badge: wipBadge},
			{label: 'Slots Customization', slug: 'guides/slots-customization', badge: wipBadge},
			{label: 'Keyboard Handling', slug: 'guides/keyboard-handling', badge: wipBadge},
		],
	},
	{
		label: 'Examples',
		items: [
			{label: 'Mention System', slug: 'examples/mention-system', badge: wipBadge},
			{label: 'Slash Commands', slug: 'examples/slash-commands', badge: wipBadge},
			{label: 'Hashtags', slug: 'examples/hashtags', badge: wipBadge},
			{label: 'Markdown Editor', slug: 'examples/markdown-editor', badge: wipBadge},
			{label: 'HTML-like Tags', slug: 'examples/html-like-tags', badge: wipBadge},
			{label: 'Autocomplete', slug: 'examples/autocomplete', badge: wipBadge},
		],
	},
	{
		label: 'Development',
		badge: wipBadge,
		items: [
			{label: 'How It Works', slug: 'development/how-it-works'},
			{label: 'Architecture', slug: 'development/architecture'},
			{label: 'Performance', slug: 'development/performance'},
			{label: 'RFC: Nested Marks', slug: 'development/rfc-nested-marks'},
		],
	},
	typeDocSidebarGroup,
	{label: 'Comparisons', slug: 'comparisons', badge: wipBadge},
]

const filterDevItems = (items: any[]) => {
	return items.filter(item => {
		if (item.badge === wipBadge && !isDev) {
			return false
		}
		if (item.items) {
			item.items = filterDevItems(item.items)
		}
		return true
	})
}

// https://astro.build/config
export default defineConfig({
	integrations: [
		starlight({
			plugins: [
				starlightTypeDoc({
					entryPoints: ['../markput/index.ts'],
					tsconfig: '../markput/tsconfig.json',
					output: 'api',
					watch: true,
					sidebar: {
						label: 'API',
						collapsed: false,
					},
					typeDoc: {
						useCodeBlocks: true,
						parametersFormat: 'table',
						classPropertiesFormat: 'table',
						interfacePropertiesFormat: 'list',
						gitRevision: 'next',
					},
				}),
			],
			title: 'Markput',
			lastUpdated: true,
			editLink: {
				baseUrl: 'https://github.com/Nowely/marked-input/edit/next/packages/website/src/content/docs',
			},
			social: [
				{
					label: 'GitHub',
					href: 'https://github.com/Nowely/marked-input',
					icon: 'github',
				},
			],
			sidebar: filterDevItems(sidebarConfig),
			customCss: ['./src/styles/global.css'],
		}),
		react(),
	],
	vite: {
		plugins: [tailwindcss()],
	},
})
