import {readdir, readFile, writeFile} from 'node:fs/promises'
import {join} from 'node:path'
import {fileURLToPath} from 'node:url'

import react from '@astrojs/react'
import starlight from '@astrojs/starlight'
import vercel from '@astrojs/vercel'
import type {AstroIntegration} from 'astro'
import {defineConfig} from 'astro/config'
import starlightTypeDoc, {typeDocSidebarGroup} from 'starlight-typedoc'

const isDev = import.meta.env.DEV
const wipBadge = {text: '🚧', class: 'border-none bg-transparent'}

const sidebarConfig = [
	{
		label: 'Introduction',
		items: [
			{label: 'Why Markput?', slug: 'introduction/why-markput'},
			{label: 'Getting Started', slug: 'introduction/getting-started'},
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
			{label: 'Known Inconsistencies', slug: 'development/inconsistencies'},
		],
	},
	typeDocSidebarGroup,
	{label: 'Comparisons', slug: 'comparisons', badge: wipBadge},
].filter(item => isDev || !('badge' in item && item.badge === wipBadge))

function trimGeneratedApiDocs(): AstroIntegration {
	return {
		name: 'trim-generated-api-docs',
		hooks: {
			'astro:config:setup': async () => {
				await trimMarkdownTrailingWhitespace(fileURLToPath(new URL('./src/content/docs/api', import.meta.url)))
			},
		},
	}
}

async function trimMarkdownTrailingWhitespace(directory: string): Promise<void> {
	const entries = await readdir(directory, {withFileTypes: true})
	await Promise.all(
		entries.map(async entry => {
			const path = join(directory, entry.name)
			if (entry.isDirectory()) {
				await trimMarkdownTrailingWhitespace(path)
				return
			}
			if (!entry.isFile() || !entry.name.endsWith('.md')) return

			const content = await readFile(path, 'utf8')
			const trimmed = content.replace(/[ \t]+$/gm, '')
			if (trimmed !== content) await writeFile(path, trimmed)
		})
	)
}

// https://astro.build/config
export default defineConfig({
	adapter: vercel({
		imageService: true,
		webAnalytics: {enabled: true},
	}),
	integrations: [
		starlight({
			plugins: [
				starlightTypeDoc({
					entryPoints: ['../react/markput/index.ts'],
					tsconfig: '../react/markput/tsconfig.json',
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
				{
					label: 'React Storybook',
					href: 'https://markput-react.vercel.app',
					icon: 'external',
				},
				{
					label: 'Vue Storybook',
					href: 'https://markput-vue.vercel.app',
					icon: 'external',
				},
			],
			sidebar: sidebarConfig,
			customCss: ['./src/styles/global.css'],
		}),
		trimGeneratedApiDocs(),
		react(),
	],
})