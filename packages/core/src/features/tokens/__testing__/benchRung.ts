import type {BenchRunOptions} from 'vitest'
import {test} from 'vitest'

/**
 * One benchmark, registered as a test of its own — Vitest 5 runs benchmarks through the `bench`
 * test fixture.
 *
 * ONE RUN PER RUNG, never several benches in one run. A tinybench run warms EVERY task up before it
 * measures any, and the bench files here build their world on a rung's first call — a world that
 * detaches every world built before it. Registered together, all rungs but the last would be
 * measured against a detached world. A run of its own keeps each rung's warmup directly before its
 * own measurement, which is the order the files' `lazy` builders rely on.
 */
export function benchRung(name: string, fn: () => unknown, options: BenchRunOptions): void {
	// oxlint-disable-next-line vitest/valid-title -- the rung's own name, passed through from its ladder
	test(name, {timeout: 60_000}, async ({bench}) => {
		await bench(name, fn).run(options)
	})
}