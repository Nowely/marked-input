import Vue from 'unplugin-vue/rolldown'
import {defineConfig} from 'vite-plus'

import {adapterPack} from '../../../scripts/adapterPack'

// unplugin-vue's rolldown types and the ones Vite+ bundles are separate declarations of one Plugin,
// and comparing them overflows the checker; `{name: string}` is the shape tsdown accepts from any.
const vue: {name: string} = Vue({isProduction: true})

export default defineConfig({
	pack: adapterPack(import.meta.dirname, {plugins: [vue], vue: true}),
})