import {defineConfig} from 'vite-plus'

import {CSS} from '../../scripts/adapterPack'

export default defineConfig({
	pack: {entry: ['index.ts'], platform: 'browser', minify: true, dts: false, css: {...CSS, fileName: 'index.css'}},
})