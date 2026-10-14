import {defineConfig} from 'vite-plus'

import {adapterPack} from '../../../scripts/adapterPack'

export default defineConfig({
	pack: adapterPack(import.meta.dirname),
})