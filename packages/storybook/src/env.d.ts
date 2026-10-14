// For tsgolint (`vp lint`), which cannot read SFCs. vue-tsc resolves the real `.vue` files first.
declare module '*.vue' {
	import type {DefineComponent} from 'vue'
	const component: DefineComponent<object, object, unknown>
	export default component
}