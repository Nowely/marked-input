import react from '@vitejs/plugin-react'
import vue from '@vitejs/plugin-vue'
import {defineConfig, defineProject} from 'vite-plus'
import {playwright} from 'vite-plus/test/browser-playwright'

/** The one `pages/**` spec that is a source grep rather than a driven page — see its own project. */
const BOUNDARY_SPEC = 'packages/storybook/src/pages/Notion/boundary.spec.ts'

const browserBase = {
	enabled: true,
	provider: playwright(),
	viewport: {width: 1280, height: 720},
	headless: true,
	screenshotFailures: false,
}

export default defineConfig({
	test: {
		coverage: {
			provider: 'v8',
			reporter: ['text', 'json', 'html'],
			exclude: [
				'**/*.bench.ts',
				'**/*.spec.ts',
				'**/*.spec.tsx',
				'**/*.stories.*',
				'**/dist/**',
				'**/index.ts',
				'**/__testing__/**',
				'packages/storybook/vitest.setup.*.ts',
			],
		},
		projects: [
			// The showcase's boundary check is a READ OF ITS SOURCE, not of its behaviour: the claim
			// is that the page imports nothing but the published adapter and touches no store
			// member. There is nothing to render, so no browser and no framework plugin.
			//
			// It keeps its own project across the move out of `packages/notion`. Under `pages/` a
			// bare `*.spec.ts` is the shared-harness convention and BOTH browser projects would
			// claim it, turning one node run of a string grep into two Playwright boots — so the
			// file is named in their `exclude` lists below, beside this include.
			defineProject({
				test: {
					name: 'boundary',
					include: [BOUNDARY_SPEC],
					environment: 'node',
				},
			}),
			// The published guides' code samples, type-checked against the packages' SOURCE. Like
			// `boundary` it is a read of text rather than of behaviour, so it needs no browser.
			defineProject({
				test: {
					name: 'docs',
					include: ['packages/website/samples/*.spec.ts'],
					environment: 'node',
				},
			}),
			defineProject({
				test: {
					name: 'core',
					include: ['packages/core/src/**/*.spec.ts'],
					benchmark: {
						include: ['packages/core/src/**/*.bench.ts'],
					},
					browser: {
						...browserBase,
						instances: [{browser: 'chromium' as const}],
					},
				},
			}),
			defineProject({
				plugins: [react()],
				resolve: {
					dedupe: ['react', 'react-dom'],
					extensions: ['.react.tsx', '.react.ts', '.mjs', '.js', '.mts', '.ts', '.jsx', '.tsx', '.json'],
				},
				test: {
					name: 'react',
					globals: true,
					setupFiles: ['./packages/storybook/vitest.setup.react.ts'],
					include: [
						'packages/storybook/src/pages/**/*.react.spec.tsx',
						'packages/storybook/src/pages/**/*.spec.ts',
					],
					exclude: ['**/node_modules/**', 'packages/storybook/src/pages/**/*.vue.spec.ts', BOUNDARY_SPEC],
					browser: {
						...browserBase,
						instances: [{browser: 'chromium' as const}],
					},
				},
			}),
			defineProject({
				plugins: [vue()],
				resolve: {
					dedupe: ['vue'],
					// The runtime-compiler build, the same alias `@storybook/vue3-vite` injects: page
					// fixtures declare vue components with `template:` strings. Without it the specs
					// depend on `@vue/test-utils` happening to pull the compiler in.
					alias: {vue: 'vue/dist/vue.esm-bundler.js'},
					extensions: ['.vue.ts', '.vue.tsx', '.mjs', '.js', '.mts', '.ts', '.jsx', '.tsx', '.json'],
				},
				test: {
					name: 'vue',
					globals: true,
					setupFiles: ['./packages/storybook/vitest.setup.vue.ts'],
					include: [
						'packages/storybook/src/pages/**/*.vue.spec.ts',
						'packages/storybook/src/pages/**/*.spec.ts',
					],
					exclude: ['**/node_modules/**', BOUNDARY_SPEC],
					browser: {
						...browserBase,
						instances: [{browser: 'chromium' as const}],
					},
				},
			}),
		],
	},
	fmt: {
		arrowParens: 'avoid',
		bracketSpacing: false,
		jsxSingleQuote: false,
		printWidth: 120,
		proseWrap: 'preserve',
		semi: false,
		singleQuote: true,
		tabWidth: 4,
		trailingComma: 'es5',
		useTabs: true,
		sortImports: {},
		sortPackageJson: true,
		overrides: [
			{
				files: ['*.json'],
				options: {
					useTabs: false,
					tabWidth: 2,
				},
			},
			{
				files: ['*.md'],
				options: {
					useTabs: false,
					tabWidth: 4,
				},
			},
			{
				files: ['packages/website/**/*.{astro,tsx,jsx}'],
				options: {
					sortTailwindcss: {
						stylesheet: 'packages/website/src/styles/global.css',
					},
				},
			},
		],
		ignorePatterns: [
			'pnpm-lock.yaml',
			'CHANGELOG.md',
			'dist/',
			'coverage/',
			'packages/website/.vercel/',
			'packages/website/src/content/docs/',
			'docs/scratch/**/*.md',
			'node_modules/',
		],
	},
	lint: {
		plugins: [
			'eslint',
			'typescript',
			'unicorn',
			'react',
			'react-perf',
			'vue',
			'oxc',
			'import',
			'jsdoc',
			'jsx-a11y',
			'node',
			'promise',
			'vitest',
		],
		jsPlugins: [{name: 'vite-plus', specifier: 'vite-plus/oxlint-plugin'}],
		categories: {
			correctness: 'warn',
			suspicious: 'warn',
			perf: 'warn',
		},
		rules: {
			'import/no-cycle': 'error',
			'import/no-duplicates': 'error',
			'eslint/sort-imports': 'allow',
			'eslint/no-unused-private-class-members': 'error',
			'eslint/no-unused-vars': 'error',
			'eslint/no-shadow': 'off',
			'eslint/no-throw-literal': 'warn',
			'eslint/no-await-in-loop': 'off',
			'eslint/object-shorthand': 'error',
			// The suite identifies elements by role, tag, text and asserted attributes. A test-only id
			// is the query of last resort and every one of them turned out to be another query spelled
			// twice. Property-only form, so it also covers a locator-scoped `within(el).getByTestId`.
			'eslint/no-restricted-properties': [
				'error',
				{property: 'getByTestId', message: 'Identify by role, tag or text — not a test-only id.'},
			],
			'typescript/consistent-type-imports': 'error',
			'typescript/consistent-type-exports': 'error',
			'typescript/no-explicit-any': 'error',
			'typescript/no-useless-default-assignment': 'warn',
			'typescript/prefer-readonly': 'warn',
			'typescript/prefer-find': 'warn',
			'typescript/no-unnecessary-qualifier': 'warn',
			// TODO(ts7): re-enable with the TS 7 migration. tsgolint judges this rule with the TS 7 checker while
			// builds use TS 6, so it flags casts TS 6 requires (build breaks) or that drive generic inference
			// (silent type widening, e.g. PropsModel.layout) — every finding needs manual vetting until checkers align.
			'typescript/no-unnecessary-type-assertion': 'off',
			'typescript/no-non-null-assertion': 'error',
			'typescript/no-dynamic-delete': 'warn',
			'typescript/no-unsafe-type-assertion': 'error',
			'typescript/dot-notation': 'warn',
			'typescript/no-unnecessary-type-parameters': 'warn',
			'typescript/no-unnecessary-type-arguments': 'off',
			'typescript/no-redundant-type-constituents': 'off',
			'typescript/consistent-return': 'off',
			'typescript/no-unnecessary-condition': 'error',
			'typescript/switch-exhaustiveness-check': 'warn',
			'typescript/prefer-optional-chain': 'warn',
			'typescript/prefer-nullish-coalescing': 'warn',
			'typescript/no-misused-promises': 'warn',
			'typescript/no-unsafe-argument': 'error',
			'typescript/no-unsafe-assignment': 'off',
			'typescript/no-unsafe-call': 'error',
			'typescript/no-unsafe-member-access': 'error',
			'typescript/no-unsafe-return': 'error',
			'unicorn/no-useless-spread': 'warn',
			'unicorn/prefer-module': 'warn',
			'unicorn/prefer-ternary': 'warn',
			'unicorn/consistent-function-scoping': 'off',
			'react/no-children-prop': 'allow',
			'react/exhaustive-deps': 'off',
			'react/react-in-jsx-scope': 'off',
			// TODO(react-compiler): oxlint 1.79 split `react/react-compiler` into per-category rules, and these five
			// land in categories this config enables wholesale. Off until we decide how far the adapter follows the
			// React Compiler's rules — findings, analysis and options in docs/scratch/react-compiler-rules/.
			'react/refs': 'off',
			'react/immutability': 'off',
			'react/globals': 'off',
			'react/set-state-in-effect': 'off',
			'react/exhaustive-effect-dependencies': 'off',
			'react-perf/jsx-no-new-object-as-prop': 'off',
			'react-perf/jsx-no-new-function-as-prop': 'off',
			'jsx_a11y/click-events-have-key-events': 'off',
			'vitest/valid-expect-in-promise': 'warn',
			'vitest/require-mock-type-parameters': 'off',
			'vitest/warn-todo': 'off',
			'vitest/valid-expect': 'off',
			'vitest/no-disabled-tests': 'off',
			'vitest/expect-expect': 'off',
			'eslint/no-underscore-dangle': 'off',
			'jsx_a11y/no-noninteractive-element-interactions': 'off',
			'react-perf/jsx-no-jsx-as-prop': 'off',
			'react-perf/jsx-no-new-array-as-prop': 'off',
			'import/no-unassigned-import': ['warn', {allow: ['**/*.css']}],
			'vite-plus/prefer-vite-plus-imports': 'error',
		},
		overrides: [
			{
				files: [
					'**/*.spec.ts',
					'**/*.spec.tsx',
					'**/*.spec.react.tsx',
					'**/*.stories.ts',
					'**/*.stories.tsx',
					'**/*.stories.react.tsx',
					'**/*.stories.vue.ts',
					'**/*.fixtures.react.tsx',
					'**/*.fixtures.vue.ts',
					'**/*.bench.ts',
					'**/*.js',
				],
				rules: {
					'react/no-unstable-nested-components': 'off',
					'typescript/no-explicit-any': 'off',
					'typescript/no-non-null-assertion': 'off',
					'typescript/no-unsafe-argument': 'off',
					'typescript/no-unsafe-assignment': 'off',
					'typescript/no-unsafe-call': 'off',
					'typescript/no-unsafe-member-access': 'off',
					'typescript/no-unsafe-return': 'off',
					'typescript/unbound-method': 'off',
				},
			},
			{
				files: ['**/*.vue'],
				rules: {
					'eslint/no-unused-expressions': 'off',
				},
			},
			{
				files: ['**/vitest.setup*.ts'],
				rules: {
					'typescript/no-unsafe-call': 'off',
				},
			},
			{
				files: ['**/vite.config.ts'],
				rules: {
					'typescript/no-unsafe-call': 'off',
				},
			},
		],
		// Ignored files skip the type check too: alien-signals is covered by `vue-tsc`, the website by `astro check`.
		ignorePatterns: ['packages/website/**', 'packages/core/src/shared/signals/alien-signals/**'],
		settings: {
			jsdoc: {
				ignorePrivate: false,
				ignoreInternal: false,
				ignoreReplacesDocs: true,
				overrideReplacesDocs: true,
				augmentsExtendsReplacesDocs: false,
				implementsReplacesDocs: false,
				exemptDestructuredRootsFromChecks: false,
				tagNamePreference: {},
			},
		},
		env: {
			builtin: true,
		},
		options: {
			typeAware: true,
			// TS 7 check of `.ts`/`.tsx`; SFCs stay with `vue-tsc` in `typecheck`.
			typeCheck: true,
			denyWarnings: true,
			reportUnusedDisableDirectives: 'deny',
		},
	},
	staged: {
		'*': 'vp check --fix',
	},
})