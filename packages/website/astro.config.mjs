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
					label: 'Guides',
					items: [
						{ label: 'Installation', slug: 'guides/installation' },
						{ label: 'Getting Started', slug: 'guides/getting-started' },
						{ label: 'Configuration', slug: 'guides/configuration' },
						{ label: 'Dynamic Marks', slug: 'guides/dynamic-marks' },
						{ label: 'Nested Marks', slug: 'guides/nested-marks' },
						{ label: 'Overlay', slug: 'guides/overlay' },
						{ label: 'Slots', slug: 'guides/slots' },
					],
				},
				{
					label: 'Reference',
					items: [
						{ label: 'API', slug: 'reference/api' },
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
