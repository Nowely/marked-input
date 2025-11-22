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
						{ label: 'Installation', slug: 'introduction/installation' },
						{ label: 'Getting Started', slug: 'introduction/getting-started' },
						{ label: 'Features', slug: 'introduction/features' },
					],
				},
				{
					label: 'Guides',
					items: [
						{ label: 'Configuration', slug: 'guides/configuration' },
						{ label: 'Dynamic Marks', slug: 'guides/dynamic-marks' },
						{ label: 'Nested Marks', slug: 'guides/nested-marks' },
						{ label: 'Overlay', slug: 'guides/overlay' },
						{ label: 'Slots', slug: 'guides/slots' },
					],
				},
				{
					label: 'API',
					items: [
						{ label: 'Reference', slug: 'api/reference' },
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
