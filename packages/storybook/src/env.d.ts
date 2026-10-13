// The TS 7 checker behind `vp check` (tsgolint) has no Vue language plugin, so an SFC import only
// resolves through this declaration there. `vue-tsc` resolves the real `.vue` file first and never
// reaches it, so the package's own types and declarations do not change.
declare module '*.vue' {
	import type {DefineComponent} from 'vue'
	const component: DefineComponent<object, object, unknown>
	export default component
}