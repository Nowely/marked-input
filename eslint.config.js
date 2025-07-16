import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import pluginReact from 'eslint-plugin-react'
import {globalIgnores} from 'eslint/config'

export default tseslint.config([
	globalIgnores(['dist']),
	{
		files: ['**/*.{ts,tsx}'],
		extends: [
			js.configs.recommended,
			tseslint.configs.recommended,
			pluginReact.configs.flat['jsx-runtime']
		],
		languageOptions: {
			globals: globals.browser,
		},
	},
])
