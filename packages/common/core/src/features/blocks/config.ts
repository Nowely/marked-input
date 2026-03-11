export const BLOCK_SEPARATOR = '\n\n'

export function getAlwaysShowHandle(block: boolean | {alwaysShowHandle: boolean}): boolean {
	return typeof block === 'object' && !!block.alwaysShowHandle
}

export function getAlwaysShowHandleDrag(drag: boolean | {alwaysShowHandle: boolean}): boolean {
	return typeof drag === 'object' && !!drag.alwaysShowHandle
}