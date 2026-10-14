import Vue from 'unplugin-vue/rolldown'
import {defineConfig} from 'vite-plus'

import {adapterPack} from '../../../scripts/adapterPack'

// unplugin-vue's and Vite+'s Plugin types are separate copies; comparing them overflows the checker.
const vue: {name: string} = Vue({isProduction: true})

export default defineConfig({
	pack: adapterPack(import.meta.dirname, {plugins: [vue], vue: true}),
})