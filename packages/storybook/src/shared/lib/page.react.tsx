import type {MarkputApi} from '@markput/core'
import type {composeStories as composeStoriesType} from '@storybook/react-vite'
import {composeStories} from '@storybook/react-vite'
import type {ComponentType} from 'react'
import {useState} from 'react'
import {render} from 'vitest-browser-react'

import {findEditingHost} from './dom'
import type {Echoed, EchoOptions, Mounted, MountedApi, StoryAnnotations} from './page.shared'
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

/** Mounts a story as a controlled field that echoes `onChange` back into `value`. */
export async function mountEcho(
	Story: StoryComponent,
	{value: initial, ...args}: EchoOptions & Partial<PageArgs>
): Promise<Echoed> {
	assertEchoable(Story)
	const latest = {current: initial}

	function Echo() {
		const [value, setValue] = useState(initial)
		latest.current = value

		return <Story {...args} value={value} onChange={setValue} />
	}

	const {container} = await render(<Echo />)
	return {host: findEditingHost(container), value: () => latest.current}
}

/** Mounts the component itself, for the pages whose specs never go through a story. */
export async function mountComponent(args: Partial<PageArgs> = {}): Promise<Mounted> {
	const {container} = await render(<Component {...args} />)
	return {host: findEditingHost(container)}
}

/**
 * Mounts the component with its API captured. A Vue `ref` on a composed story resolves to the
 * story wrapper, which exposes nothing — so the `ref` contract can only be asserted on
 * `MarkedInput` directly, and both frameworks do it the same way.
 */
export async function mountApi(args: Partial<PageArgs> = {}): Promise<MountedApi> {
	const captured: {current: MarkputApi | null} = {current: null}
	const props = {
		...args,
		ref: (instance: MarkputApi | null) => {
			captured.current = instance
		},
	}

	const {container} = await render(<Component {...props} />)
	return {host: findEditingHost(container), api: () => captured.current}
}