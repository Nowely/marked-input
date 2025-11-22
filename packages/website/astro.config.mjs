// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
	integrations: [
		starlight({
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
						{ label: 'Introduction', slug: 'introduction/introduction' },
						{ label: 'Installation', slug: 'introduction/installation' },
						{ label: 'Quick Start', slug: 'introduction/quick-start' },
						{ label: 'Core Concepts', slug: 'introduction/core-concepts' },
					],
				},
				{
					label: 'Guides',
					items: [
						{ label: 'Configuration', slug: 'guides/configuration' },
						{ label: 'Dynamic Marks', slug: 'guides/dynamic-marks' },
						{ label: 'Nested Marks', slug: 'guides/nested-marks' },
						{ label: 'Overlay Customization', slug: 'guides/overlay-customization' },
						{ label: 'Slots Customization', slug: 'guides/slots-customization' },
						{ label: 'Keyboard Handling', slug: 'guides/keyboard-handling' },
						{ label: 'TypeScript Usage', slug: 'guides/typescript-usage' },
						{ label: 'Testing', slug: 'guides/testing' },
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
				{
					label: 'API Reference',
					items: [
						{ label: 'Components', slug: 'api/components' },
						{ label: 'Hooks', slug: 'api/hooks' },
						{ label: 'Types', slug: 'api/types' },
						{ label: 'Helpers', slug: 'api/helpers' },
						{ label: 'Core Package', slug: 'api/core-package' },
					],
				},
				{
					label: 'Advanced',
					items: [
						{ label: 'Architecture', slug: 'advanced/architecture' },
						{ label: 'Performance', slug: 'advanced/performance' },
						{ label: 'Accessibility', slug: 'advanced/accessibility' },
						{ label: 'Custom Parsers', slug: 'advanced/custom-parsers' },
					],
				},
				{
					label: 'Reference',
					items: [
						{ label: 'Glossary', slug: 'reference/glossary' },
						{ label: 'FAQ', slug: 'reference/faq' },
						{ label: 'Troubleshooting', slug: 'reference/troubleshooting' },
						{ label: 'Browser Compatibility', slug: 'reference/browser-compatibility' },
					],
				},
			],
			customCss: ['./src/styles/global.css'],
		}),
	],
	vite: {
		plugins: [tailwindcss()],
	},
});
