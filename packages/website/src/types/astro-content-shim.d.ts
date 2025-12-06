declare module 'astro:content' {
	export type SchemaContext = any
	export type CollectionEntry<T extends string = string> = any
	export type RenderResult = any
	export type DataCollectionKey = any
	export const collections: Record<string, unknown>
	export function defineCollection<T = any>(input: T): T
	export function getCollection(...args: any[]): Promise<any>
}
