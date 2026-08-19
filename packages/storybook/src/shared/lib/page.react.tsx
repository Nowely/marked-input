import type {MarkputHandle} from '@markput/core'
import type {composeStories as composeStoriesType} from '@storybook/react-vite'
import {composeStories} from '@storybook/react-vite'
import type {ComponentType} from 'react'
import {useState} from 'react'
import {render} from 'vitest-browser-react'

import {findEditingHost} from './dom'
import type {Echoed, EchoOptions, Mounted, MountedHandle, Remountable, StoryAnnotations} from './page.shared'
import {assertEchoable} from './page.shared'
// The exact sibling, not the seam name: oxlint does not honour `moduleSuffixes`.
import {component as Component} from './stories.react'
import type {PageArgs} from './stories.react'

/**
 * The framework seam for shared page specs. `page.react.tsx` and `page.vue.ts` expose the
 * same shape; a spec importing `../../shared/lib/page` gets its own project's file through
 * `resolve.extensions` (vitest) and `moduleSuffixes` (tsc).
 */

export type StoryComponent = ComponentType<Record<string, unknown>> & StoryAnnotations

/** Composes a page's stories once, with the project annotations the setup file registered. */
export function composePage<TModule extends Parameters<typeof composeStoriesType>[0]>(module: TModule) {
	return composeStories(module)
}

/** Mounts a story with overridden args. */
export async function mount(Story: StoryComponent, args: Partial<PageArgs> = {}): Promise<Mounted> {
	const {container} = await render(<Story {...args} />)
	return {host: findEditingHost(container)}
}

/**
 * Mounts a story's ARGS as a controlled field that echoes `onChange` back into `value`.
 *
 * The component, not the story: `@storybook/vue3` re-creates a composed story's component on
 * every render, so echoing through it remounts the editor and loses focus, caret and any open
 * overlay. React does not have that problem, but both seams mount the component so a shared
 * spec means the same thing in both projects. Decorators therefore do not run here — which is
 * what {@link assertEchoable} guards.
 */
export async function mountEcho(
	Story: StoryComponent,
	{value: initial, ...args}: EchoOptions & Partial<PageArgs>
): Promise<Echoed> {
	assertEchoable(Story)
	const latest = {current: initial}
	const storyArgs = Story.args ?? {}

	function Echo() {
		const [value, setValue] = useState(initial)
		latest.current = value

		return <Component {...storyArgs} {...args} value={value} onChange={setValue} />
	}

	const {container} = await render(<Echo />)
	return {host: findEditingHost(container), value: () => latest.current}
}

/**
 * The markup a story renders, root included — what the story sweep snapshots. Unlike
 * {@link mount} this keeps the render root rather than the editing host, because a story
 * decorator's wrapper is part of what the snapshot pins.
 */
export async function renderStoryHtml(Story: StoryComponent): Promise<string> {
	const {container} = await render(<Story />)
	return container.innerHTML
}

/** Mounts the component itself, for the pages whose specs never go through a story. */
export async function mountComponent(args: Partial<PageArgs> = {}): Promise<Remountable> {
	const {container, rerender} = await render(<Component {...args} />)

	return {
		host: findEditingHost(container),
		// A fresh element, not a merge: react's `rerender` takes the whole node, so a prop the
		// next bag omits is simply absent — which is the contract {@link Remountable} exists for.
		rerender: async (next: Record<string, unknown>) => {
			await rerender(<Component {...next} />)
			return findEditingHost(container)
		},
	}
}

/**
 * Mounts the component with its API captured. A Vue `ref` on a composed story resolves to the
 * story wrapper, which exposes nothing — so the `ref` contract can only be asserted on
 * `MarkedInput` directly, and both frameworks do it the same way.
 */
export async function mountHandle(args: Partial<PageArgs> = {}): Promise<MountedHandle> {
	const captured: {current: MarkputHandle | null} = {current: null}
	const props = {
		...args,
		ref: (instance: MarkputHandle | null) => {
			captured.current = instance
		},
	}

	const {container} = await render(<Component {...props} />)
	return {host: findEditingHost(container), handle: () => captured.current}
}