import type {MarkputHandle} from '@markput/core'
import type {composeStories as composeStoriesType} from '@storybook/vue3-vite'
import {composeStories} from '@storybook/vue3-vite'
import {render} from 'vitest-browser-vue'
import type {Component, PropType} from 'vue'
import {defineComponent, h, ref, shallowRef} from 'vue'

import {findEditingHost} from './dom'
import type {Echoed, EchoOptions, Mounted, MountedApi, Remountable, StoryAnnotations} from './page.shared'
import {assertEchoable} from './page.shared'
// The exact sibling, not the seam name: oxlint does not honour `moduleSuffixes`.
import {component} from './stories.vue'
import type {PageArgs} from './stories.vue'

/**
 * The framework seam for shared page specs. `page.react.tsx` and `page.vue.ts` expose the
 * same shape; a spec importing `../../shared/lib/page` gets its own project's file through
 * `resolve.extensions` (vitest) and `moduleSuffixes` (tsc).
 */

export type StoryComponent = Component & StoryAnnotations

/** Composes a page's stories once, with the project annotations the setup file registered. */
export function composePage<TModule extends Parameters<typeof composeStoriesType>[0]>(module: TModule) {
	return composeStories(module)
}

/** Mounts a story with overridden args. */
export async function mount(Story: StoryComponent, args: Partial<PageArgs> = {}): Promise<Mounted> {
	const Wrapper = defineComponent({
		setup:
			(_, {slots}) =>
			() =>
				h(Story, args, slots),
	})
	const {container} = await render(Wrapper)
	return {host: findEditingHost(container)}
}

/**
 * Mounts a story's ARGS as a controlled field that echoes `onChange` back into `value`.
 *
 * The component, not the story: `@storybook/vue3` wraps a composed story in
 * `(...args) => h(composedStory(...args))`, and `composedStory()` returns a NEW component
 * object per call — so every echoed change gives the vnode a different type and Vue remounts
 * the editor, losing focus, caret and any open overlay. Mounting `component` directly keeps
 * the element identity across updates (React is unaffected, but does the same for symmetry).
 */
export async function mountEcho(
	Story: StoryComponent,
	{value: initial, ...args}: EchoOptions & Partial<PageArgs>
): Promise<Echoed> {
	assertEchoable(Story)
	const value = ref(initial)
	const storyArgs = Story.args ?? {}

	const Echo = defineComponent({
		setup: () => () =>
			h(component, {
				...storyArgs,
				...args,
				value: value.value,
				onChange: (next: string) => {
					value.value = next
				},
			}),
	})

	const {container} = await render(Echo)
	return {host: findEditingHost(container), value: () => value.value}
}

/**
 * The markup a story renders, root included — what the story sweep snapshots. Unlike
 * {@link mount} this keeps the render root rather than the editing host, because a story
 * decorator's wrapper is part of what the snapshot pins.
 */
export async function renderStoryHtml(Story: StoryComponent): Promise<string> {
	const {container} = await render(Story)
	return container.innerHTML
}

/**
 * Mounts the component itself, for the pages whose specs never go through a story.
 *
 * The whole arg bag rides in ONE prop, which is what makes {@link Remountable} honest here: vue's
 * `rerender` MERGES the props it is given, so re-rendering with a bag that omits `readOnly` would
 * otherwise leave the old value standing. Replacing a single object prop replaces everything.
 */
export async function mountComponent(args: Partial<PageArgs> = {}): Promise<Remountable> {
	const Wrapper = defineComponent({
		props: {args: {type: Object as PropType<Record<string, unknown>>, required: true}},
		setup: props => () => h(component, props.args),
	})
	// Kept whole rather than destructured: vue's `rerender` is declared a METHOD, so pulling it
	// off the result unbinds `this`.
	const result = await render(Wrapper, {props: {args}})

	return {
		host: findEditingHost(result.container),
		rerender: async (next: Record<string, unknown>) => {
			await result.rerender({args: next})
			return findEditingHost(result.container)
		},
	}
}

/**
 * Mounts the component with its API captured. A Vue `ref` on a composed story resolves to the
 * story wrapper, which exposes nothing — so the `ref` contract can only be asserted on
 * `MarkedInput` directly, and both frameworks do it the same way.
 */
export async function mountApi(args: Partial<PageArgs> = {}): Promise<MountedApi> {
	// `shallowRef`, not `ref`: `ref<T>()` yields `Ref<UnwrapRef<T>>`, and `UnwrapRef` maps a
	// class instance into a structural copy that is no longer nominally `MarkputHandle`.
	const captured = shallowRef<MarkputHandle | null>(null)
	const Wrapper = defineComponent({
		setup: () => () => h(component, {...args, ref: captured}),
	})

	const {container} = await render(Wrapper)
	return {host: findEditingHost(container), api: () => captured.value}
}