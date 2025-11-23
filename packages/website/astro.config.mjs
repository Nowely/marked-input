// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import starlightTypeDoc, { typeDocSidebarGroup } from 'starlight-typedoc';
import tailwindcss from '@tailwindcss/vite';

const isDev = import.meta.env.DEV;

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
					},
				}),
			],
			title: 'Markput',
			social: [
				{
					label: 'GitHub',
					href: 'https://github.com/Nowely/marked-input',
					icon: 'github',
				},
			],
			sidebar: [
				{
					label: 'Introduction',
					items: [
						{ label: 'Why Markput?', slug: 'introduction/why-markput' },
						{ label: 'Getting Started', slug: 'introduction/getting-started' },
						{ label: 'Quick Start', slug: 'introduction/quick-start' },
						{ label: 'Core Concepts', slug: 'introduction/core-concepts' },
					],
				},
				{
					label: 'Guides',
					items: [
						{ label: 'Configuration', slug: 'guides/configuration' },
						{ label: 'Framework Integration', slug: 'guides/framework-integration' },
						{ label: 'Dynamic Marks', slug: 'guides/dynamic-marks' },
						{ label: 'Nested Marks', slug: 'guides/nested-marks' },
						{ label: 'Overlay Customization', slug: 'guides/overlay-customization' },
						{ label: 'Slots Customization', slug: 'guides/slots-customization' },
						{ label: 'Keyboard Handling', slug: 'guides/keyboard-handling' },
					],
				},
				{
					label: 'Examples',
					items: [
						{ label: 'Mention System', slug: 'examples/mention-system' },
						{ label: 'Slash Commands', slug: 'examples/slash-commands' },
						{ label: 'Hashtags', slug: 'examples/hashtags' },
						{ label: 'Markdown Editor', slug: 'examples/markdown-editor' },
						{ label: 'HTML-like Tags', slug: 'examples/html-like-tags' },
						{ label: 'Autocomplete', slug: 'examples/autocomplete' },
					],
				},
				...(isDev ? [{
					label: '🚧 Development',
					items: [
						{ label: 'Architecture', slug: 'development/architecture' },
						{ label: 'Performance', slug: 'development/performance' },
						{ label: 'RFC: Nested Marks', slug: 'development/rfc-nested-marks' },
					],
				}] : []),
				{
					label: 'Reference',
					items: [
						{ label: 'FAQ', slug: 'reference/faq' },
						{ label: 'Getting Help', slug: 'reference/getting-help' },
					],
				},
				typeDocSidebarGroup,
			],
			customCss: ['./src/styles/global.css'],
		}),
	],
	vite: {
		plugins: [tailwindcss()],
	},
});
